/**
 * Permanent self-service account deletion, shared by the web action
 * (`deleteMyAccountAction` in ./auth-actions) and the mobile API
 * (`POST /api/me/delete`).
 *
 * Deleting your own account is destructive and irreversible, so two proofs are
 * required before the write happens:
 *   1. The account's password. The session alone — which may be an open tab on
 *      a shared computer — is deliberately not enough.
 *   2. A "last owner" guard, mirroring the admin's guard: the final active
 *      owner cannot delete itself or the cafe loses its administrator.
 *
 * The write is one transaction: log the deletion while the row still exists,
 * delete the user row (sessions CASCADE, orders and activity log keep their
 * data with `placed_by`/`user_id` set NULL and the username snapshot intact),
 * then delete the linked loyalty member only when no other account still uses
 * it, so one person's self-service exit never takes somebody else's points
 * ledger down with it.
 *
 * Like `register.ts` and `my-order-service.ts`, this module is intentionally
 * NOT `"use server"`: the web action and the API each resolve the caller in
 * their own idiom (cookie vs bearer token) and pass the resolved `SessionUser`
 * in, so this code holds no boundary of its own.
 */
import { get, run, tx } from "./db";
import { logActivity } from "./activity";
import { verifyPassword } from "./password";
import type { SessionUser } from "./auth";

export type CloseResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

/** Active owners besides the one deleting — the same shape as the admin guard. */
function otherActiveOwnersCount(userId: number): number {
  return get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.slug = 'owner' AND u.is_active = 1 AND u.deleted_at IS NULL AND u.id <> ?`,
    userId,
  )!.n;
}

/**
 * The loyalty record a customer self-registers on can predate the account (a
 * barista enrolled them at the counter and they later created a login linked by
 * email). If another account still points at the same member row, leave it
 * standing — deleting it would destroy somebody else's points ledger.
 */
function memberStillUsed(memberId: number, deletingUserId: number): boolean {
  return (
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM users WHERE member_id = ? AND id <> ?",
      memberId,
      deletingUserId,
    )!.n > 0
  );
}

export async function closeAccount(user: SessionUser, password: string): Promise<CloseResult> {
  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!row) return { ok: false, message: "That account no longer exists." };

  if (!password) {
    return {
      ok: false,
      message: "Enter your password to confirm.",
      fieldErrors: { password: "Required." },
    };
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    return {
      ok: false,
      message: "That is not the right password.",
      fieldErrors: { password: "Not correct." },
    };
  }

  if (user.role_slug === "owner" && otherActiveOwnersCount(user.id) === 0) {
    return {
      ok: false,
      message: "You are the only owner. Promote another owner first, then delete this account.",
    };
  }

  const memberId = user.member_id ?? null;

  tx(() => {
    // Record who did this before the row disappears. The delete below turns
    // activity_log.user_id NULL; the username snapshot keeps the trail readable.
    logActivity({
      action: "user.self_delete",
      entity: "user",
      entityId: user.id,
      userId: user.id,
      username: user.username,
      detail: `Self-service: ${user.username} erased their own account permanently`,
    });

    // sessions ON DELETE CASCADE; orders.placed_by and activity_log.user_id are
    // ON DELETE SET NULL, so order and audit history survive, unlinked.
    run("DELETE FROM users WHERE id = ?", user.id);

    // The account's loyalty record and its ledger go with it (SET NULL on the
    // orders it posted to), unless another account still shares the member row.
    if (memberId !== null && !memberStillUsed(memberId, user.id)) {
      run("DELETE FROM members WHERE id = ?", memberId);
    }
  });

  return { ok: true, message: "Your account was erased. This cannot be undone." };
}