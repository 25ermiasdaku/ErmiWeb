/**
 * Throwaway harness: mints a real session row for a user, then requests every
 * page with that cookie and reports what the guard decided.
 *
 * Server actions cannot be driven by a plain form POST, so this inserts the
 * session directly instead of going through the login form.
 */
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const BASE = "http://localhost:3000";
const COOKIE = "ermi_session";

const PATHS = [
  "/dashboard", "/pos", "/orders", "/my-orders", "/inventory", "/loyalty", "/recipes", "/me",
  "/admin", "/admin/users", "/admin/roles", "/admin/reports",
  "/admin/settings", "/admin/logs",
];

const db = new DatabaseSync("data/ermi.db");

/** node:sqlite's .get() returns a wide union; these probes know the shape. */
function one<T>(sql: string, ...params: Array<string | number>): T {
  return db.prepare(sql).get(...params) as T;
}

function count(sql: string): number {
  return (db.prepare(sql).get() as { n: number }).n;
}

/** role slug -> the permission keys it holds, straight from the database. */
function grants(): Map<string, Set<string>> {
  const rows = db
    .prepare(
      `SELECT r.slug, p.key FROM roles r
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE r.is_system = 1`,
    )
    .all() as Array<{ slug: string; key: string }>;
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!map.has(row.slug)) map.set(row.slug, new Set());
    map.get(row.slug)!.add(row.key);
  }
  return map;
}

const ROUTE_PERM: Record<string, string | null> = {
  "/dashboard": "dashboard.view",
  "/pos": "pos.use",
  "/orders": "orders.view",
  "/my-orders": "orders.self",
  "/inventory": "inventory.view",
  "/loyalty": "loyalty.view",
  "/recipes": "recipes.view",
  "/me": null,
  "/admin": "admin.access",
  "/admin/users": "users.view",
  "/admin/roles": "roles.view",
  "/admin/reports": "reports.view",
  "/admin/settings": "settings.view",
  "/admin/logs": "logs.view",
};

function mintSession(username: string) {
  const user = one<{ id: number; username: string; role: string }>(
    `SELECT u.id, u.username, r.slug AS role FROM users u
       JOIN roles r ON r.id = u.role_id WHERE u.username = ?`,
    username,
  );
  if (!user) throw new Error(`no such user: ${username}`);

  const token = randomBytes(32).toString("hex");
  const digest = createHash("sha256").update(token).digest("hex");
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES (?, ?, datetime('now', '+1 day'), 'local', 'probe')`,
  ).run(digest, user.id);
  return { token, user };
}

async function fetchAs(token: string, path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `${COOKIE}=${token}` },
    redirect: "manual",
  });
  const html = await res.text();
  return { status: res.status, html };
}

/** What the guard rendered, judged from the HTML the server sent back. */
function classify(status: number, html: string): string {
  if (status !== 200) return "ERROR";
  if (/Sign in to continue/i.test(html)) return "SIGNED-OUT";
  // Only count the guard panel this app actually renders.
  if (/You do not have access to this page/i.test(html)) return "DENIED";
  return "OK";
}

const expected = grants();
let failures = 0;
let checks = 0;

for (const username of ["admin", "manager", "barista", "cashier", "ava"]) {
  const { token, user } = mintSession(username);
  const held = expected.get(user.role) ?? new Set<string>();
  console.log(`\n=== ${username} (${user.role}, ${held.size} permissions) ===`);

  for (const path of PATHS) {
    const { status, html } = await fetchAs(token, path);
    const got = classify(status, html);
    const need = ROUTE_PERM[path] ?? null;
    // Every page here is either open to any signed-in account, or gated.
    const want = need === null ? "OK" : held.has(need) ? "OK" : "DENIED";
    const good = got === want && status === 200;
    checks++;
    if (!good) failures++;
    console.log(
      `  ${good ? "pass" : "FAIL"}  ${path.padEnd(20)} ${status}  got=${got.padEnd(10)} want=${want}` +
        (need ? `  (${need})` : ""),
    );
  }
}

// Anonymous: everything but /login must bounce to the sign-in page.
console.log(`\n=== anonymous ===`);
for (const path of ["/dashboard", "/me", "/admin", "/inventory"]) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "(none)";
  const good = res.status === 307 && loc.includes("/login");
  checks++;
  if (!good) failures++;
  console.log(`  ${good ? "pass" : "FAIL"}  ${path.padEnd(20)} ${res.status} -> ${loc}`);
}

db.close();
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
