import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "@/components/account-forms";
import { gateSelf } from "@/lib/auth";
import { PERMISSIONS, permissionDef } from "@/lib/permissions";
import { getActivity, getMyOrders, getMySummary } from "@/lib/admin-queries";
import { actionLabel } from "@/lib/activity";
import { dateTime, initials, money, pluralize, timeAgo } from "@/lib/format";
import { STATUS_META, type OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The personal account page. Every signed-in role can reach it, whatever
 * permissions they hold — a cashier with no admin rights still needs to see
 * their own record and change their password.
 */
export default async function MyAccountPage() {
  const { user, denied } = await gateSelf();
  if (denied) return denied;

  const summary = getMySummary(user!.id);
  const orders = getMyOrders(user!.id);
  const activity = getActivity({ userId: user!.id, limit: 25 });

  // What this role can actually reach, so the page explains itself.
  const granted = PERMISSIONS.filter((p) => user!.permissions.has(p.key));
  const byCategory = new Map<string, typeof granted>();
  for (const p of granted) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }

  return (
    <>
      <PageHeader
        title="My Account"
        subtitle="Your profile, your password, and the record of what you have done in this system."
      />

      {/* Identity */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 ring-1 ring-inset" style={{ backgroundColor: "var(--surface-raised)" }}>
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold"
          style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
          aria-hidden
        >
          {initials(user!.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{user!.full_name}</h2>
          <p className="text-[0.8125rem] muted">
            <code className="font-mono">{user!.username}</code> · {user!.email}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="chip ring-1 ring-inset"
            style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)", borderColor: "transparent" }}
          >
            {user!.role_name}
          </span>
          {user!.job_title && (
            <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
              {user!.job_title}
            </span>
          )}
        </div>
      </div>

      {/* Own record */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Orders I rang up"
          value={summary.orders.toLocaleString()}
          hint={`${summary.thisWeek} in the last 7 days`}
        />
        <Stat
          label="Takings I took"
          value={money(summary.revenueCents)}
          hint="Counted towards your role's activity"
        />
        <Stat label="Stock corrections" value={summary.stockAdjusted} hint="Adjustments you recorded" />
        <Stat
          label="Last signed in"
          value={user!.last_login_at ? timeAgo(user!.last_login_at) : "—"}
          hint={user!.last_login_at ? dateTime(user!.last_login_at) : "No previous session"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Orders */}
        <Card
          title="My recent orders"
          subtitle="Only the tickets you rang up. The whole cafe's trading is under Reports."
          bodyClassName="p-0"
        >
          {orders.length === 0 ? (
            <EmptyState
              icon="▤"
              title="No orders yet"
              hint="Once you send a ticket from the till it shows up here."
            />
          ) : (
            <ul className="divide-y">
              {orders.slice(0, 12).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="num text-[0.8125rem] font-medium">{o.order_number}</p>
                    <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {pluralize(o.items, "item")} · {timeAgo(o.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`chip ring-1 ring-inset ${
                        STATUS_META[o.status as OrderStatus]?.badge ?? ""
                      }`}
                    >
                      {STATUS_META[o.status as OrderStatus]?.label ?? o.status}
                    </span>
                    <span className="num text-[0.8125rem] font-semibold">{money(o.total_cents)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* My activity */}
        <Card
          title="My activity"
          subtitle="Everything the audit trail has recorded against your account."
          bodyClassName="p-0"
        >
          {activity.length === 0 ? (
            <EmptyState
              icon="≡"
              title="Nothing logged yet"
              hint="Your actions appear here as soon as you do something."
            />
          ) : (
            <ul className="max-h-[22rem] divide-y overflow-y-auto scroll-thin">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[0.8125rem] font-medium">{actionLabel(a.action)}</p>
                    <span className="shrink-0 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {timeAgo(a.at)}
                    </span>
                  </div>
                  {a.detail && (
                    <p className="text-[0.6875rem] leading-snug muted">{a.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Profile + security */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Personal information"
          subtitle="Name and email are yours to change. Username, role and account status are managed by an owner or manager."
        >
          <ProfileForm fullName={user!.full_name} email={user!.email} />
        </Card>

        <Card
          title="Change password"
          subtitle="Changing your password signs out your other sessions."
        >
          <div id="security" className="scroll-mt-6">
            <PasswordForm />
          </div>
        </Card>
      </div>

      {/* Danger zone */}
      <Card
        className="mt-4 ring-1 ring-inset ring-rose-500/25"
        title="Delete account"
        subtitle="Permanent, and only ever your own record. Type your username and password to confirm."
      >
        <DeleteAccountForm username={user!.username} />
      </Card>

      {/* What this role can do */}
      <Card
        className="mt-4"
        title={`What my role can do — ${granted.length} of ${PERMISSIONS.length} permissions`}
        subtitle={`Granted by the “${user!.role_name}” role. An owner can change any of this under Admin → Roles.`}
      >
        {granted.length === 0 ? (
          <p className="text-[0.8125rem] muted">
            This role has no permissions yet, so every page will ask an owner to grant something.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                <h3
                  className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {category}
                </h3>
                <ul className="space-y-1">
                  {list.map((p) => (
                    <li key={p.key} className="flex items-start gap-1.5 text-[0.75rem]">
                      <span style={{ color: "var(--brand)" }} aria-hidden>
                        ✓
                      </span>
                      <span title={p.description}>
                        {p.label}
                        <code className="ml-1.5 font-mono text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                          {p.key}
                        </code>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
