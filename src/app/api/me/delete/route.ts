import { closeAccount } from "@/lib/account-close";
import { json, readJson, requireApiUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Erase the signed-in account permanently.
 *
 * The bearer token proves who is signed in; the password in the body proves the
 * person at the keyboard really is them, exactly as the web form requires. Only
 * the caller's own row is touched — `closeAccount` never takes an id from the
 * request, so nobody can delete somebody else's account through here.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = requireApiUser(req);
  if ("deny" in auth) return auth.deny;

  const body = await readJson(req);
  const password = typeof body?.password === "string" ? body.password : "";

  const result = await closeAccount(auth.user, password);
  if (!result.ok) {
    // Same envelope as /api/auth/register: a message plus per-field errors when
    // the caller can fix it inline. A wrong password is 422, anything else 400.
    return json(
      { error: result.message, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}) },
      { status: result.fieldErrors?.password ? 422 : 400 },
    );
  }

  return json({ ok: true, message: result.message });
}