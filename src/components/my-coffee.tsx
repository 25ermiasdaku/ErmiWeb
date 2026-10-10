"use client";

/**
 * The customer's own ordering page.
 *
 * Reads as two halves: the order you are in the middle of, and the menu to start
 * the next one. The tracking half is deliberately first — the question a
 * customer actually has is "where is my coffee", and the answer is a status
 * strip plus one button, not a form.
 *
 * Nothing here is trusted. Prices are shown for convenience but recomputed on
 * the server (see lib/my-order-actions), ownership is checked in SQL, and both
 * confirmations are refused unless the order is genuinely waiting on this
 * account at that end.
 */
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyOrder, confirmMyOrder, placeMyOrder } from "@/lib/my-order-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { money, pluralize, timeAgo } from "@/lib/format";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { ORDER_FLOW, STATUS_META, type ItemOption, type MenuItem, type OrderStatus } from "@/lib/types";
import type { MyMember, MyOrder, MyReward } from "@/lib/my-order";

type CartLine = {
  key: string;
  itemId: number;
  name: string;
  icon: string;
  qty: number;
  unitPriceCents: number;
  options: Array<{ optionId: number; label: string; priceDeltaCents: number }>;
};

export function MyCoffee({
  name,
  menu,
  member,
  rewards,
  live,
  history,
  taxRate,
  pointsPerDollar,
}: {
  name: string;
  menu: MenuItem[];
  member: MyMember | null;
  rewards: MyReward[];
  /** The order in progress, if there is one. */
  live: MyOrder | null;
  history: MyOrder[];
  taxRate: number;
  pointsPerDollar: number;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="My Coffee"
          subtitle="Order a coffee, then follow it through to the cup."
        />

        <Stats member={member} live={live} history={history} />

        <Tracking order={live} />

        <History orders={history} />
      </div>

      <Menu
        menu={menu}
        member={member}
        rewards={rewards}
        live={live}
        name={name}
        taxRate={taxRate}
        pointsPerDollar={pointsPerDollar}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------

function Stats({
  member,
  live,
  history,
}: {
  member: MyMember | null;
  live: MyOrder | null;
  history: MyOrder[];
}) {
  const earned = live && !isClosed(live.status) ? live.points_earned : 0;
  const collected = history.filter((o) => o.status === "completed").length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Points"
        value={(member?.points ?? 0).toLocaleString()}
        hint={member ? "Banked when you collect" : "Opens with your first order"}
      />
      <Stat
        label="On this order"
        value={earned > 0 ? `+${earned}` : "—"}
        tone={earned > 0 ? "good" : "default"}
        hint={earned > 0 ? "Added when you collect" : "Nothing pending"}
      />
      <Stat
        label="In progress"
        value={live && !isClosed(live.status) ? STATUS_META[live.status].label : "None"}
        hint={live ? `Ordered ${timeAgo(live.created_at)}` : "Nothing on the go"}
      />
      <Stat label="Collected" value={collected} hint="Orders taken away" />
    </div>
  );
}

/** True once the order will not move again on its own. */
function isClosed(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * The status strip plus whichever button belongs to the end we are at.
 *
 * Exactly one of the two confirmations is ever offered, chosen by the order's
 * status — the same choice the server makes. A customer is never asked to
 * confirm something that does not need confirming.
 */
function Tracking({ order }: { order: MyOrder | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function act(fn: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  if (!order) {
    return (
      <Card title="Nothing in progress">
        <EmptyState
          icon="✦"
          title="No order on the go"
          hint="Pick something from the menu and it will show up here, with a button to confirm it."
        />
      </Card>
    );
  }

  const confirmable = order.status === "pending" || order.status === "ready";
  const closed = order.status === "completed" || order.status === "cancelled";

  return (
    <Card
      title={`Your order ${order.order_number}`}
      subtitle={`Placed ${timeAgo(order.created_at)}`}
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {ORDER_FLOW.map((status, i) => {
          const meta = STATUS_META[status];
          const reached = stepIndex(order.status) >= i;
          const current = order.status === status;
          return (
            <li key={status} className="flex items-center gap-1">
              <span
                className={`chip ring-1 ring-inset ${reached ? meta.badge : ""}`}
                style={
                  reached
                    ? undefined
                    : { color: "var(--text-faint)", backgroundColor: "transparent" }
                }
                aria-current={current ? "step" : undefined}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${reached ? meta.dot : "bg-current"}`} />
                {meta.label}
              </span>
              {i < ORDER_FLOW.length - 1 && (
                <span aria-hidden className="text-xs" style={{ color: "var(--text-faint)" }}>
                  ›
                </span>
              )}
            </li>
          );
        })}
        {order.status === "cancelled" && (
          <li>
            <span className={`chip ring-1 ring-inset ${STATUS_META.cancelled.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META.cancelled.dot}`} />
              Cancelled
            </span>
          </li>
        )}
      </ol>

      <ul className="mt-3 space-y-1.5 border-t pt-3">
        {order.items.map((item, i) => (
          <li key={i} className="text-[0.8125rem]">
            <span className="num font-semibold">{item.qty}×</span> <span>{item.name}</span>
            {item.options.length > 0 && (
              <span className="block pl-5 text-[0.6875rem] faint">{item.options.join(" · ")}</span>
            )}
          </li>
        ))}
      </ul>

      {order.note && (
        <p
          className="mt-3 rounded-md px-2.5 py-1.5 text-[0.75rem]"
          style={{ backgroundColor: "var(--brand-soft)", color: "var(--text-muted)" }}
        >
          {order.note}
        </p>
      )}

      <div className="mt-3 flex items-baseline justify-between border-t pt-3 text-sm">
        <span className="muted">Total</span>
        <span className="num text-base font-semibold">{money(order.total_cents)}</span>
      </div>

      {message && (
        <p
          className="mt-3 rounded-md px-2.5 py-1.5 text-[0.75rem] font-medium"
          role="status"
          style={{
            backgroundColor: message.ok ? "rgb(16 185 129 / 0.12)" : "rgb(244 63 94 / 0.12)",
            color: message.ok ? "rgb(5 150 105)" : "rgb(225 29 72)",
          }}
        >
          {message.text}
        </p>
      )}

      {!closed && (
        <div className="mt-3 space-y-2">
          {STATUS_META[order.status].customerPrompt && (
            <p className="text-[0.75rem] muted">{STATUS_META[order.status].customerPrompt}</p>
          )}
          {confirmable && (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-primary flex-1 py-2.5"
                disabled={pending}
                onClick={() => act(() => confirmMyOrder(order.id))}
              >
                {pending
                  ? "Confirming…"
                  : order.status === "pending"
                    ? "Yes, make it"
                    : `I have it · +${order.points_earned} pts`}
              </button>
              {order.status === "pending" && (
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() => act(() => cancelMyOrder(order.id))}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
          {order.status === "received" && (
            <p className="text-[0.75rem] faint">
              Nothing to do — the bar has it. This page refreshes itself; you can also{" "}
              <button className="underline" onClick={() => router.refresh()}>
                check again
              </button>
              .
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** How far along `ORDER_FLOW` this status is, or -1 for cancelled. */
function stepIndex(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status);
}

function History({ orders }: { orders: MyOrder[] }) {
  const past = orders.filter((o) => o.status === "completed" || o.status === "cancelled");
  if (past.length === 0) {
    return (
      <Card title="Your history" bodyClassName="p-0">
        <EmptyState icon="▤" title="No past orders yet" hint="They will be listed here once collected." />
      </Card>
    );
  }

  return (
    <Card title="Your history" subtitle="Every order on your account" bodyClassName="p-0">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b">
              <th className="th">Order</th>
              <th className="th">Items</th>
              <th className="th">Status</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {past.map((o) => {
              const meta = STATUS_META[o.status];
              return (
                <tr key={o.id} className="transition-colors hover:bg-[var(--surface-sunken)]">
                  <td className="td num font-medium">{o.order_number}</td>
                  <td className="td muted">
                    <span className="block max-w-[15rem] truncate">
                      {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`chip ring-1 ring-inset ${meta.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="td num text-right font-medium">{money(o.total_cents)}</td>
                  <td className="td num text-right" style={{ color: "var(--text-muted)" }}>
                    {o.status === "completed" ? `+${o.points_earned}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Menu
// ---------------------------------------------------------------

/**
 * The order builder.
 *
 * No channel picker, no member picker, no menu admin: the customer already is
 * the member, the channel is always "self", and taking items off the till is
 * not their business. That leaves a tap-to-add list and a note.
 */
function Menu({
  menu,
  member,
  rewards,
  live,
  name,
  taxRate,
  pointsPerDollar,
}: {
  menu: MenuItem[];
  member: MyMember | null;
  rewards: MyReward[];
  live: MyOrder | null;
  name: string;
  taxRate: number;
  pointsPerDollar: number;
}) {
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picker, setPicker] = useState<MenuItem | null>(null);
  const [note, setNote] = useState("");
  const [rewardId, setRewardId] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(placeMyOrder, EMPTY_STATE);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of menu) if (i.category_name) seen.set(i.category_slug!, i.category_name);
    return [...seen.entries()];
  }, [menu]);

  const visible = useMemo(
    () => (category === "all" ? menu : menu.filter((i) => i.category_slug === category)),
    [menu, category],
  );

  const affordable = rewards.filter((r) => (member?.points ?? 0) >= r.points_cost);
  const chosenReward = rewards.find((r) => r.id === rewardId) ?? null;

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
    const tax = Math.round(subtotal * taxRate);
    const rewardValue =
      chosenReward?.kind === "discount" ? Math.min(chosenReward.value_cents, subtotal + tax) : 0;
    const total = subtotal + tax - rewardValue;
    return {
      subtotal,
      tax,
      rewardValue,
      total,
      points: Math.floor((total / 100) * pointsPerDollar),
      count: cart.reduce((s, l) => s + l.qty, 0),
    };
  }, [cart, chosenReward, taxRate, pointsPerDollar]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        note,
        rewardId,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          optionIds: l.options.map((o) => o.optionId),
        })),
      }),
    [cart, note, rewardId],
  );

  // While one order is waiting on a decision, "confirm" is ambiguous — which
  // one? So no second order until this one is settled. The server refuses it
  // too; this just avoids the round trip.
  const blocked = live !== null && !isClosed(live.status);

  function addLine(item: MenuItem, chosen: ItemOption[]) {
    const key = `${item.id}:${chosen.map((o) => o.id).sort().join("-")}`;
    const unitPriceCents = item.base_price_cents + chosen.reduce((s, o) => s + o.price_delta_cents, 0);
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + 1) } : l));
      }
      return [
        ...prev,
        {
          key,
          itemId: item.id,
          name: item.name,
          icon: item.icon,
          qty: 1,
          unitPriceCents,
          options: chosen.map((o) => ({
            optionId: o.id,
            label: o.label,
            priceDeltaCents: o.price_delta_cents,
          })),
        },
      ];
    });
    setPicker(null);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0),
    );
  }

  return (
    <aside className="xl:sticky xl:top-5 xl:h-[calc(100dvh-2.5rem)]">
      <form action={formAction} className="card flex h-full flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Start an order</h2>
          <span className="num text-[0.6875rem] muted">{pluralize(totals.count, "item")}</span>
        </header>

        <input type="hidden" name="payload" value={payload} />

        {state.message && (
          <div
            className="px-4 py-2 text-[0.75rem] font-medium"
            role="status"
            style={{
              backgroundColor: state.ok ? "rgb(16 185 129 / 0.12)" : "rgb(244 63 94 / 0.12)",
              color: state.ok ? "rgb(5 150 105)" : "rgb(225 29 72)",
            }}
          >
            {state.message}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto scroll-thin border-b px-2 py-1.5">
          <button type="button" className="tab" data-active={category === "all"} onClick={() => setCategory("all")}>
            All
          </button>
          {categories.map(([slug, label]) => (
            <button key={slug} type="button" className="tab" data-active={category === slug} onClick={() => setCategory(slug)}>
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {cart.length === 0 ? (
            <p className="px-4 py-10 text-center text-[0.8125rem] faint">Tap a drink to add it.</p>
          ) : (
            <ul className="divide-y">
              {cart.map((l) => (
                <li key={l.key} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium leading-tight">
                        <span aria-hidden className="mr-1.5">{l.icon}</span>
                        {l.name}
                      </p>
                      {l.options.length > 0 && (
                        <p className="mt-0.5 text-[0.6875rem] leading-snug muted">
                          {l.options.map((o) => o.label).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="num shrink-0 text-[0.8125rem] font-semibold">
                      {money(l.unitPriceCents * l.qty)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex items-center rounded-md border">
                      <button
                        type="button"
                        className="px-2 py-0.5 text-xs leading-5 transition-colors hover:bg-[var(--surface-sunken)]"
                        onClick={() => changeQty(l.key, -1)}
                        aria-label={`Remove one ${l.name}`}
                      >
                        −
                      </button>
                      <span className="num w-6 text-center text-xs">{l.qty}</span>
                      <button
                        type="button"
                        className="px-2 py-0.5 text-xs leading-5 transition-colors hover:bg-[var(--surface-sunken)]"
                        onClick={() => changeQty(l.key, 1)}
                        disabled={l.qty >= 20}
                        aria-label={`Add one ${l.name}`}
                      >
                        +
                      </button>
                    </div>
                    <span className="num text-[0.6875rem] faint">{money(l.unitPriceCents)} each</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-2 border-t p-2.5">
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPicker(item)}
                className="card flex flex-col items-start gap-0.5 p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ cursor: "pointer" }}
              >
                <span className="text-base" aria-hidden>
                  {item.icon}
                </span>
                <span className="text-[0.75rem] font-semibold leading-tight">{item.name}</span>
                <span className="num mt-auto pt-0.5 text-[0.75rem] font-semibold" style={{ color: "var(--brand)" }}>
                  {money(item.base_price_cents)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 border-t px-3 py-3">
          {member && (
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-medium muted">
                Redeem a reward · {member.points.toLocaleString()} pts
              </span>
              <select
                className="field"
                value={rewardId ?? ""}
                onChange={(e) => setRewardId(e.target.value === "" ? null : Number(e.target.value))}
              >
                <option value="">No reward</option>
                {affordable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.points_cost} pts
                  </option>
                ))}
              </select>
              {affordable.length === 0 && rewards.length > 0 && (
                <span className="mt-1 block text-[0.6875rem] faint">
                  Next reward at {rewards[0]!.points_cost} points.
                </span>
              )}
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[0.6875rem] font-medium muted">Note for the bar</span>
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Extra hot, oat milk…"
              maxLength={200}
            />
          </label>
        </div>

        <div className="space-y-1 border-t px-4 py-3 text-[0.8125rem]">
          <div className="flex justify-between">
            <span className="muted">Subtotal</span>
            <span className="num">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="muted">Tax ({(taxRate * 100).toFixed(2)}%)</span>
            <span className="num">{money(totals.tax)}</span>
          </div>
          {totals.rewardValue > 0 && (
            <div className="flex justify-between" style={{ color: "rgb(5 150 105)" }}>
              <span>Reward</span>
              <span className="num">−{money(totals.rewardValue)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
            <span>Total</span>
            <span className="num">{money(totals.total)}</span>
          </div>
          <p className="pt-0.5 text-[0.6875rem] faint">
            {member
              ? `${totals.points} point${totals.points === 1 ? "" : "s"} when you collect it.`
              : "A loyalty record opens with this order."}
          </p>
        </div>

        <div className="border-t p-3">
          <button
            type="submit"
            disabled={pending || cart.length === 0 || blocked}
            className="btn btn-primary w-full py-2.5 text-sm"
          >
            {pending ? "Sending…" : `Send · ${money(totals.total)}`}
          </button>
          <p className="pt-1.5 text-center text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            {blocked
              ? "Confirm or finish the order you have on the go first."
              : `Nothing is made until you confirm, ${name.split(" ")[0]}.`}
          </p>
          {cart.length > 0 && (
            <button type="button" className="btn btn-ghost mt-1.5 w-full" onClick={() => setCart([])}>
              Clear
            </button>
          )}
        </div>
      </form>

      {picker && (
        <OptionPicker item={picker} onCancel={() => setPicker(null)} onConfirm={addLine} />
      )}
    </aside>
  );
}

function OptionPicker({
  item,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  onCancel: () => void;
  onConfirm: (item: MenuItem, chosen: ItemOption[]) => void;
}) {
  const groups = useMemo(() => mapGroups(item.options), [item]);
  const [picked, setPicked] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const [group, options] of mapGroups(item.options)) {
      const def = options.find((o) => o.is_default === 1) ?? options[0];
      if (def) initial[group] = def.id;
    }
    return initial;
  });

  const chosen = item.options.filter((o) => picked[o.group_name] === o.id);
  const unitPrice = item.base_price_cents + chosen.reduce((s, o) => s + o.price_delta_cents, 0);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ backgroundColor: "rgb(42 24 16 / 0.55)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Customise ${item.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="card flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden shadow-2xl">
        <header className="flex items-start gap-3 border-b px-4 py-3.5">
          <span className="text-2xl" aria-hidden>
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{item.name}</h2>
            <p className="mt-0.5 text-[0.75rem] muted">{item.description}</p>
          </div>
          <span className="num shrink-0 text-sm font-semibold" style={{ color: "var(--brand)" }}>
            {money(unitPrice)}
          </span>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-thin px-4 py-4">
          {groups.map(([group, options]) => (
            <fieldset key={group}>
              <legend
                className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                {group}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                  const active = picked[group] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPicked((p) => ({ ...p, [group]: o.id }))}
                      className="rounded-full border px-2.5 py-1 text-[0.75rem] font-medium transition-colors"
                      style={
                        active
                          ? {
                              backgroundColor: "var(--accent)",
                              borderColor: "var(--accent)",
                              color: "var(--color-cream-50)",
                            }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      {o.label}
                      {o.price_delta_cents > 0 && (
                        <span className="num ml-1 opacity-70">+{money(o.price_delta_cents)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <footer className="flex gap-2 border-t p-3">
          <button className="btn flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary flex-1" onClick={() => onConfirm(item, chosen)}>
            Add · {money(unitPrice)}
          </button>
        </footer>
      </div>
    </div>
  );
}

function mapGroups(options: ItemOption[]): Array<[string, ItemOption[]]> {
  const map = new Map<string, ItemOption[]>();
  for (const o of options) {
    const list = map.get(o.group_name) ?? [];
    list.push(o);
    map.set(o.group_name, list);
  }
  return [...map.entries()];
}
