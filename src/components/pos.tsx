"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { placeOrder, toggleMenuItem } from "@/lib/actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { money, pluralize } from "@/lib/format";
import type { ItemOption, MenuItem, Reward } from "@/lib/types";

type SimpleMember = { id: number; name: string; points: number };
type CartLine = {
  key: string;
  itemId: number;
  name: string;
  icon: string;
  qty: number;
  unitPriceCents: number;
  options: Array<{ optionId: number; label: string; group: string; priceDeltaCents: number }>;
};

const CHANNELS = [
  { id: "counter", label: "Counter" },
  { id: "mobile", label: "Mobile" },
  { id: "delivery", label: "Delivery" },
] as const;

export function Pos({
  menu,
  members,
  rewards,
  taxRate,
  pointsPerDollar,
  canManageMenu = false,
  canSell = true,
}: {
  menu: MenuItem[];
  members: SimpleMember[];
  rewards: Reward[];
  /** Read live from system settings rather than a build-time constant. */
  taxRate: number;
  pointsPerDollar: number;
  /** menu.manage — the on/off switch on each card. */
  canManageMenu?: boolean;
  /** orders.create — without it the cart cannot be sent to the board. */
  canSell?: boolean;
}) {
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picker, setPicker] = useState<MenuItem | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [channel, setChannel] = useState<string>("counter");
  const [note, setNote] = useState("");
  const [rewardId, setRewardId] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(placeOrder, EMPTY_STATE);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of menu) if (i.category_name) seen.set(i.category_slug!, i.category_name);
    return [...seen.entries()];
  }, [menu]);

  const visible = useMemo(
    () => (category === "all" ? menu : menu.filter((i) => i.category_slug === category)),
    [menu, category],
  );

  // Clear the ticket once the server confirms it.
  useEffect(() => {
    if (state.ok) {
      setCart([]);
      setCustomerName("");
      setNote("");
      setRewardId(null);
    }
  }, [state]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the banner when a new attempt starts
  useEffect(() => {
    if (state.message && !state.ok) setRewardId(null);
  }, [state]);

  const member = members.find((m) => m.id === memberId) ?? null;
  const availableRewards = rewards.filter((r) => member && member.points >= r.points_cost);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
    const tax = Math.round(subtotal * taxRate);
    const chosenReward = rewards.find((r) => r.id === rewardId) ?? null;
    const rewardValue = chosenReward?.kind === "discount" ? Math.min(chosenReward.value_cents, subtotal + tax) : 0;
    const total = subtotal + tax - rewardValue;
    const points = Math.floor((total / 100) * pointsPerDollar);
    return { subtotal, tax, rewardValue, total, points, count: cart.reduce((s, l) => s + l.qty, 0) };
  }, [cart, rewardId, rewards, taxRate, pointsPerDollar]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        customerName,
        memberId,
        channel,
        note,
        rewardId,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          optionIds: l.options.map((o) => o.optionId),
        })),
      }),
    [cart, customerName, memberId, channel, note, rewardId],
  );

  function addLine(item: MenuItem, chosen: ItemOption[]) {
    const key = `${item.id}:${chosen.map((o) => o.id).sort().join("-")}`;
    const unitPriceCents =
      item.base_price_cents + chosen.reduce((s, o) => s + o.price_delta_cents, 0);

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
            group: o.group_name,
            priceDeltaCents: o.price_delta_cents,
          })),
        },
      ];
    });
    setPicker(null);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ---------------- Menu ---------------- */}
      <div className="min-w-0">
        <header className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Point of Sale</h1>
          <p className="mt-1 text-sm muted">
            Pick a drink, choose its options, send it to the board.
          </p>
        </header>

        <div className="mb-4 flex gap-1 overflow-x-auto scroll-thin border-b pb-px">
          <button
            className="tab"
            data-active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {categories.map(([slug, name]) => (
            <button
              key={slug}
              className="tab"
              data-active={category === slug}
              onClick={() => setCategory(slug)}
            >
              {name}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <p className="text-3xl opacity-40" aria-hidden>
              ☕
            </p>
            <p className="mt-2 text-sm font-medium">No menu items yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs faint">
              This database has the schema but no products. Add rows to{" "}
              <code className="font-mono">menu_items</code> and{" "}
              <code className="font-mono">categories</code>, or run{" "}
              <code className="font-mono">npm run db:reset</code> to load the demo catalogue.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((item) => (
              <button
                key={item.id}
                onClick={() => setPicker(item)}
                className="card group flex flex-col items-start gap-1 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ cursor: "pointer" }}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-xl" aria-hidden>
                    {item.icon}
                  </span>
                  {item.is_signature === 1 && (
                    <span
                      className="chip ring-1 ring-inset"
                      style={{
                        backgroundColor: "var(--brand-soft)",
                        color: "var(--brand)",
                        borderColor: "transparent",
                      }}
                    >
                      ★
                    </span>
                  )}
                </div>
                <p className="text-[0.8125rem] font-semibold leading-tight">{item.name}</p>
                <p className="line-clamp-2 text-[0.6875rem] leading-snug muted">{item.description}</p>
                <p className="num mt-auto pt-1 text-[0.8125rem] font-semibold" style={{ color: "var(--brand)" }}>
                  {money(item.base_price_cents)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- Ticket ---------------- */}
      <aside className="xl:sticky xl:top-5 xl:h-[calc(100dvh-2.5rem)]">
        <form action={formAction} className="card flex h-full flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Ticket</h2>
            <span className="num text-[0.6875rem] muted">
              {pluralize(totals.count, "item")}
            </span>
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

          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
            {cart.length === 0 ? (
              <p className="px-4 py-10 text-center text-[0.8125rem] faint">
                Tap an item to start the ticket.
              </p>
            ) : (
              <ul className="divide-y">
                {cart.map((l) => (
                  <li key={l.key} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-medium leading-tight">
                          <span aria-hidden className="mr-1.5">
                            {l.icon}
                          </span>
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
                      <span className="num text-[0.6875rem] faint">
                        {money(l.unitPriceCents)} each
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Customer + loyalty */}
          <div className="space-y-2.5 border-t px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium muted">Customer</span>
                <input
                  className="field"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in"
                  disabled={member !== null}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium muted">Channel</span>
                <select className="field" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-medium muted">Loyalty member</span>
              <select
                className="field"
                value={memberId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setMemberId(v === "" ? null : Number(v));
                  setRewardId(null);
                }}
              >
                <option value="">No member — earn nothing</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.points.toLocaleString()} pts
                  </option>
                ))}
              </select>
            </label>

            {member && (
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium muted">Redeem reward</span>
                <select
                  className="field"
                  value={rewardId ?? ""}
                  onChange={(e) => setRewardId(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">No reward</option>
                  {availableRewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.points_cost} pts
                    </option>
                  ))}
                </select>
                {availableRewards.length === 0 && (
                  <span className="mt-1 block text-[0.6875rem] faint">
                    Next reward unlocks at {rewards[0]?.points_cost ?? 0} points.
                  </span>
                )}
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-medium muted">Note</span>
              <input
                className="field"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Extra hot, oat milk…"
              />
            </label>
          </div>

          {/* Totals */}
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
                ? `${member.name} earns ${totals.points} pt${totals.points === 1 ? "" : "s"} · balance ${(member.points + totals.points - (rewards.find((r) => r.id === rewardId)?.points_cost ?? 0)).toLocaleString()}`
                : "Attach a member to start earning points."}
            </p>
          </div>

          <div className="border-t p-3">
            <button
              type="submit"
              disabled={pending || cart.length === 0 || !canSell}
              className="btn btn-primary w-full py-2.5 text-sm"
              title={canSell ? undefined : "Your role cannot ring up orders (needs orders.create)"}
            >
              {pending ? "Placing…" : `Send to board · ${money(totals.total)}`}
            </button>
            {!canSell && (
              <p className="pt-1.5 text-center text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                You can build a ticket, but not send it to the board.
              </p>
            )}
            {cart.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost mt-1.5 w-full"
                onClick={() => setCart([])}
              >
                Clear ticket
              </button>
            )}
          </div>
        </form>
      </aside>

      {picker && (
        <OptionPicker
          item={picker}
          canManageMenu={canManageMenu}
          onCancel={() => setPicker(null)}
          onConfirm={addLine}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------

function OptionPicker({
  item,
  canManageMenu,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  canManageMenu: boolean;
  onCancel: () => void;
  onConfirm: (item: MenuItem, chosen: ItemOption[]) => void;
}) {
  // One selection per group, pre-filled with the default option.
  const groups = useMemo(() => {
    const map = new Map<string, ItemOption[]>();
    for (const o of item.options) {
      const list = map.get(o.group_name) ?? [];
      list.push(o);
      map.set(o.group_name, list);
    }
    return [...map.entries()];
  }, [item]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm(item, chosen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, item, onCancel, onConfirm]);

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
              <legend className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
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
                          ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)", color: "var(--color-cream-50)" }
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

        {canManageMenu && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
            <span className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
              Sold out?
            </span>
            <MenuToggleButton itemId={item.id} active={item.active === 1} />
          </div>
        )}

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

/** Takes an item off the till and puts it back. Needs menu.manage. */
function MenuToggleButton({ itemId, active }: { itemId: number; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(active);

  function flip() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await toggleMenuItem(itemId, next);
      } catch {
        setOn(!next); // The server refused; put the switch back.
      }
    });
  }

  return (
    <button
      type="button"
      className="btn py-1.5 text-[0.75rem]"
      onClick={flip}
      disabled={pending}
      title={on ? "Take this item off the till" : "Put this item back on the till"}
    >
      {pending ? "Saving…" : on ? "Take off till" : "Back on till"}
    </button>
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
