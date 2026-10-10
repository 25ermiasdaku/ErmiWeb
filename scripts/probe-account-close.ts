/**
 * End-to-end check of self-service account deletion against a running server
 * (start it first with `npm run dev` or `npm start`), then a direct look at the
 * database to confirm what actually happened on disk.
 *
 * The probe registers a throwaway customer, confirms it is alive, proves the
 * API refuses to delete it without the right password, deletes it with the
 * password, and then checks that the user row, its loyalty record and its
 * sessions are gone while the audit trail keeps a username snapshot.
 *
 * The probe row is self-cleaning: the account is deleted as part of the test,
 * and a failure mid-flight still attempts deletion in `finally`.
 */
import { DatabaseSync } from "node:sqlite";

const BASE = process.env.PROBE_URL ?? "http://localhost:3000";
const db = new DatabaseSync("data/ermi.db");

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

async function api(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

const record = (data: unknown): Record<string, unknown> =>
  data && typeof data === "object" ? (data as Record<string, unknown>) : {};

function one<T>(sql: string, ...params: Array<string | number>): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

// ---------------------------------------------------------------
// Probe: register -> guard -> wrong password -> delete -> verify
// ---------------------------------------------------------------

const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const email = `pclose.${stamp}@example.test`;
const username = `pclose.${stamp}`;
const password = "Cup-Of-Joe-2049";

console.log("=== 1. register a throwaway customer ===\n");
const reg = await api("/api/auth/register", {
  method: "POST",
  body: { fullName: "Probe Close", email, password },
});
check("register returns 201", reg.status === 201, `status ${reg.status}`);
check("register returns a token + user", Boolean(record(reg.data).token) && Boolean(record(reg.data).user));

const token = record(reg.data).token as string;
let userId: number | null = null;

try {
  const me = await api("/api/me", { token });
  const user = record(record(me.data).user);
  userId = typeof user.id === "number" ? user.id : null;
  check("GET /api/me resolves the fresh token", me.status === 200, `status ${me.status}`);
  check("the account is a customer with a loyalty record", user.role === "customer" && user.memberId !== null);

  console.log("\n=== 2. the password is the gate, not just the session ===\n");
  const wrong = await api("/api/me/delete", {
    method: "POST",
    token,
    body: { password: "definitely-not-it" },
  });
  const wrongData = record(wrong.data);
  const wrongFields = (wrongData.fieldErrors ?? {}) as Record<string, unknown>;
  check("wrong password is refused", wrong.status === 422, `status ${wrong.status}`);
  check("the refusal names the password field", Boolean(wrongFields.password), JSON.stringify(wrongFields));

  const still = await api("/api/me", { token });
  check("the account survives a wrong password", still.status === 200);

  const missing = await api("/api/me/delete", { method: "POST", token, body: {} });
  check("an empty password is refused too", missing.status === 422, `status ${missing.status}`);

  console.log("\n=== 3. the correct password erases the account ===\n");
  const gone = await api("/api/me/delete", {
    method: "POST",
    token,
    body: { password },
  });
  check("delete returns 200 + ok", gone.status === 200 && record(gone.data).ok === true, `status ${gone.status}`);

  const after = await api("/api/me", { token });
  check("the old token no longer resolves", after.status === 401, `status ${after.status}`);

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  check("the deleted account cannot sign in again", login.status === 401, `status ${login.status}`);

  console.log("\n=== 4. what is left on disk ===\n");
  check(
    "the users row is gone",
    one<{ id: number }>("SELECT id FROM users WHERE username = ?", username) === undefined,
  );
  check(
    "the users row is gone by email too",
    one<{ id: number }>("SELECT id FROM users WHERE lower(email) = ?", email) === undefined,
  );
  check(
    "the loyalty member went with it",
    one<{ id: number }>("SELECT id FROM members WHERE lower(email) = ?", email) === undefined,
  );
  const leftOrders = db
    .prepare("SELECT COUNT(*) AS n FROM orders o JOIN users u ON o.placed_by = u.id WHERE u.username = ?")
    .get(username) as { n: number };
  check("no order still points at the erased account", leftOrders.n === 0);

  if (userId !== null) {
    const sessions = db
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?")
      .get(userId) as { n: number };
    check("every session was revoked with the account", sessions.n === 0);
  }

  const trail = one<{ user_id: number | null; username: string; detail: string }>(
    "SELECT user_id, username, detail FROM activity_log WHERE action = 'user.self_delete' AND username = ? ORDER BY id DESC LIMIT 1",
    username,
  );
  check(
    "the audit trail keeps a username snapshot for history",
    Boolean(trail && trail.username === username),
    trail ? `user_id=${trail.user_id} · ${trail.detail}` : "no trail row",
  );
  check("the snapshot account link is NULL, not dangling", trail === undefined || trail.user_id === null);
} finally {
  // Best effort, so a failed run does not leave a probe account behind.
  if (token) {
    await api("/api/me/delete", { method: "POST", token, body: { password } }).catch(() => undefined);
  }
  db.close();
}

console.log(fails === 0 ? "\naccount-close checks passed" : `\n${fails} check(s) failed`);
process.exit(fails === 0 ? 0 : 1);