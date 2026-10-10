import Link from "next/link";
import { Card, EmptyState, PageHeader, ProgressBar, RankBar, Sparkline, Stat } from "@/components/ui";
import { gate } from "@/lib/auth";
import { money, moneyShort, pluralize, qty as fmtQty, timeAgo } from "@/lib/format";
import { getDashboard } from "@/lib/queries";
import { STATUS_META, tierFor, type OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, denied } = await gate("dashboard.view");
  if (denied) return denied;

  const d = getDashboard();
  const marginPct =
    d.revenueToday > 0 ? Math.round((d.grossMarginCents / d.revenueToday) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Trading today, stock pressure and the loyalty book at a glance."
        actions={
          <Link href="/pos" className="btn btn-primary">
            New order
          </Link>
        }
      />

      {/* Primary figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Revenue today"
          value={money(d.revenueToday)}
          hint={`${money(d.revenueMonth)} this month`}
        />
        <Stat
          label="Orders today"
          value={d.ordersToday}
          hint={`${money(d.avgTicket)} average ticket`}
        />
        <Stat
          label="Open tickets"
          value={d.openCount}
          tone={d.openCount > 6 ? "warn" : "default"}
          hint={d.openCount > 0 ? "On the bar right now" : "Board is clear"}
        />
        <Stat
          label="Gross margin"
          value={`${marginPct}%`}
          tone={marginPct >= 60 ? "good" : marginPct > 0 ? "warn" : "default"}
          hint={`${money(d.cogs)} cost of goods`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Weekly trend */}
        <Card title="Last 7 days" subtitle="Revenue per day" className="lg:col-span-2">
          <Sparkline data={d.spark} formatValue={money} />
        </Card>

        {/* Stock alerts */}
        <Card
          title="Stock alerts"
          subtitle={d.lowStock.length ? pluralize(d.lowStock.length, "item") + " at or below reorder level" : "Everything is above reorder level"}
          actions={
            <Link href="/inventory" className="btn btn-ghost">
              Manage
            </Link>
          }
          bodyClassName="p-0"
        >
          {d.lowStock.length === 0 ? (
            <EmptyState icon="✓" title="Shelves are healthy" hint="No item is at or below its reorder level." />
          ) : (
            <ul className="divide-y">
              {d.lowStock.slice(0, 6).map((item) => {
                const ratio = item.reorder_level > 0 ? item.qty_on_hand / item.reorder_level : 0;
                const out = item.qty_on_hand <= 0;
                return (
                  <li key={item.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-medium">{item.name}</p>
                        <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                          {item.sku} · reorder at {fmtQty(item.reorder_level)} {item.unit}
                        </p>
                      </div>
                      <span
                        className={`num chip ring-1 ring-inset ${
                          out
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30"
                        }`}
                      >
                        {out ? "Out" : `${fmtQty(item.qty_on_hand)} ${item.unit}`}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={Math.min(ratio, 1)}
                        max={1}
                        tone={out ? "rgb(244 63 94)" : "rgb(245 158 11)"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <Card
          title="Recent orders"
          className="lg:col-span-2"
          actions={
            <Link href="/orders" className="btn btn-ghost">
              Order board
            </Link>
          }
          bodyClassName="p-0"
        >
          {d.recentOrders.length === 0 ? (
            <EmptyState icon="▤" title="No orders yet" hint="Ring one up from the Point of Sale page." />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b">
                    <th className="th">Order</th>
                    <th className="th">Customer</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Items</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {d.recentOrders.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-[var(--surface-sunken)]">
                      <td className="td num font-medium">{o.order_number}</td>
                      <td className="td">
                        <span className="block max-w-[10rem] truncate">
                          {o.member_name ?? o.customer_name}
                        </span>
                        <span className="text-[0.6875rem] capitalize" style={{ color: "var(--text-faint)" }}>
                          {o.channel}
                        </span>
                      </td>
                      <td className="td">
                        <span className={`chip ring-1 ring-inset ${STATUS_META[o.status as OrderStatus].badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[o.status as OrderStatus].dot}`} />
                          {STATUS_META[o.status as OrderStatus].label}
                        </span>
                      </td>
                      <td className="td num text-right" style={{ color: "var(--text-muted)" }}>
                        {o.items?.reduce((s, i) => s + i.qty, 0) ?? 0}
                      </td>
                      <td className="td num text-right font-medium">{money(o.total_cents)}</td>
                      <td className="td num text-right" style={{ color: "var(--text-faint)" }}>
                        {timeAgo(o.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Top sellers */}
        <Card title="Top sellers" subtitle="Last 7 days by units sold">
          {d.topSellers.length === 0 ? (
            <EmptyState icon="☕" title="Nothing sold yet" />
          ) : (
            <ul className="space-y-3">
              {d.topSellers.map((s, i) => {
                const max = d.topSellers[0]?.qty ?? 1;
                return (
                  <li key={s.name}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="num w-4 text-[0.6875rem] font-semibold" style={{ color: "var(--text-faint)" }}>
                          {i + 1}
                        </span>
                        <span className="truncate text-[0.8125rem]">
                          <span aria-hidden className="mr-1.5">
                            {s.icon}
                          </span>
                          {s.name}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                        {s.qty} · {moneyShort(s.revenue_cents)}
                      </span>
                    </div>
                    <RankBar value={s.qty} max={max} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Loyalty leaders */}
        <Card
          title="Loyalty leaders"
          actions={
            <Link href="/loyalty" className="btn btn-ghost">
              Members
            </Link>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {d.topMembers.map((m) => {
              const tier = tierFor(m.points);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium">{m.name}</p>
                    <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {pluralize(m.orders_count ?? 0, "order")} · {tier.name}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold" style={{ color: "var(--brand)" }}>
                    {m.points.toLocaleString()}
                    <span className="ml-1 text-[0.625rem] font-normal" style={{ color: "var(--text-faint)" }}>
                      pts
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Book summary */}
        <Card title="The book" subtitle="Cumulative figures">
          <dl className="space-y-2.5 text-sm">
            <Row label="Registered members" value={d.members.toLocaleString()} />
            <Row label="Points issued" value={d.pointsIssued.toLocaleString()} />
            <Row label="Stock on hand" value={money(d.inventoryValue)} />
            <Row label="Revenue this month" value={money(d.revenueMonth)} />
            <Row
              label="Stock alerts"
              value={String(d.lowStock.length)}
              tone={d.lowStock.length > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
          </dl>
        </Card>

        {/* How the system fits together */}
        <Card title="How this fits together" subtitle="One order, four subsystems">
          <ol className="space-y-2.5 text-[0.8125rem]">
            {[
              ["Point of Sale", "Prices are recomputed on the server, never trusted from the browser."],
              ["Recipes", "Each drink defines a spec and the stock it consumes."],
              ["Inventory", "A sale deducts those ingredients; cancelling puts them back."],
              ["Loyalty", "Members earn one point per dollar and can redeem rewards at checkout."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span
                  className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold"
                  style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{title}. </span>
                  <span className="muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className={`num font-medium ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}
