import { PageHeader, Stat } from "@/components/ui";
import { CreateRoleForm } from "@/components/role-form";
import { RoleMatrix } from "@/components/role-matrix";
import { gate } from "@/lib/auth";
import { getRolePermissionMap, getRoles, getUsers } from "@/lib/admin-queries";
import { PERMISSIONS } from "@/lib/permissions";
import { pluralize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const { user, denied } = await gate("roles.view");
  if (denied) return denied;

  const perms = user!.permissions;
  const roles = getRoles();
  const map = getRolePermissionMap();
  const users = getUsers();

  // Maps do not survive the server/client boundary; flatten to a plain object.
  const initial: Record<number, string[]> = {};
  for (const r of roles) initial[r.id] = map.get(r.id) ?? [];

  const unassigned = roles.filter((r) => r.permission_count === 0);
  const custom = roles.filter((r) => r.is_system === 0);

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Each account has exactly one role. What that role grants is what its holders can do."
        actions={perms.has("roles.manage") ? <CreateRoleForm /> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Roles" value={roles.length} hint={`${custom.length} custom`} />
        <Stat
          label="Permissions"
          value={PERMISSIONS.length}
          hint={`${PERMISSIONS.length} keys across ${new Set(PERMISSIONS.map((p) => p.category)).size} areas`}
        />
        <Stat
          label="Accounts assigned"
          value={users.filter((u) => !u.deleted_at).length}
          hint="Every account needs a role"
        />
        <Stat
          label="Roles with no access"
          value={unassigned.length}
          tone={unassigned.length > 0 ? "warn" : "good"}
          hint={unassigned.length > 0 ? "Holders can sign in but see nothing" : "All roles are usable"}
        />
      </div>

      {roles.length === 0 ? (
        <p className="text-[0.8125rem] muted">
          No roles yet. Run <code className="font-mono">npm run db:seed</code> to install the four
          system roles, or create one above.
        </p>
      ) : (
        <RoleMatrix
          roles={roles}
          initial={initial}
          selfRoleSlug={user!.role_slug}
          canEdit={perms.has("roles.manage")}
        />
      )}

      <section className="card mt-4 p-4">
        <h2 className="text-sm font-semibold">How this works</h2>
        <ul className="mt-2 space-y-1.5 text-[0.8125rem] muted">
          <li>
            An account holds <strong className="font-medium">one</strong> role. Changing that role
            changes everything the person can reach.
          </li>
          <li>
            Every page in the app is guarded. Without the permission you get a plain &ldquo;no
            access&rdquo; panel rather than a broken page.
          </li>
          <li>
            The hidden buttons are not the security boundary — every server action re-checks the
            permission itself, so a crafted request is refused even if the UI offered the control.
          </li>
          <li>
            Saving a role signs out everyone holding it, so a revoked permission takes effect
            immediately rather than at their next coffee.
          </li>
          <li>
            The <strong className="font-medium">Owner</strong> role always keeps{" "}
            {pluralize(3, "permission")} it needs to administer the system. Take those away from
            the last owner and nobody could put them back.
          </li>
        </ul>
      </section>
    </>
  );
}
