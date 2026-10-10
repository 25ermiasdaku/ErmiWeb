import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { LoyaltyClient } from "@/components/loyalty-client";
import { gate } from "@/lib/auth";
import { money, moneyShort, timeAgo } from "@/lib/format";
import { getLoyaltyTxns, getMembers, getRedemptions, getRewards } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const { user, denied } = await gate("loyalty.view");
  if (denied) return denied;
  const members = getMembers();
  const rewards = getRewards();
  const txns = getLoyaltyTxns(undefined, 20);
  const redemptions = getRedemptions(12);

  const pointsOutstanding = members.reduce((s, m) => s + m.points, 0);
  const lifetimeSpend = members.reduce((s, m) => s + (m.spend_cents ?? 0), 0);
  const activeThisWeek = members.filter((m) => {
    if (!m.last_visit_at) return false;
    return (Date.now() - new Date(m.last_visit_at.replace(" ", "T") + "Z").getTime()) / 86400000 < 7;
  }).length;
  const cheapest = rewards[0];

  return (
    <>
      <PageHeader
        title="Loyalty"
        subtitle="Members earn one point per dollar. Points come off the ticket at the till."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={members.length} hint={`${activeThisWeek} active this week`} />
        <Stat
          label="Points outstanding"
          value={pointsOutstanding.toLocaleString()}
          hint={cheapest ? `Next reward at ${cheapest.points_cost} pts` : "No rewards defined"}
        />
        <Stat label="Lifetime member spend" value={moneyShort(lifetimeSpend)} hint="Excludes cancelled orders" />
        <Stat
          label="Redemptions"
          value={redemptions.length}
          hint="Recorded against members"
        />
      </div>

      <LoyaltyClient
        members={members}
        rewards={rewards}
        canManage={user!.permissions.has("loyalty.manage")}
        canRedeem={user!.permissions.has("loyalty.redeem")}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Points ledger" subtitle="Every earn and burn" bodyClassName="p-0">
          {txns.length === 0 ? (
            <EmptyState icon="★" title="No points activity yet" />
          ) : (
            <ul className="divide-y">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium">{t.member_name}</p>
                    <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {t.reason} · {timeAgo(t.at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="num text-[0.8125rem] font-semibold"
                      style={{ color: t.delta >= 0 ? "rgb(5 150 105)" : "rgb(225 29 72)" }}
                    >
                      {t.delta > 0 ? "+" : ""}
                      {t.delta}
                    </p>
                    <p className="num text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                      bal {t.balance_after.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Redemptions" subtitle="Rewards handed over" bodyClassName="p-0">
          {redemptions.length === 0 ? (
            <EmptyState icon="🎁" title="No rewards redeemed yet" hint="Members can redeem from the till or this page." />
          ) : (
            <ul className="divide-y">
              {redemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium">{r.member_name}</p>
                    <p className="truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {r.reward_name} · {timeAgo(r.at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-[0.8125rem] font-semibold" style={{ color: "rgb(225 29 72)" }}>
                      −{r.points_spent}
                    </p>
                    {r.value_cents > 0 && (
                      <p className="num text-[0.625rem] faint">{money(r.value_cents)} off</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
