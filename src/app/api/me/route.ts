import { apiUserFrom, json, requireApiUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The signed-in account, with its current points balance. */
export async function GET(req: Request): Promise<Response> {
  const auth = requireApiUser(req);
  if ("deny" in auth) return auth.deny;
  return json({ user: apiUserFrom(auth.user) });
}
