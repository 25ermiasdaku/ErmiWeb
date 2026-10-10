import Link from "next/link";
import { Card, EmptyState, PageHeader, ProgressBar, Sparkline, Stat } from "@/components/ui";
import { gate } from "@/lib/auth";
import {
  getSalesByStaff,
  getSystemStats,
  getTopItemsByDays,
  getTradingByChannel,
  getTradingByDay,
  getTradingByHour,
} from "@/lib/admin-queries";
import { dayLabel, money, moneyShort, pluralize, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { user, denied } = await gate("reports.view");
  if (denied) return denied;

  const { days: raw } = await searchParams;
  const days = RANGES.some((r) => r.days === Number(raw)) ? Number(raw) : 30;

  const stats = getSystemStats();
  const byDay = getTradingByDay(days);
  const byChannel = getTradingByChannel(days);
  const byHour = getTradingByHour(days);
  const byStaff = getSalesByStaff(days);
  const topItems = getTopItemsByDays(days);

  // Window totals.
  const windowOrders = byDay.reduce((s, d) => s + d.orders, 0);
  const windowRevenue = byDay.reduce((s, d) => s + d.revenue_cents, 0);
  const windowTax = byDay.reduce((s, d) => s + d.tax_cents, 0);
  const avgTicket = windowOrders > 0 ? Math.round(windowRevenue / windowOrders) : 0;
  const tradingDays = byDay.length || 1;
  const bestDay = byDay.reduce((best, d) => (d.revenue_cents > (best?.revenue_cents ?? 0) ? d : best), byDay[0]);
  const peakHour = byHour.reduce((best, h) => (h.orders > (best?.orders ?? 0) ? h : best), byHour[0]);

  const topStaffRevenue = byStaff[0]?.revenue_cents || 1;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`System-wide figures for the last ${days} days. Cancelled orders are excluded throughout.`}
        actions={
          <div className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <Link
                key={r.days}
                href={`/admin/reports?days=${r.days}`}
                className="btn px-2.5 py-1 text-[0.75rem]"
                style={r.days === days ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" } : undefined}
                aria-current={r.days === days ? "page" : undefined}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* Window totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Takings" value={money(windowRevenue)} hint={`${pluralize(windowOrders, "order")}`} />
        <Stat label="Average ticket" value={money(avgTicket)} hint="Per order, tax included" />
        <Stat
          label="Tax collected"
          value={money(windowTax)}
          hint={`${((windowTax / (windowRevenue || 1)) * 100).toFixed(1)}% of takings`}
        />
        <Stat
          label="Busiest hour"
          value={peakHour ? `${String(peakHour.hour).padStart(2, "0")}:00` : "—"}
          hint={peakHour ? `${pluralize(peakHour.orders, "order")} that hour` : "No trading in this window"}
        />
      </div>

      {/* Trading curve */}
      <Card
        className="mt-4"
        title="Takings by day"
        subtitle={
          bestDay
            ? `Best day ${dayLabel(bestDay.day)} at ${money(bestDay.revenue_cents)} · ${moneyShort(
                Math.round(windowRevenue / tradingDays),
              )} a day on average`
            : "No trading in this window"
        }
        bodyClassName="p-4"
      >
        {byDay.length === 0 ? (
          <EmptyState icon="◫" title="Nothing to report" hint="No orders in this window." />
        ) : (
          <>
            <Sparkline data={byDay} formatValue={moneyShort} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-[0.6875rem] uppercase tracking-wider" style={{ borderColor: "var(--border-subtle)" }}>
                    <th className="pb-2 font-medium" style={{ color: "var(--text-faint)" }}>Day</th>
                    <th className="pb-2 text-right font-medium" style={{ color: "var(--text-faint)" }}>Orders</th>
                    <th className="pb-2 text-right font-medium" style={{ color: "var(--text-faint)" }}>Tax</th>
                    <th className="pb-2 text-right font-medium" style={{ color: "var(--text-faint)" }}>Takings</th>
                  </tr>
                </thead>
                <tbody className="num text-[0.8125rem]">
                  {byDay.slice().reverse().map((d) => (
                    <tr key={d.day} className="border-b last:border-0" style={{ borderColor: "var(--border-subtle)" }}>
                      <td className="py-1.5">{dayLabel(d.day)}</td>
                      <td className="py-1.5 text-right">{d.orders}</td>
                      <td className="py-1.5 text-right muted">{money(d.tax_cents)}</td>
                      <td className="py-1.5 text-right font-semibold">{money(d.revenue_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Staff */}
        <Card
          title="Takings by staff member"
          subtitle="Attribution comes from orders.placed_by. An erased account shows as unattributed."
          bodyClassName="p-0"
        >
          {byStaff.length === 0 ? (
            <EmptyState icon="◌" title="No orders attributed in this window" />
          ) : (
            <ul className="divide-y">
              {byStaff.map((s) => (
                <li key={String(s.user_id)} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[0.8125rem] font-medium">
                      {s.full_name}
                      {s.user_id === user!.id && (
                        <span className="ml-1.5 text-[0.6875rem]" style={{ color: "var(--brand)" }}>
                          you
                        </span>
                      )}
                      <span className="ml-1.5 text-[0.6875rem] font-normal" style={{ color: "var(--text-faint)" }}>
                        {s.role_name}
                      </span>
                    </p>
                    <span className="num shrink-0 text-[0.8125rem] font-semibold">
                      {money(s.revenue_cents)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1">
                      <ProgressBar value={s.revenue_cents} max={topStaffRevenue} />
                    </div>
                    <span className="num shrink-0 text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                      {pluralize(s.orders, "order")}
                      {s.last_order_at ? ` · last ${timeAgo(s.last_order_at)}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Channel + hours */}
        <div className="space-y-4">
          <Card title="Where orders came from" bodyClassName="p-4">
            {byChannel.length === 0 ? (
              <p className="text-[0.8125rem] muted">No orders in this window.</p>
            ) : (
              <ul className="space-y-2.5">
                {byChannel.map((c) => {
                  const pct = windowOrders > 0 ? (c.orders / windowOrders) * 100 : 0;
                  return (
                    <li key={c.channel}>
                      <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                        <span className="font-medium capitalize">{c.channel}</span>
                        <span className="num muted">
                          {c.orders} · {money(c.revenue_cents)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={c.orders} max={windowOrders} />
                      </div>
                      <p className="num mt-0.5 text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                        {pct.toFixed(0)}% of orders
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Busiest hours" subtitle="Rush staffing, by order count." bodyClassName="p-4">
            {byHour.length === 0 ? (
              <p className="text-[0.8125rem] muted">No orders in this window.</p>
            ) : (
              <>
                <div className="flex h-24 items-end gap-1">
                  {byHour.map((h) => {
                    const max = Math.max(...byHour.map((x) => x.orders), 1);
                    return (
                      <div key={h.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${String(h.hour).padStart(2, "0")}:00 — ${pluralize(h.orders, "order")}`}>
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${Math.max(4, (h.orders / max) * 100)}%`,
                            backgroundColor: h.hour >= 7 && h.hour <= 10 ? "var(--brand)" : "var(--surface-sunken)",
                          }}
                        />
                        {h.hour % 3 === 0 && (
                          <span className="num text-[0.5625rem]" style={{ color: "var(--text-faint)" }}>
                            {h.hour}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  Hour of day, in the server&rsquo;s timezone. Hours with no orders are missing.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Top sellers */}
      <Card
        className="mt-4"
        title="Top sellers"
        subtitle={`Quantity sold in the last ${days} days.`}
        bodyClassName="p-0"
      >
        {topItems.length === 0 ? (
          <EmptyState icon="◌" title="Nothing sold in this window" />
        ) : (
          <ul className="divide-y">
            {topItems.slice(0, 8).map((item, i) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="num w-5 shrink-0 text-[0.75rem] font-semibold" style={{ color: "var(--text-faint)" }}>
                  {i + 1}
                </span>
                <span className="text-base" aria-hidden>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-medium">{item.name}</p>
                  <p className="text-[0.6875rem] muted">{item.category}</p>
                </div>
                <span className="num shrink-0 text-[0.8125rem] font-semibold">
                  {item.qty.toLocaleString()}
                </span>
                <span className="num w-20 shrink-0 text-right text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {money(item.revenue_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Lifetime figures */}
      <Card
        className="mt-4"
        title="Lifetime"
        subtitle="Everything on the books since the first order, regardless of the window above."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="All orders" value={stats.orders.toLocaleString()} />
          <Figure label="All-time takings" value={money(stats.revenueCents)} />
          <Figure label="Open tickets" value={String(stats.openOrders)} />
          <Figure label="Stock at cost" value={money(stats.stockValueCents)} />
        </div>
      </Card>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className="num mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
