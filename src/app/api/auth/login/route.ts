import { createSessionToken } from "@/lib/auth";
import { apiUserById, fail, ipFrom, json, readJson } from "@/lib/api";
import { authenticate } from "@/lib/authenticate";

export const dynamic = "force-dynamic";

/** Exchange a username and password for a bearer token. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return fail("Expected a JSON object.");

  const result = await authenticate(String(body.username ?? ""), String(body.password ?? ""));
  if (!result.ok || result.userId === undefined) {
    return json({ error: result.message }, { status: 401 });
  }

  const token = createSessionToken(result.userId, {
    userAgent: req.headers.get("user-agent") ?? "",
    ip: ipFrom(req),
  });

  return json({ token, user: apiUserById(result.userId) });
}
