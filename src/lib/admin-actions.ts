"use server";

/**
 * Everything an owner or manager can do to accounts, roles and settings.
 *
 * Each action re-checks its own permission and logs to the activity trail.
 * Several of them guard against an admin locking themselves out — you cannot
 * deactivate or erase your own account, and the last owner cannot be
 * demoted, disabled or deleted.
 */
import { revalidatePath } from "next/cache";
import { all, get, run, tx } from "./db";
import { logActivity } from "./activity";
import { requirePermission } from "./auth";
import { hashPassword, passwordProblem } from "./password";
import { ALL_PERMISSION_KEYS, permissionDef } from "./permissions";
import { SETTING_DEFS, setSetting } from "./settings";
import type { ActionState } from "./action-state";

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAccount(input: {
  username: string;
  email: string;
  fullName: string;
  roleId: number;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!USERNAME_RE.test(input.username)) {
    errors.username = "3-32 characters: lowercase letters, digits, dot, dash or underscore.";
  }
  if (!EMAIL_RE.test(input.email)) errors.email = "Enter a valid email address.";
  if (input.fullName.length < 2) errors.full_name = "Enter their name.";
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) errors.role_id = "Choose a role.";
  return errors;
}

// ---------------------------------------------------------------
// Create user
// ---------------------------------------------------------------

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.create");

  const username = str(formData, "username").toLowerCase();
  const email = str(formData, "email").toLowerCase();
  const fullName = str(formData, "full_name");
  const jobTitle = str(formData, "job_title");
  const roleId = Number(formData.get("role_id") ?? 0);
  const password = String(formData.get("password") ?? "");

  const fieldErrors = validateAccount({ username, email, fullName, roleId });
  const pwProblem = passwordProblem(password, { username, fullName, email });
  if (pwProblem) fieldErrors.password = pwProblem;
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  if (get("SELECT id FROM users WHERE lower(username) = ?", username)) {
    return { ok: false, message: "That username is taken.", fieldErrors: { username: "Already in use." } };
  }
  if (get("SELECT id FROM users WHERE lower(email) = ?", email)) {
    return { ok: false, message: "That email is already on an account.", fieldErrors: { email: "Already in use." } };
  }
  const role = get<{ id: number; name: string }>("SELECT id, name FROM roles WHERE id = ?", roleId);
  if (!role) return { ok: false, message: "That role no longer exists.", fieldErrors: { role_id: "Unknown role." } };

  const result = run(
    `INSERT INTO users (username, email, full_name, password_hash, role_id, job_title, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    username,
    email,
    fullName,
    await hashPassword(password),
    roleId,
    jobTitle,
  );

  logActivity({
    action: "user.create",
    entity: "user",
    entityId: result.lastInsertRowid,
    userId: admin.id,
    username: admin.username,
    detail: `${username} (${fullName}) as ${role.name}`,
  });
  refresh("/admin/users");
  return { ok: true, message: `${fullName} can now sign in as "${username}".` };
}

// ---------------------------------------------------------------
// Edit user
// ---------------------------------------------------------------

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.edit");

  const userId = Number(formData.get("user_id") ?? 0);
  const target = get<{
    id: number; username: string; full_name: string; email: string;
    role_id: number; role_slug: string; is_active: number; deleted_at: string | null;
  }>(
    `SELECT u.id, u.username, u.full_name, u.email, u.role_id, u.is_active, u.deleted_at, r.slug AS role_slug
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    userId,
  );
  if (!target) return { ok: false, message: "That account no longer exists." };

  const fullName = str(formData, "full_name");
  const email = str(formData, "email").toLowerCase();
  const jobTitle = str(formData, "job_title");
  const roleId = Number(formData.get("role_id") ?? 0);

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.full_name = "Enter their name.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!Number.isInteger(roleId) || roleId <= 0) fieldErrors.role_id = "Choose a role.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  if (get("SELECT id FROM users WHERE lower(email) = ? AND id <> ?", email, userId)) {
    return { ok: false, message: "That email is already on another account.", fieldErrors: { email: "Already in use." } };
  }
  const role = get<{ id: number; name: string; slug: string }>("SELECT id, name, slug FROM roles WHERE id = ?", roleId);
  if (!role) return { ok: false, message: "That role no longer exists.", fieldErrors: { role_id: "Unknown role." } };

  // The last owner keeps their role. Without this an owner could demote
  // themselves and leave nobody able to manage roles or accounts.
  if (
    target.role_slug === "owner" &&
    role.slug !== "owner" &&
    isLastOwner(target.id)
  ) {
    return { ok: false, message: "This is the only owner. Promote someone else first, or keep this account as an owner." };
  }

  run(
    "UPDATE users SET full_name = ?, email = ?, job_title = ?, role_id = ?, updated_at = datetime('now') WHERE id = ?",
    fullName,
    email,
    jobTitle,
    roleId,
    userId,
  );

  // A role change takes effect on their next request; drop cached sessions so
  // an open tab does not keep the old permissions.
  if (roleId !== target.role_id) run("DELETE FROM sessions WHERE user_id = ?", userId);

  const changes: string[] = [];
  if (fullName !== target.full_name) changes.push("name");
  if (email !== target.email) changes.push("email");
  if (roleId !== target.role_id) changes.push(`role → ${role.name}`);

  logActivity({
    action: "user.update",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `${target.username}: ${changes.length ? changes.join(", ") : "no visible change"}`,
  });
  refresh("/admin/users");
  return { ok: true, message: `${fullName} updated.` };
}

