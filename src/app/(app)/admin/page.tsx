import Link from "next/link";
import type { Route } from "next";
import { Card, EmptyState, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { PurgeSessions } from "@/components/admin-widgets";
import { gate } from "@/lib/auth";
import { actionLabel } from "@/lib/activity";
import {
  getActivity,
  getActivityCounts,
  getActiveSessions,
  getRoles,
  getSalesByStaff,
  getSystemStats,
  getUsers,
} from "@/lib/admin-queries";
import { money, pluralize, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const { user, denied } = await gate("admin.access");
  if (denied) return denied;
  const perms = user!.permissions;

  const stats = getSystemStats();
  const users = getUsers();
  const roles = getRoles();
  const counts = getActivityCounts();
  const sessions = getActiveSessions();
  const recent = getActivity({ limit: 12 });
  const staffSales = getSalesByStaff(30);

  // Only offer the shortcuts this role can actually take.
  const shortcuts: Array<{ href: Route; label: string; icon: string; perm: string; note: string }> = (
    [
      { href: "/admin/users", label: "Manage staff", icon: "⚇", perm: "users.view", note: "Create, edit, deactivate or erase accounts" },
      { href: "/admin/roles", label: "Roles & permissions", icon: "⚿", perm: "roles.view", note: "Decide what each role may do" },
      { href: "/admin/reports", label: "System reports", icon: "◫", perm: "reports.view", note: "Trading, staff and system-wide figures" },
      { href: "/admin/settings", label: "System settings", icon: "⚒", perm: "settings.view", note: "Tax, loyalty rates and cafe details" },
      { href: "/admin/logs", label: "Activity log", icon: "≡", perm: "logs.view", note: "Who did what, and when" },
    ] satisfies Array<{ href: Route; label: string; icon: string; perm: string; note: string }>
  ).filter((s) => perms.has(s.perm));

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={`Signed in as ${user!.full_name} · ${user!.role_name}. Everything here is recorded in the activity log.`}
      />

      {/* Access control figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Staff accounts"
          value={stats.users}
          hint={`${stats.activeUsers} active · ${stats.archivedUsers} archived`}
          tone={stats.lockedUsers > 0 ? "warn" : "default"}
        />
        <Stat
          label="Roles"
          value={stats.roles}
          hint={`${roles.filter((r) => r.is_system === 1).length} system, ${roles.filter((r) => r.is_system === 0).length} custom`}
        />
        <Stat
          label="Live sessions"
          value={stats.sessions}
          hint={`${counts.last24h} actions in 24h`}
        />
        <Stat
          label="Failed sign-ins (24h)"
          value={counts.failures}
          tone={counts.failures > 0 ? "warn" : "good"}
          hint={stats.lockedUsers > 0 ? `${stats.lockedUsers} account(s) locked out` : "No accounts locked out"}
        />
      </div>

      {/* System data */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders (all time)" value={stats.orders} hint={money(stats.revenueCents)} />
        <Stat
          label="Open tickets"
          value={stats.openOrders}
          tone={stats.openOrders > 6 ? "warn" : "default"}
          hint="Received, brewing or ready"
        />
        <Stat
          label="Stock at cost"
          value={money(stats.stockValueCents)}
          tone={stats.lowStock > 0 ? "warn" : "default"}
          hint={`${stats.lowStock} item(s) at or below reorder level`}
        />
        <Stat
          label="Menu"
          value={`${stats.activeMenuItems}/${stats.menuItems}`}
          hint={`${stats.menuItems - stats.activeMenuItems} taken off the till · ${stats.members} members`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Shortcuts */}
        <Card title="Administration" subtitle="What this role can open">
          {shortcuts.length === 0 ? (
            <p className="text-[0.8125rem] muted">
              Your role can reach the admin area but holds no section permissions. Ask an owner
              under Roles.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {shortcuts.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <span className="mt-0.5 text-base" aria-hidden>
                      {s.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.8125rem] font-medium">{s.label}</span>
                      <span className="block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                        {s.note}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Staff */}
        <Card
          title="Staff"
          subtitle={`${pluralize(users.filter((u) => !u.deleted_at).length, "account")} on the books`}
          bodyClassName="p-0"
          actions={
            perms.has("users.view") ? (
              <Link href="/admin/users" className="btn px-2 py-1 text-[0.75rem]">
                Manage
              </Link>
            ) : undefined
          }
        >
          <ul className="divide-y">
            {users
              .filter((u) => !u.deleted_at)
              .slice(0, 7)
              .map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium">
                      {u.full_name}
                      {u.id === user!.id && (
                        <span className="ml-1.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                          you
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {u.username} · {u.role_name}
                    </p>
                  </div>
                  <span
                    className={`chip shrink-0 ring-1 ring-inset ${
                      u.is_active === 1
                        ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
                        : "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300"
                    }`}
                  >
                    {u.is_active === 1 ? "active" : "off"}
                  </span>
                </li>
              ))}
          </ul>
        </Card>

        {/* Recent activity */}
        <Card
          title="Recent activity"
          subtitle={`${counts.total.toLocaleString()} entries in total`}
          bodyClassName="p-0"
          actions={
            perms.has("logs.view") ? (
              <Link href="/admin/logs" className="btn px-2 py-1 text-[0.75rem]">
                Full log
              </Link>
            ) : undefined
          }
        >
          {recent.length === 0 ? (
            <EmptyState icon="≡" title="No activity yet" hint="Actions are recorded as staff use the system." />
          ) : (
            <ul className="max-h-[19rem] divide-y overflow-y-auto scroll-thin">
              {recent.map((a) => (
                <li key={a.id} className="px-4 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[0.75rem] font-medium">
                      <span style={{ color: "var(--brand)" }}>{a.username || "—"}</span>{" "}
                      {actionLabel(a.action)}
                    </p>
                    <span className="shrink-0 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {timeAgo(a.at)}
                    </span>
                  </div>
                  {a.detail && (
                    <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {a.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Staff sales + roles */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Sales by staff member"
          subtitle="Last 30 days, cancelled orders excluded."
          bodyClassName="p-0"
          actions={
            perms.has("reports.view") ? (
              <Link href="/admin/reports" className="btn px-2 py-1 text-[0.75rem]">
                Full report
              </Link>
            ) : undefined
          }
        >
          {staffSales.length === 0 ? (
            <EmptyState icon="◫" title="No trading to report" />
          ) : (
            <ul className="divide-y">
              {staffSales.slice(0, 6).map((s) => {
                const top = staffSales[0]?.revenue_cents || 1;
                return (
                  <li key={String(s.user_id)} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[0.8125rem] font-medium">
                        {s.full_name}
                        <span className="ml-1.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                          {s.role_name}
                        </span>
                      </p>
                      <span className="num text-[0.8125rem] font-semibold">
                        {money(s.revenue_cents)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={s.revenue_cents} max={top} />
                      </div>
                      <span className="num shrink-0 text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                        {pluralize(s.orders, "order")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Roles"
          subtitle="What each role grants. System roles cannot be deleted."
          bodyClassName="p-0"
          actions={
            perms.has("roles.view") ? (
              <Link href="/admin/roles" className="btn px-2 py-1 text-[0.75rem]">
                Edit
              </Link>
            ) : undefined
          }
        >
          <ul className="divide-y">
            {roles.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.8125rem] font-medium">
                    {r.name}
                    {r.is_system === 1 && (
                      <span className="chip ml-1.5" style={{ backgroundColor: "var(--surface-sunken)" }}>
                        system
                      </span>
                    )}
                  </p>
                  <span className="num shrink-0 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                    {pluralize(r.permission_count, "permission")} · {pluralize(r.user_count, "user")}
                  </span>
                </div>
                <p className="text-[0.6875rem] leading-snug muted">{r.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Sessions */}
      <Card
        className="mt-4"
        title={`Live sessions — ${sessions.length}`}
        subtitle="Each row is one signed-in browser. Revoke a person's sessions from their account page."
        bodyClassName="p-0"
        actions={perms.has("admin.access") ? <PurgeSessions /> : undefined}
      >
        {sessions.length === 0 ? (
          <EmptyState icon="◌" title="Nobody is signed in" />
        ) : (
          <ul className="divide-y">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-medium">
                    {s.full_name}
                    <span className="ml-1.5 font-mono text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {s.username}
                    </span>
                  </p>
                  <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                    {s.ip} · {s.user_agent.slice(0, 60) || "unknown device"}
                  </p>
                </div>
                <span className="shrink-0 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  seen {timeAgo(s.last_seen_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
