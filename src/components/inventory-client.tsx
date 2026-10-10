"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import { adjustStock, createRestockForLow, setRestockStatus } from "@/lib/actions";
import { money, pluralize, qty as fmtQty } from "@/lib/format";
import { ProgressBar } from "@/components/ui";
import type { InventoryItem, RestockOrder } from "@/lib/types";

type Filter = "all" | "low" | "out";

export function InventoryClient({
  items,
  restock = [],
  canAdjust = false,
  canPurchase = false,
}: {
  items: InventoryItem[];
  restock?: RestockOrder[];
  /** inventory.adjust — the per-row stock correction control. */
  canAdjust?: boolean;
  /** inventory.manage — raising and receiving purchase orders. */
  canPurchase?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))],
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (filter === "low" && i.is_low !== 1) return false;
      if (filter === "out" && i.is_out !== 1) return false;
      if (q && !`${i.name} ${i.sku} ${i.supplier}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, category, filter]);

  const lowCount = items.filter((i) => i.is_low === 1).length;

  function commit(item: InventoryItem, delta: number, why: string) {
    setEditing(null);
    setAmount("");
    setReason("");
    if (delta === 0) return;
    startTransition(async () => {
      await adjustStock(item.id, delta, why);
      setFlash(`${item.name} ${delta > 0 ? "+" : ""}${fmtQty(delta)} ${item.unit}`);
      router.refresh();
      setTimeout(() => setFlash(null), 2500);
    });
  }

  function generatePOs() {
    startTransition(async () => {
      await createRestockForLow();
      setFlash("Purchase orders generated");
      router.refresh();
      setTimeout(() => setFlash(null), 2500);
    });
  }

  return (
    <section className="card overflow-hidden">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
        <input
          className="field max-w-[13rem] flex-1"
          placeholder="Search name, SKU or supplier…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="field w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border p-0.5">
          {(["all", "low", "out"] as const).map((f) => (
            <button
              key={f}
              className="rounded-md px-2.5 py-1 text-[0.75rem] font-medium capitalize transition-colors"
              style={
                filter === f
                  ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" }
                  : { color: "var(--text-muted)" }
              }
              onClick={() => setFilter(f)}
            >
              {f === "out" ? "Out" : f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {flash && (
            <span className="text-[0.6875rem]" style={{ color: "rgb(5 150 105)" }}>
              {flash}
            </span>
          )}
          <span className="num text-[0.6875rem] faint">{pluralize(visible.length, "item")}</span>
          {canPurchase && (
            <button
              className="btn btn-primary"
              disabled={pending || lowCount === 0}
              onClick={generatePOs}
              title={
                lowCount === 0
                  ? "Nothing is below its reorder level"
                  : `Create one purchase order per supplier for ${lowCount} items`
              }
            >
              {pending ? "Working…" : `Restock ${lowCount} low`}
            </button>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[840px]">
          <thead>
            <tr className="border-b">
              <th className="th">Item</th>
              <th className="th">Category</th>
              <th className="th">On hand</th>
              <th className="th w-36">Level</th>
              <th className="th text-right">Value</th>
              <th className="th">Supplier</th>
              <th className="th text-right">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <p className="py-10 text-center text-[0.8125rem] faint">Nothing matches that filter.</p>
                </td>
              </tr>
            ) : (
              visible.map((item) => {
                const out = item.is_out === 1;
                const low = item.is_low === 1;
                const ratio = item.reorder_level > 0 ? item.qty_on_hand / item.reorder_level : 0;

                return (
                  <Fragment key={item.id}>
                    <tr className="transition-colors hover:bg-[var(--surface-sunken)]">
                      <td className="td">
                        <span className="block max-w-[14rem] truncate font-medium">{item.name}</span>
                        <span className="num text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                          {item.sku}
                        </span>
                      </td>
                      <td className="td muted">{item.category}</td>
                      <td className="td">
                        <span
                          className={`num font-semibold ${out ? "text-rose-600 dark:text-rose-400" : low ? "text-amber-600 dark:text-amber-400" : ""}`}
                        >
                          {fmtQty(item.qty_on_hand)}
                        </span>{" "}
                        <span className="text-[0.6875rem] faint">{item.unit}</span>
                        {out && (
                          <span className="chip ml-1.5 bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
                            out
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <ProgressBar
                          value={Math.min(ratio, 1.5)}
                          max={1.5}
                          tone={out ? "rgb(244 63 94)" : low ? "rgb(245 158 11)" : "rgb(16 185 129)"}
                        />
                        <span className="num mt-1 block text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                          reorder {fmtQty(item.reorder_level)} {item.unit}
                        </span>
                      </td>
                      <td className="td num text-right">{money(item.value_cents ?? 0)}</td>
                      <td className="td max-w-[10rem] truncate muted">{item.supplier}</td>
                      <td className="td text-right">
                        {!canAdjust ? (
                          <span className="text-[0.6875rem] faint">read only</span>
                        ) : editing === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              className="field num w-16 py-1 text-right text-xs"
                              placeholder="±qty"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commit(item, Number(amount), reason);
                                if (e.key === "Escape") setEditing(null);
                              }}
                              autoFocus
                            />
                            <input
                              className="field w-28 py-1 text-xs"
                              placeholder="Reason"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                            />
                            <button
                              className="btn btn-primary px-2 py-1"
                              disabled={pending}
                              onClick={() => commit(item, Number(amount), reason)}
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn px-2 py-1"
                            onClick={() => {
                              setEditing(item.id);
                              setAmount("");
                              setReason("");
                            }}
                          >
                            Adjust
                          </button>
                        )}
                      </td>
                    </tr>
                    {canAdjust && editing === item.id && (
                      <tr>
                        <td colSpan={7} className="td" style={{ paddingTop: 0 }}>
                          <div className="flex flex-wrap gap-1.5 pb-1">
                            {[
                              [-1, -10, "Waste"],
                              [1, 10, "Delivery"],
                              [1, 50, "Stock count"],
                            ].map(([sign, qty, label]) => (
                              <button
                                key={String(label)}
                                className="chip border transition-colors hover:bg-[var(--surface-sunken)]"
                                onClick={() =>
                                  commit(item, Number(sign) * Number(qty), String(label))
                                }
                              >
                                {Number(sign) > 0 ? "+" : ""}
                                {qty} {item.unit} · {label}
                              </button>
                            ))}
                            <span className="chip faint">
                              Expected to reorder {fmtQty(item.reorder_qty)} {item.unit}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {canPurchase && restock.some((r) => r.status === "ordered") && (
        <footer className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
          <span className="text-[0.75rem] muted">Receive a delivery:</span>
          {restock
            .filter((r) => r.status === "ordered")
            .map((r) => (
              <button
                key={r.id}
                className="btn btn-primary py-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setRestockStatus(r.id, "received");
                    router.refresh();
                  })
                }
              >
                PO-{r.id} · {r.supplier} (+
                {r.lines?.reduce((s, l) => s + l.qty, 0) ?? 0} units)
              </button>
            ))}
        </footer>
      )}
    </section>
  );
}
