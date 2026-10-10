/**
 * Username/password verification, shared by the web sign-in action and the
 * mobile API.
 *
 * Kept free of `redirect()` and of cookie handling so both callers can finish
 * the job their own way: the web action sets a session cookie and redirects,
 * the API returns a bearer token. The protections — constant-time comparison
 * against a dummy digest for unknown users, the failed-login counter and the
 * 15-minute lockout — all live here so neither path can forget them.
 */
import { get } from "./db";
import { logActivity } from "./activity";
import {
  clearFailedLogins,
  isLocked,
  lockoutMinutes,
  recordFailedLogin,
} from "./auth";
import { attemptsLeft } from "./lockout";
import { verifyPassword } from "./password";

/**
 * A well-formed but never-matching digest. Verifying against it when the
 * username is unknown makes a wrong username cost the same wall-clock time as
 * a wrong password, so the form cannot be used to enumerate accounts.
 */
const ABSENT_USER_DIGEST = `${"0".repeat(32)}:${"0".repeat(128)}`;

type LoginRow = {
  id: number;
  username: string;
  full_name: string;
  password_hash: string;
  role_slug: string;
  is_active: number;
  deleted_at: string | null;
  failed_logins: number;
  locked_until: string | null;
};

export type AuthResult = {
  ok: boolean;
  message: string;
  userId?: number;
  role?: string;
  fullName?: string;
};

export async function authenticate(usernameRaw: string, password: string): Promise<AuthResult> {
  const username = usernameRaw.trim().toLowerCase();

  if (!username || !password) {
    return { ok: false, message: "Enter your username and password." };
  }

  const user = get<LoginRow>(
    `SELECT u.id, u.username, u.full_name, u.password_hash, u.is_active, u.deleted_at,
            u.failed_logins, u.locked_until, r.slug AS role_slug
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE lower(u.username) = ?`,
    username,
  );

  const ok = await verifyPassword(password, user?.password_hash ?? ABSENT_USER_DIGEST);

  if (!user) {
    logActivity({
      action: "auth.login_failed",
      entity: "user",
      detail: `Unknown username "${username}"`,
    });
    return { ok: false, message: "Incorrect username or password." };
  }

  // Everything below this line is only reachable with the right password, so
  // it is safe to be specific about the account's state.
  if (!ok) {
    recordFailedLogin(user.id, user.failed_logins);
    const remaining = attemptsLeft(user.failed_logins + 1);
    logActivity({
      action: "auth.login_failed",
      entity: "user",
      entityId: user.id,
      username: user.username,
      detail: `Wrong password for "${user.username}"`,
    });
    return {
      ok: false,
      message:
        remaining > 0
          ? `Incorrect username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
          : "Incorrect username or password. This account is now locked for 15 minutes.",
    };
  }

  if (isLocked(user)) {
    return {
      ok: false,
      message: `Too many failed attempts. Try again in ${lockoutMinutes(user)} minute(s).`,
    };
  }

  if (user.is_active !== 1 || user.deleted_at) {
    logActivity({
      action: "auth.login_failed",
      entity: "user",
      entityId: user.id,
      username: user.username,
      detail: "Account is not active",
    });
    return { ok: false, message: "This account is not active. Ask a manager to switch it back on." };
  }

  clearFailedLogins(user.id);
  logActivity({
    action: "auth.login",
    entity: "user",
    entityId: user.id,
    username: user.username,
    detail: `Role: ${user.role_slug}`,
  });

  return { ok: true, message: "Signed in.", userId: user.id, role: user.role_slug, fullName: user.full_name };
}