// ---------------------------------------------------------------
// Activate / deactivate
// ---------------------------------------------------------------

/** How many active owners exist, optionally ignoring one id. */
function ownerCount(ignoreId?: number): number {
  return get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.slug = 'owner' AND u.is_active = 1 AND u.deleted_at IS NULL AND u.id <> ?`,
    ignoreId ?? -1,
  )!.n;
}

function isLastOwner(userId: number): boolean {
  return ownerCount(userId) === 0;
}

export async function setUserActiveAction(
  userId: number,
  active: boolean,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePermission("users.edit");
  const target = get<{ id: number; username: string; role_slug: string; is_active: number }>(
    `SELECT u.id, u.username, u.is_active, r.slug AS role_slug
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    userId,
  );
  if (!target) return { ok: false, message: "That account no longer exists." };
  if (target.id === admin.id) return { ok: false, message: "You cannot switch off your own account." };
  if (target.is_active === (active ? 1 : 0)) {
    return { ok: false, message: `Already ${active ? "active" : "inactive"}.` };
  }
  if (!active && target.role_slug === "owner" && isLastOwner(target.id)) {
    return { ok: false, message: "This is the only active owner. Switch on another owner first." };
  }

  run("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?", active ? 1 : 0, userId);
  // A deactivated account must lose its live sessions immediately.
  if (!active) run("DELETE FROM sessions WHERE user_id = ?", userId);

  logActivity({
    action: active ? "user.activate" : "user.deactivate",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `${target.username} ${active ? "reactivated" : "deactivated; sessions revoked"}`,
  });
  refresh("/admin/users", "/admin");
  return { ok: true, message: `${target.username} is now ${active ? "active" : "inactive"}.` };
}

// ---------------------------------------------------------------
// Delete: soft by default, erase as an escape hatch
// ---------------------------------------------------------------

export async function softDeleteUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission("users.delete");
  const userId = Number(formData.get("user_id") ?? 0);
  const target = get<{ id: number; username: string; role_slug: string; deleted_at: string | null }>(
    `SELECT u.id, u.username, u.deleted_at, r.slug AS role_slug
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    userId,
  );
  if (!target) return { ok: false, message: "That account no longer exists." };
  if (target.id === admin.id) return { ok: false, message: "You cannot delete your own account." };
  if (target.role_slug === "owner" && isLastOwner(target.id)) {
    return { ok: false, message: "This is the only owner. Promote someone else before deleting it." };
  }
  if (target.deleted_at) return { ok: false, message: "That account is already deleted." };

  tx(() => {
    run("UPDATE users SET is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", userId);
    run("DELETE FROM sessions WHERE user_id = ?", userId);
  });

  logActivity({
    action: "user.soft_delete",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `${target.username} archived — orders and log entries keep their name`,
  });
  refresh("/admin/users", "/admin");
  return { ok: true, message: `${target.username} archived. Their history is intact.` };
}

export async function restoreUserAction(userId: number): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePermission("users.delete");
  const target = get<{ id: number; username: string; deleted_at: string | null }>(
    "SELECT id, username, deleted_at FROM users WHERE id = ?",
    userId,
  );
  if (!target) return { ok: false, message: "That account no longer exists." };
  if (!target.deleted_at) return { ok: false, message: "That account is not archived." };

  run("UPDATE users SET deleted_at = NULL, is_active = 1, updated_at = datetime('now') WHERE id = ?", userId);
  logActivity({
    action: "user.activate",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `${target.username} restored from the archive`,
  });
  refresh("/admin/users", "/admin");
  return { ok: true, message: `${target.username} restored and switched on.` };
}

/**
 * Irreversible. The caller must type the exact username. The activity row is
 * kept (its user_id goes NULL, the username snapshot stays) so the trail
 * still explains what happened.
 */
export async function eraseUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.delete");
  const userId = Number(formData.get("user_id") ?? 0);
  const typed = str(formData, "confirm_username");

  const target = get<{ id: number; username: string; role_slug: string }>(
    `SELECT u.id, u.username, r.slug AS role_slug
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    userId,
  );
  if (!target) return { ok: false, message: "That account no longer exists." };
  if (target.id === admin.id) return { ok: false, message: "You cannot erase your own account." };
  if (typed !== target.username) {
    return { ok: false, message: "The username did not match, so nothing was erased." };
  }
  if (target.role_slug === "owner" && isLastOwner(target.id)) {
    return { ok: false, message: "This is the only owner. Promote someone else before erasing it." };
  }

  run("DELETE FROM users WHERE id = ?", userId);

  logActivity({
    action: "user.erase",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `${target.username} erased permanently`,
  });
  refresh("/admin/users", "/admin", "/admin/logs");
  return { ok: true, message: `${target.username} was erased. This cannot be undone.` };
}

