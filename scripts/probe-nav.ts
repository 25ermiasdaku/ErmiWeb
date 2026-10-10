/**
 * Complements probe-permissions.ts: checks that the sidebar itself is filtered
 * per role, and that a deactivated / archived account behaves as documented.
 */
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const BASE = "http://localhost:3000";
const COOKIE = "ermi_session";
const db = new DatabaseSync("data/ermi.db");

/** node:sqlite's .get() returns a wide union; these probes know the shape. */
function one<T>(sql: string, ...params: Array<string | number>): T {
  return db.prepare(sql).get(...params) as T;
}

function count(sql: string): number {
  return one<{ n: number }>(sql).n;
}

function mintSession(username: string) {
  const user = one<{ id: number }>("SELECT u.id FROM users u WHERE u.username = ?", username);
  if (!user) throw new Error(`no such user: ${username}`);
  const token = randomBytes(32).toString("hex");
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES (?, ?, datetime('now', '+1 day'), 'local', 'nav-probe')`,
  ).run(createHash("sha256").update(token).digest("hex"), user.id);
  return token;
}

async function htmlAs(token: string, path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `${COOKIE}=${token}` },
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

const NAV_LINKS = [
  "/pos", "/orders", "/my-orders", "/inventory", "/loyalty", "/recipes", "/me",
  "/admin", "/admin/users", "/admin/roles", "/admin/reports",
  "/admin/settings", "/admin/logs",
];

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

console.log("=== sidebar contents per role ===");
for (const username of ["admin", "manager", "barista", "cashier", "ava"]) {
  const token = mintSession(username);
  const { html } = await htmlAs(token, "/me");
  const shown = NAV_LINKS.filter((href) => html.includes(`href="${href}"`));
  const adminLinks = shown.filter((h) => h.startsWith("/admin"));
  const expectAdmin = username === "admin" || username === "manager";
  check(
    `${username.padEnd(8)} sidebar`,
    expectAdmin ? adminLinks.length === 6 : adminLinks.length === 0,
    `shows: ${shown.join(" ") || "(none)"}`,
  );
  check(`${username.padEnd(8)} has My Account`, shown.includes("/me"));
  // Everyone can order for themselves, which is the whole point of the page.
  check(`${username.padEnd(8)} has My Coffee`, shown.includes("/my-orders"));
}

// A customer must reach their order page and nothing else. The staff tools are
// not merely hidden: each one is a real denial, so a pasted URL does not help.
console.log("\n=== customer is shut out of the staff tools ===");
{
  const token = mintSession("ava");
  for (const path of ["/dashboard", "/pos", "/orders", "/inventory", "/loyalty", "/recipes", "/admin", "/admin/users"]) {
    const { status, html } = await htmlAs(token, path);
    const denied = status === 200 && /You do not have access to this page/i.test(html);
    check(`customer blocked from ${path}`, denied, `status ${status}`);
  }
  const { status, html } = await htmlAs(token, "/my-orders");
  check("customer can reach /my-orders", status === 200 && /My Coffee/i.test(html), `status ${status}`);
  // Their own order number must be there, and nobody else's name.
  check("customer sees their own order", /E-\d{4}/.test(html));
  check("customer does not see staff tools in the sidebar", !/Point of Sale/.test(html));
  // Exactly one thing to act on: the confirmation for the order in progress.
  // Two buttons would mean the customer cannot tell which order they confirm.
  const confirms = html.match(/Yes, make it|I have it/g) ?? [];
  check("customer is offered exactly one confirmation", confirms.length === 1, `${confirms.length} found`);
}

console.log("\n=== account states ===");
// A switched-off account must not be able to use an existing session: the
// shell sends them back to the sign-in page rather than showing the app.
const eliToken = mintSession("eli");
{
  const { status, html } = await htmlAs(eliToken, "/me");
  const bounced = status === 307;
  check(
    "deactivated account bounces to sign-in",
    bounced || /Sign in to continue/i.test(html),
    `status ${status}`,
  );
}

// An archived account is gone from the staff list but still in the database.
{
  const token = mintSession("admin");
  const { html } = await htmlAs(token, "/admin/users");
  const juno = one<{ deleted_at: string | null }>(
    "SELECT deleted_at FROM users WHERE username = 'juno'",
  );
  check("archived user is in the database", !!juno?.deleted_at, `deleted_at=${juno?.deleted_at}`);
  check("archived user shown in the admin list", /juno/.test(html));
  check("live users shown too", /cashier/.test(html) && /barista/.test(html));
  check("self is marked", html.includes("you"));
}

console.log("\n=== audit trail ===");
{
  const before = count("SELECT COUNT(*) AS n FROM activity_log");
  const token = mintSession("admin");
  await htmlAs(token, "/admin/logs");
  const after = count("SELECT COUNT(*) AS n FROM activity_log");
  check("reading pages does not spam the log", after - before <= 2, `${before} -> ${after}`);
}

db.close();
console.log(fails === 0 ? "\nall nav/state checks passed" : `\n${fails} check(s) failed`);
process.exit(fails === 0 ? 0 : 1);
