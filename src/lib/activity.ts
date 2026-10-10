/**
 * The activity log — an append-only record of who did what.
 *
 * `username` is stored as a snapshot alongside the id, so the trail still
 * reads correctly after an account is erased. Writing is best-effort: a
 * logging failure must never roll back the business operation that
 * triggered it.
 */
import { run } from "./db";

export type ActivityInput = {
  action: string;
  entity?: string;
  entityId?: string | number | null;
  detail?: string;
  userId?: number | null;
  username?: string;
};

export function logActivity(input: ActivityInput): void {
  try {
    run(
      `INSERT INTO activity_log (user_id, username, action, entity, entity_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, '')`,
      input.userId ?? null,
      input.username ?? "",
      input.action,
      input.entity ?? "",
      input.entityId === null || input.entityId === undefined ? "" : String(input.entityId),
      (input.detail ?? "").slice(0, 400),
    );
  } catch {
    // The audit trail is important but not worth failing a sale over.
  }
}

/** Logs the current user without threading their id through every call site. */
export async function logAs(
  user: { id: number; username: string } | null,
  input: Omit<ActivityInput, "userId" | "username">,
): Promise<void> {
  logActivity({ ...input, userId: user?.id ?? null, username: user?.username ?? "" });
}

export { actionLabel, actionTone } from "./activity-labels";