// ---------------------------------------------------------------
// Passwords and lockouts
// ---------------------------------------------------------------

export async function resetUserPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission("users.edit");
  const userId = Number(formData.get("user_id") ?? 0);
  const password = String(formData.get("password") ?? "");

  const target = get<{ id: number; username: string; full_name: string; email: string }>(
    "SELECT id, username, full_name, email FROM users WHERE id = ?",
    userId,
  );
  if (!target) return { ok: false, message: "That account no longer exists." };

  const problem = passwordProblem(password, { username: target.username, fullName: target.full_name, email: target.email });
  if (problem) return { ok: false, message: problem, fieldErrors: { password: problem } };

  run(
    "UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?",
    await hashPassword(password),
    userId,
  );
  // Force them through the change-password screen on their next sign-in.
  run("DELETE FROM sessions WHERE user_id = ?", userId);

  logActivity({
    action: "user.password_reset",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `Temporary password set for ${target.username}; they must change it at next sign-in`,
  });
  refresh("/admin/users");
  return { ok: true, message: `Password reset for ${target.username}. They must change it at next sign-in.` };
}

export async function unlockUserAction(userId: number): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePermission("users.edit");
  const target = get<{ id: number; username: string }>("SELECT id, username FROM users WHERE id = ?", userId);
  if (!target) return { ok: false, message: "That account no longer exists." };

  run("UPDATE users SET failed_logins = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?", userId);
  logActivity({
    action: "user.update",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `Lockout cleared for ${target.username}`,
  });
  refresh("/admin/users");
  return { ok: true, message: `${target.username} unlocked.` };
}

export async function revokeUserSessionsAction(userId: number): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePermission("users.edit");
  const target = get<{ id: number; username: string }>("SELECT id, username FROM users WHERE id = ?", userId);
  if (!target) return { ok: false, message: "That account no longer exists." };

  const { changes } = run("DELETE FROM sessions WHERE user_id = ?", userId);
  logActivity({
    action: "user.update",
    entity: "user",
    entityId: userId,
    userId: admin.id,
    username: admin.username,
    detail: `Revoked ${changes} session(s) for ${target.username}`,
  });
  refresh("/admin/users");
  return { ok: true, message: `Signed ${target.username} out of ${changes} session(s).` };
}

// ---------------------------------------------------------------
// Roles
// ---------------------------------------------------------------

export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("roles.manage");
  const name = str(formData, "name");
  const description = str(formData, "description");

  if (name.length < 2) return { ok: false, message: "Give the role a name.", fieldErrors: { name: "Too short." } };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
  if (!slug) return { ok: false, message: "That name has no usable characters.", fieldErrors: { name: "Needs letters or digits." } };
  if (get("SELECT id FROM roles WHERE slug = ?", slug)) {
    return { ok: false, message: "A role with that name already exists.", fieldErrors: { name: "Already taken." } };
  }

  const result = run("INSERT INTO roles (slug, name, description) VALUES (?, ?, ?)", slug, name, description);
  // A brand new role starts with no permissions: an owner opts in to what it
  // can do, so a typo cannot silently grant everything.
  logActivity({
    action: "role.create",
    entity: "role",
    entityId: result.lastInsertRowid,
    userId: admin.id,
    username: admin.username,
    detail: `Created role "${name}" with no permissions yet`,
  });
  refresh("/admin/roles");
  return { ok: true, message: `Role "${name}" created. Now tick what it can do.` };
}

