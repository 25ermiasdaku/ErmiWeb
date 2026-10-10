/**
 * Helpers for the JSON API the native app talks to.
 *
 * The API is a thin, read-mostly skin over the same lib functions the web uses,
 * so the two never diverge on pricing, stock or loyalty. It authenticates with
 * `Authorization: Bearer <token>` (issued by `/api/auth/login` and
 * `/api/auth/register`) rather than the web's httpOnly cookie, because a native
 * client has no cookie jar.
 */
import { get } from "./db";
import { userForToken, type SessionUser } from "./auth";

export type ApiUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  memberId: number | null;
  points: number;
};

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/** The best-guess client IP for a request, for the session row. */
export function ipFrom(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Read and parse a JSON body, or return null when it is not an object. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** The account, shaped for the app: camelCase, points included. */
export function apiUserById(userId: number): ApiUser | null {
  const row = get<{
    id: number;
    username: string;
    email: string;
    full_name: string;
    role_slug: string;
    member_id: number | null;
    points: number | null;
  }>(
    `SELECT u.id, u.username, u.email, u.full_name, r.slug AS role_slug,
            u.member_id, m.points
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN members m ON m.id = u.member_id
      WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = 1`,
    userId,
  );
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role_slug,
    memberId: row.member_id,
    points: row.points ?? 0,
  };
}

export function apiUserFrom(user: SessionUser): ApiUser | null {
  return apiUserById(user.id);
}

/** Resolve the caller, or a 401 response to return as-is. */
export function requireApiUser(req: Request): { user: SessionUser } | { deny: Response } {
  const header = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? "";
  const user = token ? userForToken(token) : null;
  if (!user) return { deny: fail("Sign in to continue.", 401) };
  return { user };
}

/** Resolve the caller and check a permission, or a 401/403 to return as-is. */
export function requireApiPermission(
  req: Request,
  key: string,
): { user: SessionUser } | { deny: Response } {
  const header = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? "";
  const user = token ? userForToken(token) : null;
  if (!user) return { deny: fail("Sign in to continue.", 401) };
  if (!user.permissions.has(key)) return { deny: fail("Your account cannot do that.", 403) };
  return { user };
}
