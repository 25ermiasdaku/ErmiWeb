"use server";

/**
 * Sign in, sign out, and the two things a user may do to their own account.
 *
 * Admin-side actions live in ./admin-actions.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";
import { get, run } from "./db";
import { logActivity } from "./activity";
import {
  clearFailedLogins,
  createSession,
  destroySession,
  isLocked,
  lockoutMinutes,
  recordFailedLogin,
  requireUser,
} from "./auth";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { attemptsLeft } from "./lockout";
import type { ActionState } from "./action-state";

/**
 * A well-formed but never-matching digest. Verifying against it when the
 * username is unknown makes a wrong username cost the same wall-clock time
 * as a wrong password, so the form cannot be used to enumerate accounts.
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

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Only allow redirects that stay on this origin. */
function safeNext(raw: string): string {
  return /^\/(?!\/)/.test(raw) ? raw : "/";
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = str(formData, "username").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(str(formData, "next"));

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
    logActivity({ action: "auth.login_failed", entity: "user", detail: `Unknown username "${username}"` });
    return { ok: false, message: "Incorrect username or password." };
  }

  // Everything below this line is only reachable with the right password, so
  // it is safe to be specific about the account's state.
  if (!ok) {
    recordFailedLogin(user.id, user.failed_logins);
    const remaining = attemptsLeft(user.failed_logins + 1);
    logActivity({ action: "auth.login_failed", entity: "user", entityId: user.id, username: user.username, detail: `Wrong password for "${user.username}"` });
    return {
      ok: false,
      message:
        remaining > 0
          ? `Incorrect username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
          : "Incorrect username or password. This account is now locked for 15 minutes.",
    };
  }

  if (isLocked(user)) {
    return { ok: false, message: `Too many failed attempts. Try again in ${lockoutMinutes(user)} minute(s).` };
  }

  if (user.is_active !== 1 || user.deleted_at) {
    logActivity({ action: "auth.login_failed", entity: "user", entityId: user.id, username: user.username, detail: "Account is not active" });
    return { ok: false, message: "This account is not active. Ask a manager to switch it back on." };
  }

  clearFailedLogins(user.id);
  await createSession(user.id);
  logActivity({ action: "auth.login", entity: "user", entityId: user.id, username: user.username, detail: `Role: ${user.role_slug}` });

  // safeNext() has already guaranteed this is a same-origin path.
  redirect(next as Route);
}

export async function logoutAction(): Promise<void> {
  const user = await requireUser();
  await destroySession();
  logActivity({ action: "auth.logout", entity: "user", entityId: user.id, username: user.username });
  redirect("/login");
}

// ---------------------------------------------------------------
// Self-service
// ---------------------------------------------------------------

const EDITABLE_PROFILE_FIELDS = ["full_name", "email"] as const;

export async function updateOwnProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const fieldErrors: Record<string, string> = {};

  if (fullName.length < 2) fieldErrors.full_name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  const taken = get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ? AND id <> ?", email, user.id);
  if (taken) return { ok: false, message: "Another account already uses that email.", fieldErrors: { email: "Already in use." } };

  // Only these two columns are writable from here. Role, active state and
  // username are admin territory and are not read from the form at all.
  run("UPDATE users SET full_name = ?, email = ?, updated_at = datetime('now') WHERE id = ?", fullName, email, user.id);
  logActivity({
    action: "user.update",
    entity: "user",
    entityId: user.id,
    userId: user.id,
    username: user.username,
    detail: `Self-service profile update (${EDITABLE_PROFILE_FIELDS.join(", ")})`,
  });

  return { ok: true, message: "Profile updated." };
}

export async function changeOwnPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const fieldErrors: Record<string, string> = {};

  if (!current) fieldErrors.current_password = "Enter your current password.";
  if (next !== confirm) fieldErrors.confirm_password = "The two new passwords do not match.";

  const problem = passwordProblem(next, { username: user.username, fullName: user.full_name, email: user.email });
  if (problem) fieldErrors.new_password = problem;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return { ok: false, message: "Your current password is not correct.", fieldErrors: { current_password: "Not correct." } };
  }

  if (await verifyPassword(next, row.password_hash)) {
    return { ok: false, message: "The new password matches your current one.", fieldErrors: { new_password: "Choose a different password." } };
  }

  run(
    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
    await hashPassword(next),
    user.id,
  );
  logActivity({ action: "auth.password_changed", entity: "user", entityId: user.id, userId: user.id, username: user.username });

  return { ok: true, message: "Password changed." };
}
