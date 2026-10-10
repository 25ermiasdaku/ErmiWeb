/**
 * Account lockout arithmetic, kept free of `next/headers` and JSX so both the
 * server (which owns the session) and the admin UI can use it.
 *
 * SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS" in UTC, so the
 * comparison has to normalise to that shape rather than to ISO-8601 with a T.
 */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** UTC now, in SQLite's textual timestamp format. */
export function sqlNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().replace("T", " ").slice(0, 19);
}

export function isLocked(user: { locked_until: string | null }): boolean {
  if (!user.locked_until) return false;
  return user.locked_until > sqlNow();
}

/** Whole minutes until the lock lifts, at least 1 while it is still held. */
export function lockoutMinutes(user: { locked_until: string | null }): number {
  if (!user.locked_until) return 0;
  const until = new Date(user.locked_until.replace(" ", "T") + "Z").getTime();
  return Math.max(1, Math.ceil((until - Date.now()) / 60_000));
}

/** Attempts remaining before the account locks. */
export function attemptsLeft(failed: number): number {
  return Math.max(0, MAX_FAILED_LOGINS - failed);
}
