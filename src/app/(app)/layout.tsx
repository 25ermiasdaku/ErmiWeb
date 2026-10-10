import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { MustChangePassword } from "@/components/must-change-password";
import { getCurrentUser } from "@/lib/auth";
import { linksFor } from "@/lib/nav-links";

export const dynamic = "force-dynamic";

/**
 * The signed-in shell: everything under (app) requires a session, and the
 * sidebar only shows links the account's role actually grants.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col lg:flex-row">
      <Nav
        links={linksFor(user.permissions)}
        user={{
          full_name: user.full_name,
          username: user.username,
          role_name: user.role_name,
          isAdmin: user.permissions.has("admin.access"),
        }}
      />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        {user.must_change_password === 1 && <MustChangePassword />}
        {children}
      </main>
    </div>
  );
}
