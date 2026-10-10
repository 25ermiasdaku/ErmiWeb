import { gate } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The admin area inherits the signed-in shell from the (app) group. This
 * layout only adds the `admin.access` check, so a role without it gets a
 * clear explanation instead of a blank page. Each page inside still re-checks
 * its own finer-grained permission.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { denied } = await gate("admin.access");
  if (denied) return denied;
  return <>{children}</>;
}
