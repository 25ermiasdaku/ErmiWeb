import { createSessionToken } from "@/lib/auth";
import { apiUserById, fail, ipFrom, json, readJson } from "@/lib/api";
import { registerCustomer } from "@/lib/register";

export const dynamic = "force-dynamic";

/** Create a customer account and hand back a session token. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  if (!body) return fail("Expected a JSON object.");

  const result = await registerCustomer({
    fullName: String(body.fullName ?? ""),
    email: String(body.email ?? ""),
    phone: body.phone ? String(body.phone) : "",
    password: String(body.password ?? ""),
  });

  if (!result.ok || result.userId === undefined) {
    return json({ error: result.message, fieldErrors: result.fieldErrors }, { status: 422 });
  }

  const token = createSessionToken(result.userId, {
    userAgent: req.headers.get("user-agent") ?? "",
    ip: ipFrom(req),
  });

  return json({ token, user: apiUserById(result.userId) }, { status: 201 });
}
