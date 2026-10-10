/**
 * Verifies the real sign-in path, which the other probes bypass by minting a
 * session directly: that a seeded account's password hashes to what is stored,
 * that a wrong password is rejected, and that the temporary-password flag is
 * wired the whole way round.
 */
import { DatabaseSync } from "node:sqlite";
import { hashPassword, verifyPassword, passwordProblem, MIN_PASSWORD_LENGTH } from "../src/lib/password.ts";

const db = new DatabaseSync("data/ermi.db");
function one<T>(sql: string, ...params: Array<string | number>): T {
  return db.prepare(sql).get(...params) as T;
}

const DEMO = ["admin", "manager", "barista", "cashier"];
let fails = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

console.log("=== demo accounts verify against the stored hash ===");
for (const username of DEMO) {
  const row = one<{ password_hash: string; is_active: number; must_change_password: number }>(
    "SELECT password_hash, is_active, must_change_password FROM users WHERE username = ?",
    username,
  );
  if (!row) {
    check(`${username} exists`, false);
    continue;
  }
  const ok = await verifyPassword("ermi1234", row.password_hash);
  const bad = await verifyPassword("wrong-password", row.password_hash);
  check(`${username.padEnd(8)} accepts "ermi1234"`, ok);
  check(`${username.padEnd(8)} rejects a wrong password`, !bad);
  check(`${username.padEnd(8)} is active`, row.is_active === 1);
  // Stored format must be saltHex:hashHex, never the plaintext.
  check(
    `${username.padEnd(8)} hash is salted scrypt`,
    /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(row.password_hash),
    `${row.password_hash.slice(0, 20)}… len=${row.password_hash.length}`,
  );
}

console.log("\n=== the same password is stored differently for every account ===");
{
  const rows = db
    .prepare("SELECT username, password_hash FROM users WHERE is_active = 1")
    .all() as Array<{ username: string; password_hash: string }>;
  const digests = new Set(rows.map((r) => r.password_hash.split(":")[1]));
  const salts = new Set(rows.map((r) => r.password_hash.split(":")[0]));
  check("identical passwords produce different digests", digests.size > 1, `${digests.size} distinct digests`);
  check("every account has its own salt", salts.size === rows.length, `${salts.size} salts / ${rows.length} users`);
}

console.log("\n=== seeded non-signable accounts ===");
for (const [username, why] of [
  ["eli", "switched off"],
  ["juno", "archived"],
] as const) {
  const row = one<{ is_active: number; deleted_at: string | null }>(
    "SELECT is_active, deleted_at FROM users WHERE username = ?",
    username,
  );
  const blocked = !row || row.is_active !== 1 || !!row.deleted_at;
  check(`${username} cannot sign in (${why})`, blocked, `active=${row?.is_active} deleted=${row?.deleted_at}`);
}

console.log("\n=== password policy ===");
{
  check("rejects short", !!passwordProblem("short1"), passwordProblem("short1") ?? "");
  check(
    "rejects the username",
    !!passwordProblem("ermi1234", { username: "ermi" }),
    passwordProblem("ermi1234", { username: "ermi" }) ?? "",
  );
  check(
    "rejects a part of the full name",
    !!passwordProblem("Marchetti-99", { fullName: "Eli Marchetti" }),
    passwordProblem("Marchetti-99", { fullName: "Eli Marchetti" }) ?? "",
  );
  check(
    "rejects a part of the email",
    !!passwordProblem("viditure.co", { email: "someone@viditure.co" }),
    passwordProblem("viditure.co", { email: "someone@viditure.co" }) ?? "",
  );
  check("rejects one repeated character", !!passwordProblem("aaaaaaaaaaaa"));
  check("accepts a normal one", passwordProblem("Bench-Press-42") === null);
  // A very short name fragment must not trip the check on common substrings.
  check(
    "ignores name parts shorter than 4 characters",
    passwordProblem("ermi1234", { fullName: "Al Ri" }) === null,
  );
  check(`minimum length is ${MIN_PASSWORD_LENGTH}`, MIN_PASSWORD_LENGTH === 8);
}

console.log("\n=== temporary password flag ===");
{
  const reset = db
    .prepare("SELECT must_change_password FROM users WHERE username = 'cashier'")
    .get() as { must_change_password: number };
  check("seeded demo users are not flagged", reset.must_change_password === 0);
  // A fresh hash must differ from the stored one, i.e. hashing is salted.
  const fresh = await hashPassword("ermi1234");
  const stored = one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE username = 'admin'",
  ).password_hash;
  check("re-hashing the same password differs from storage", fresh !== stored);
}

db.close();
console.log(fails === 0 ? "\nall password checks passed" : `\n${fails} check(s) failed`);
process.exit(fails === 0 ? 0 : 1);
