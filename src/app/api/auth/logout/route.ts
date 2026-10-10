import { destroySessionToken } from "@/lib/auth";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Invalidate the bearer token that made this request. */
export async function POST(req: Request): Promise<Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? "";
  destroySessionToken(token);
  return json({ ok: true });
}