export async function updateRolePermissionsAction(
  roleId: number,
  permissionKeys: string[],
): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePermission("roles.manage");

  const role = get<{ id: number; name: string; slug: string; is_system: number }>(
    "SELECT id, name, slug, is_system FROM roles WHERE id = ?",
    roleId,
  );
  if (!role) return { ok: false, message: "That role no longer exists." };

  // Ignore anything not in the catalogue, so a crafted request cannot invent
  // a permission.
  const wanted = new Set(permissionKeys.filter((k) => ALL_PERMISSION_KEYS.includes(k)));
  const before = all<{ key: string }>(
    `SELECT p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
    roleId,
  ).map((r) => r.key);
  const after = [...wanted];

  const granted = after.filter((k) => !before.includes(k));
  const revoked = before.filter((k) => !wanted.has(k));

  // An owner role must keep enough power to manage the system, otherwise the
  // last owner could strip itself and no one could put it back.
  if (role.slug === "owner") {
    const essential = ALL_PERMISSION_KEYS.filter(
      (k) => k === "roles.manage" || k === "users.delete" || k === "admin.access",
    );
    const missing = essential.filter((k) => !wanted.has(k));
    if (missing.length > 0) {
      return {
        ok: false,
        message: `The owner role must keep: ${missing.map((k) => permissionDef(k)?.label ?? k).join(", ")}.`,
      };
    }
  }

  tx(() => {
    run("DELETE FROM role_permissions WHERE role_id = ?", roleId);
    for (const key of after) {
      const perm = get<{ id: number }>("SELECT id FROM permissions WHERE key = ?", key);
      if (perm) {
        run("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", roleId, perm.id);
      }
    }
    // Holders get the new permissions on their next request.
    run("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role_id = ?)", roleId);
  });

  logActivity({
    action: "role.update",
    entity: "role",
    entityId: roleId,
    userId: admin.id,
    username: admin.username,
    detail: `${role.name}: +${granted.length} / -${revoked.length} permission(s)${granted.length ? ` (${granted.join(", ")})` : ""}`,
  });
  refresh("/admin/roles", "/admin/users");
  return { ok: true, message: `${role.name} now grants ${after.length} permission(s).` };
}

export async function deleteRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("roles.manage");
  const roleId = Number(formData.get("role_id") ?? 0);
  const role = get<{ id: number; name: string; is_system: number; slug: string }>(
    "SELECT id, name, slug, is_system FROM roles WHERE id = ?",
    roleId,
  );
  if (!role) return { ok: false, message: "That role no longer exists." };
  if (role.is_system === 1) return { ok: false, message: `"${role.name}" is a system role and cannot be deleted.` };

  const holders = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role_id = ?", roleId)!.n;
  if (holders > 0) {
    return { ok: false, message: `${holders} account(s) still use "${role.name}". Move them to another role first.` };
  }

  run("DELETE FROM roles WHERE id = ?", roleId);
  logActivity({
    action: "role.delete",
    entity: "role",
    entityId: roleId,
    userId: admin.id,
    username: admin.username,
    detail: `Deleted role "${role.name}"`,
  });
  refresh("/admin/roles");
  return { ok: true, message: `Role "${role.name}" deleted.` };
}

// ---------------------------------------------------------------
// Settings
// ---------------------------------------------------------------

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("settings.manage");
  const fieldErrors: Record<string, string> = {};
  const accepted: string[] = [];

  for (const def of SETTING_DEFS) {
    const raw = str(formData, def.key);
    if (def.type === "text") {
      const value = raw.slice(0, 120);
      if (!value && def.key !== "cafe_tagline") {
        fieldErrors[def.key] = "Cannot be empty.";
        continue;
      }
      setSetting(def.key, value);
      accepted.push(def.key);
    } else {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        fieldErrors[def.key] = "Enter a number.";
        continue;
      }
      if (def.min !== undefined && parsed < def.min) {
        fieldErrors[def.key] = `Must be at least ${def.min}.`;
        continue;
      }
      if (def.max !== undefined && parsed > def.max) {
        fieldErrors[def.key] = `Must be at most ${def.max}.`;
        continue;
      }
      setSetting(def.key, String(parsed));
      accepted.push(def.key);
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  logActivity({
    action: "settings.update",
    entity: "settings",
    userId: admin.id,
    username: admin.username,
    detail: `Saved ${accepted.length} setting(s): ${accepted.join(", ")}`,
  });
  // The till reads tax and points live, so those pages need to re-render.
  refresh("/admin/settings", "/menu", "/", "/orders");
  return { ok: true, message: "Settings saved." };
}

// ---------------------------------------------------------------
// Session hygiene
// ---------------------------------------------------------------

export async function purgeExpiredSessionsAction(): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePermission("admin.access");
  const { changes } = run("DELETE FROM sessions WHERE expires_at < datetime('now')");
  logActivity({
    action: "user.update",
    entity: "session",
    userId: admin.id,
    username: admin.username,
    detail: `Purged ${changes} expired session(s)`,
  });
  refresh("/admin");
  return { ok: true, message: `Removed ${changes} expired session(s).` };
}
