/**
 * Sessions, identity and the permission gate.
 *
 * Server-only. The cookie holds a random 32-byte token; only its SHA-256
 * digest is stored, so a copy of the database cannot be replayed as a live
 * session. Every guard here is re-checked inside each server action, because
 * hiding a link is not a security boundary.
 */
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { all, get, run } from "./db";
import { LOCK_MINUTES, MAX_FAILED_LOGINS, sqlNow } from "./lockout";
import { permissionDef } from "./permissions";

export const SESSION_COOKIE = "ermi_session";
const SESSION_TTL_DAYS = 7;

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  job_title: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  is_active: number;
  must_change_password: number;
  last_login_at: string | null;
  /**
   * The loyalty record collecting this account's points. Set for customer
   * accounts, and for staff who have ordered for themselves. Null means an
   * order placed by this account earns no points.
   */
  member_id: number | null;
  /** Server-side only. Convert with `publicUser` before sending to a client. */
  permissions: Set<string>;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  job_title: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  is_active: number;
  must_change_password: number;
  last_login_at: string | null;
  member_id: number | null;
};

export type PublicUser = Omit<SessionUser, "permissions"> & { permissions: string[] };

/** Strip the Set so the user can cross the server/client boundary. */
export function publicUser(user: SessionUser): PublicUser {
  return { ...user, permissions: [...user.permissions] };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isoIn(days: number): string {
  return sqlNow(days * 86_400_000);
}

export async function clientIp(): Promise<string> {
  const h = await cookies();
  const forwarded = h.get("x-forwarded-for")?.value;
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 45);
  return (h.get("x-real-ip")?.value ?? "local").slice(0, 45);
}

// ---------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------

/** Create a session and set the cookie. Returns the raw token. */
export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const h = await cookies();
  const agent = (h.get("user-agent")?.value ?? "").slice(0, 200);

  run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  run(
    "INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)",
    hashToken(token),
    userId,
    isoIn(SESSION_TTL_DAYS),
    await clientIp(),
    agent,
  );

  h.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const h = await cookies();
  const token = h.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE id = ?", hashToken(token));
  h.delete(SESSION_COOKIE);
}

/**
 * The signed-in user, or null. Memoised per request so a page that checks
 * several permissions only reads the database once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const h = await cookies();
  const token = h.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = get<UserRow>(
    `SELECT u.id, u.username, u.email, u.full_name, u.job_title, u.is_active,
            u.must_change_password, u.last_login_at, u.member_id,
            r.id AS role_id, r.slug AS role_slug, r.name AS role_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE s.id = ? AND s.expires_at > datetime('now')
        AND u.deleted_at IS NULL`,
    hashToken(token),
  );
  if (!row || row.is_active !== 1) return null;

  // all(), not get(): a role grants many permissions, so this is a list.
  const keys = new Set(
    all<{ key: string }>(
      `SELECT p.key FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ?`,
      row.role_id,
    ).map((r) => r.key),
  );

  return { ...row, permissions: keys };
});

/** Current user, or throw. Use inside server actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You are not signed in.");
  return user;
}

/** Current user with a permission, or throw. The real security boundary. */
export async function requirePermission(key: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.has(key)) {
    const label = permissionDef(key)?.label ?? key;
    throw new Error(`Your role does not include "${label}".`);
  }
  return user;
}

export type Gate = { user: SessionUser; denied: null } | { user: null; denied: React.ReactNode };

/**
 * Page-level guard. Returns the user, or a "no access" panel to render
 * instead of the page. A convenience for the interface — the authoritative
 * checks still live in the actions.
 */
export async function gate(permission: string, user?: SessionUser): Promise<Gate> {
  const current = user ?? (await getCurrentUser());
  if (!current) {
    return { user: null, denied: <SignedOut /> };
  }
  if (!current.permissions.has(permission)) {
    return { user: null, denied: <NoAccess permission={permission} user={current} /> };
  }
  return { user: current, denied: null };
}

/**
 * The same, for a route every signed-in account may reach regardless of role —
 * the personal account page, mainly.
 */
export async function gateSelf(): Promise<Gate> {
  const current = await getCurrentUser();
  if (!current) return { user: null, denied: <SignedOut /> };
  return { user: current, denied: null };
}

function SignedOut() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="text-3xl" aria-hidden>
        🔒
      </p>
      <h1 className="mt-3 text-lg font-semibold">Sign in required</h1>
      <p className="mt-1.5 text-sm muted">This page is only available to signed-in staff.</p>
      <a href="/login" className="btn btn-primary mt-5">
        Go to sign in
      </a>
    </div>
  );
}

function NoAccess({ permission, user }: { permission: string; user: SessionUser }) {
  const def = permissionDef(permission);
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-3xl" aria-hidden>
        ⛔
      </p>
      <h1 className="mt-3 text-lg font-semibold">You do not have access to this page</h1>
      <p className="mt-1.5 text-sm muted">
        Your role is <strong>{user.role_name}</strong>. This page needs the{" "}
        <code className="font-mono text-xs">{def?.label ?? permission}</code> permission
        {def ? ` — ${def.description.charAt(0).toLowerCase()}${def.description.slice(1)}` : ""}.
      </p>
      <p className="mt-3 text-xs faint">
        Ask an owner or manager if you need it. They can change this under Admin → Roles.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <a href="/" className="btn">
          Dashboard
        </a>
        <a href="/me" className="btn btn-ghost">
          My account
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------

export { isLocked, lockoutMinutes } from "./lockout";

export function recordFailedLogin(userId: number, failures: number): void {
  if (failures + 1 >= MAX_FAILED_LOGINS) {
    run(
      "UPDATE users SET failed_logins = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?",
      failures + 1,
      sqlNow(LOCK_MINUTES * 60_000),
      userId,
    );
  } else {
    run(
      "UPDATE users SET failed_logins = ?, updated_at = datetime('now') WHERE id = ?",
      failures + 1,
      userId,
    );
  }
}

export function clearFailedLogins(userId: number): void {
  run(
    "UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?",
    userId,
  );
}
