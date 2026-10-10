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
import { createSession, destroySession, requireUser } from "./auth";
import { authenticate } from "./authenticate";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { registerCustomer } from "./register";
import { closeAccount } from "./account-close";
import type { ActionState } from "./action-state";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Only allow redirects that stay on this origin. */
function safeNext(raw: string): string {
  return /^\/(?!\/)/.test(raw) ? raw : "/";
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const next = safeNext(str(formData, "next"));
  const result = await authenticate(
    str(formData, "username"),
    String(formData.get("password") ?? ""),
  );

  if (!result.ok || result.userId === undefined) {
    return { ok: false, message: result.message };
  }

  await createSession(result.userId);

  // A customer lands on their orders; staff land on the dashboard. An explicit
  // same-origin `next` from safeNext() still wins over this default.
  const fallback: Route = result.role === "customer" ? "/my-orders" : "/dashboard";
  const target = next === "/" ? fallback : (next as Route);

  redirect(target);
}

/**
 * Create a customer account from the public sign-up form, then sign in.
 *
 * Like `loginAction`, this must not require a session — there isn't one yet.
 * The account is created and signed in as one flow so a new customer lands
 * straight on the ordering page instead of having to type the same details
 * again. `registerCustomer` does the validation and the write.
 */
export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await registerCustomer({
    fullName: str(formData, "full_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
  });

  if (!result.ok || result.userId === undefined) {
    return { ok: false, message: result.message, fieldErrors: result.fieldErrors };
  }

  await createSession(result.userId);
  redirect("/my-orders");
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

/**
 * Permanently erase the signed-in account.
 *
 * The web form doubles up: type your username, then re-enter the password. The
 * password is the real check (in `closeAccount`, shared with the mobile API) —
 * a session on a shared computer must not be enough to erase an account. The
 * last-owner guard also lives in `closeAccount`. On success the cookie session
 * is dropped and the person lands on the public homepage.
 */
export async function deleteMyAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  if (str(formData, "confirm_username") !== user.username) {
    return {
      ok: false,
      message: "The username did not match, so nothing was erased.",
      fieldErrors: { confirm_username: "Did not match." },
    };
  }

  const result = await closeAccount(user, String(formData.get("password") ?? ""));
  if (!result.ok) {
    return { ok: false, message: result.message, fieldErrors: result.fieldErrors };
  }

  // The user row is gone, so the session row was already deleted by the FK
  // cascade. Dropping the cookie keeps this tab from looking signed in anyway.
  await destroySession();
  redirect("/");
}
