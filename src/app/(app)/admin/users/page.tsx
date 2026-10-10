import { PageHeader, Stat } from "@/components/ui";
import { CreateUserForm } from "@/components/user-forms";
import { UserList, type Panel } from "@/components/user-list";
import { gate } from "@/lib/auth";
import { getRoles, getUsers } from "@/lib/admin-queries";
import { isLocked } from "@/lib/lockout";

export const dynamic = "force-dynamic";

const PANELS: Panel[] = ["edit", "password", "archive", "erase"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; id?: string }>;
}) {
  const { user, denied } = await gate("users.view");
  if (denied) return denied;

  const perms = user!.permissions;
  const users = getUsers();
  const roles = getRoles();
  const { panel, id } = await searchParams;

  // Only honour a panel the viewer is allowed to open, so a hand-typed URL
  // cannot surface the erase form to a role without users.delete.
  const requested = (panel ?? "") as Panel;
  const openPanel = PANELS.includes(requested) ? requested : null;
  const openId = Number(id ?? 0);

  const live = users.filter((u) => !u.deleted_at);
  const archived = users.filter((u) => u.deleted_at);
  const locked = users.filter((u) => isLocked(u));
  const sessions = users.reduce((n, u) => n + u.session_count, 0);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Every account that can sign in. Archiving keeps the history; erasing does not."
        actions={perms.has("users.create") ? <CreateUserForm roles={roles} /> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Accounts"
          value={users.length}
          hint={`${live.length} active · ${archived.length} archived`}
        />
        <Stat
          label="Live sessions"
          value={sessions}
          hint={`${live.filter((u) => u.session_count > 0).length} account(s) signed in`}
        />
        <Stat
          label="Locked out"
          value={locked.length}
          tone={locked.length > 0 ? "warn" : "good"}
          hint={locked.length > 0 ? "Too many failed sign-ins" : "None"}
        />
        <Stat
          label="Roles in use"
          value={new Set(live.map((u) => u.role_id)).size}
          hint={`${roles.length} defined`}
        />
      </div>

      {perms.has("users.edit") ? (
        live.length === 0 ? (
          <p className="text-[0.8125rem] muted">No accounts yet — create the first one.</p>
        ) : (
          <UserList
            users={live}
            archived={archived}
            roles={roles}
            selfId={user!.id}
            canEdit
            canDelete={perms.has("users.delete")}
            openPanel={openPanel}
            openId={openId}
          />
        )
      ) : (
        <div className="card p-4">
          <h2 className="text-sm font-semibold">Read only</h2>
          <p className="mt-1 text-[0.8125rem] muted">
            You can see the staff list, but changing an account needs the{" "}
            <code className="font-mono text-xs">users.edit</code> permission.
          </p>
          <ul className="mt-3 divide-y">
            {live.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-[0.8125rem] font-medium">{u.full_name}</span>
                <code className="font-mono text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  {u.username}
                </code>
                <span className="chip" style={{ backgroundColor: "var(--surface-sunken)" }}>
                  {u.role_name}
                </span>
                <span
                  className="ml-auto text-[0.6875rem]"
                  style={{ color: u.is_active === 1 ? undefined : "var(--text-faint)" }}
                >
                  {u.is_active === 1 ? "active" : "switched off"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
