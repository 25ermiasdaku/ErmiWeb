"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustMemberPoints, createMember, redeemReward } from "@/lib/actions";
import { money, pluralize, timeAgo } from "@/lib/format";
import { ProgressBar } from "@/components/ui";
import { tierFor, type Member, type Reward } from "@/lib/types";

export function LoyaltyClient({
  members,
  rewards,
  canManage = false,
  canRedeem = false,
}: {
  members: Member[];
  rewards: Reward[];
  /** loyalty.manage — add members and hand-adjust points. */
  canManage?: boolean;
  /** loyalty.redeem — spend a member's points. */
  canRedeem?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [granting, setGranting] = useState<number | null>(null);
  const [grantValue, setGrantValue] = useState("50");
  const [grantReason, setGrantReason] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const visible = members.filter((m) =>
    query.trim() ? `${m.name} ${m.email}`.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  function toast(message: string) {
    setFlash(message);
    router.refresh();
    setTimeout(() => setFlash(null), 2500);
  }

  function grant(member: Member) {
    const delta = Number(grantValue);
    setGranting(null);
    if (!Number.isFinite(delta) || delta === 0) return;
    startTransition(async () => {
      await adjustMemberPoints(member.id, delta, grantReason || "Goodwill points");
      setGrantValue("50");
      setGrantReason("");
      toast(`${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} points for ${member.name}`);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* Members */}
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <input
            className="field max-w-[14rem] flex-1"
            placeholder="Search members…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="num text-[0.6875rem] faint">{pluralize(visible.length, "member")}</span>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowJoin((v) => !v)}>
              {showJoin ? "Close" : "Add member"}
            </button>
          )}
        </header>

        {canManage && showJoin && (
          <form
            className="grid gap-2 border-b bg-[var(--surface-sunken)] px-3 py-3 sm:grid-cols-4"
            action={async (formData) => {
              startTransition(async () => {
                await createMember(formData);
                setShowJoin(false);
                toast("Member added");
              });
            }}
          >
            <input className="field" name="name" placeholder="Full name" required />
            <input className="field" name="email" type="email" placeholder="Email" required />
            <input className="field" name="phone" placeholder="Phone" />
            <input className="field" name="notes" placeholder="Notes (preferences, allergies)" />
            <button className="btn btn-primary sm:col-span-4" disabled={pending} type="submit">
              {pending ? "Saving…" : "Create member"}
            </button>
          </form>
        )}

        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b">
                <th className="th">Member</th>
                <th className="th">Tier</th>
                <th className="th w-40">To next tier</th>
                <th className="th text-right">Orders</th>
                <th className="th text-right">Spend</th>
                <th className="th text-right">Last visit</th>
                <th className="th text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <p className="py-10 text-center text-[0.8125rem] faint">No members match.</p>
                  </td>
                </tr>
              ) : (
                visible.map((m) => {
                  const tier = tierFor(m.points);
                  const remaining = tier.next === null ? 0 : tier.next - m.points;
                  return (
                    <tr key={m.id} className="transition-colors hover:bg-[var(--surface-sunken)]">
                      <td className="td">
                        <span className="block font-medium">{m.name}</span>
                        <span className="block max-w-[16rem] truncate text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                          {m.email}
                          {m.notes ? ` · ${m.notes}` : ""}
                        </span>
                      </td>
                      <td className="td">
                        <span className={`chip ring-1 ring-inset ${tier.tone}`}>{tier.name}</span>
                      </td>
                      <td className="td">
                        {tier.next === null ? (
                          <span className="text-[0.6875rem] faint">Top tier</span>
                        ) : (
                          <>
                            <ProgressBar value={m.points} max={tier.next} />
                            <span className="num mt-1 block text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                              {remaining} pts to {tier.next}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="td num text-right muted">{m.orders_count ?? 0}</td>
                      <td className="td num text-right">{money(m.spend_cents ?? 0)}</td>
                      <td className="td num text-right" style={{ color: "var(--text-faint)" }}>
                        {m.last_visit_at ? timeAgo(m.last_visit_at) : "—"}
                      </td>
                      <td className="td text-right">
                        {!canManage ? (
                          <span
                            className="num text-[0.8125rem] font-semibold"
                            style={{ color: "var(--brand)" }}
                          >
                            {m.points.toLocaleString()}
                          </span>
                        ) : granting === m.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              className="field num w-16 py-1 text-right text-xs"
                              value={grantValue}
                              onChange={(e) => setGrantValue(e.target.value)}
                              autoFocus
                            />
                            <input
                              className="field w-24 py-1 text-xs"
                              placeholder="Why"
                              value={grantReason}
                              onChange={(e) => setGrantReason(e.target.value)}
                            />
                            <button className="btn btn-primary px-2 py-1" disabled={pending} onClick={() => grant(m)}>
                              ✓
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="num text-[0.8125rem] font-semibold" style={{ color: "var(--brand)" }}>
                              {m.points.toLocaleString()}
                            </span>
                            <button className="btn px-2 py-1" onClick={() => setGranting(m.id)}>
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reward catalogue */}
      <div className="space-y-4">
        {flash && (
          <div
            className="rounded-lg px-3 py-2 text-[0.75rem] font-medium"
            style={{ backgroundColor: "rgb(16 185 129 / 0.12)", color: "rgb(5 150 105)" }}
            role="status"
          >
            {flash}
          </div>
        )}

        <section className="card overflow-hidden">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Reward catalogue</h2>
            <p className="mt-0.5 text-xs faint">
              {canRedeem
                ? "Redeem instantly or let the member use it at the till."
                : "Read only — spending points needs the loyalty.redeem permission."}
            </p>
          </header>
          <ul className="divide-y">
            {rewards.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium">{r.name}</p>
                    <p className="text-[0.6875rem] leading-snug muted">{r.description}</p>
                  </div>
                  <span className="num chip shrink-0 bg-[var(--brand-soft)] text-[var(--brand)]">
                    {r.points_cost} pts
                  </span>
                </div>
                <select
                  className="field mt-1.5 py-1 text-xs"
                  value=""
                  disabled={pending || !canRedeem}
                  title={canRedeem ? undefined : "Redeeming needs the loyalty.redeem permission"}
                  onChange={(e) => {
                    if (e.target.value === "") return;
                    const memberId = Number(e.target.value);
                    startTransition(async () => {
                      await redeemReward(memberId, r.id, null);
                      const who = members.find((m) => m.id === memberId);
                      toast(
                        who && who.points >= r.points_cost
                          ? `Redeemed ${r.name} for ${who.name}`
                          : `${who?.name ?? "That member"} cannot afford ${r.name}`,
                      );
                    });
                    e.target.value = "";
                  }}
                >
                  <option value="">Redeem for…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.points < r.points_cost}>
                      {m.name} ({m.points.toLocaleString()} pts)
                      {m.points < r.points_cost ? " — not enough" : ""}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
