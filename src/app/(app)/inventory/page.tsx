import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { InventoryClient } from "@/components/inventory-client";
import { gate } from "@/lib/auth";
import { money, pluralize, qty as fmtQty, timeAgo } from "@/lib/format";
import { getInventory, getInventoryTxns, getRestockOrders } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { user, denied } = await gate("inventory.view");
  if (denied) return denied;
  const items = getInventory();
  const restock = getRestockOrders();
  const txns = getInventoryTxns(undefined, 18);

  const low = items.filter((i) => i.is_low === 1);
  const out = items.filter((i) => i.is_out === 1);
  const totalValue = items.reduce((s, i) => s + (i.value_cents ?? 0), 0);
  const categories = [...new Set(items.map((i) => i.category))];
  const openPo = restock.filter((r) => r.status === "draft" || r.status === "ordered");

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Beans, milk, syrups, pastry and packaging. Every sale deducts from here automatically."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Stock value" value={money(totalValue)} hint={`${pluralize(items.length, "item")} tracked`} />
        <Stat
          label="Low stock"
          value={low.length}
          tone={low.length > 0 ? "warn" : "good"}
          hint="At or below reorder level"
        />
        <Stat
          label="Out of stock"
          value={out.length}
          tone={out.length > 0 ? "bad" : "good"}
          hint={out.length ? "Cannot be made right now" : "Nothing depleted"}
        />
        <Stat
          label="Open purchase orders"
          value={openPo.length}
          hint={`${pluralize(categories.length, "category")}`}
        />
      </div>

      <InventoryClient
        items={items}
        restock={restock}
        canAdjust={user!.permissions.has("inventory.adjust")}
        canPurchase={user!.permissions.has("inventory.manage")}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Purchase orders" subtitle="Grouped by supplier" bodyClassName="p-0">
          {restock.length === 0 ? (
            <EmptyState icon="▦" title="No purchase orders" hint="Generate one from the low stock list." />
          ) : (
            <ul className="divide-y">
              {restock.map((po) => {
                const cost = po.lines?.reduce((s, l) => s + l.qty * l.unit_cost_cents, 0) ?? 0;
                const tone =
                  po.status === "received"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30"
                    : po.status === "ordered"
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30"
                      : "bg-stone-500/15 text-stone-600 dark:text-stone-300 ring-stone-500/30";
                return (
                  <li key={po.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-medium">
                        <span className="num faint">PO-{po.id} · </span>
                        {po.supplier}
                      </p>
                      <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                        {pluralize(po.lines?.length ?? 0, "line")} · {money(cost)} · {timeAgo(po.created_at)}
                      </p>
                    </div>
                    <span className={`chip shrink-0 capitalize ring-1 ring-inset ${tone}`}>{po.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent stock movements" subtitle="Sales, deliveries and corrections" bodyClassName="p-0">
          {txns.length === 0 ? (
            <EmptyState icon="↕" title="No movements yet" />
          ) : (
            <ul className="divide-y">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem]">{t.item_name}</p>
                    <p className="text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {t.reason}
                      {t.reference ? ` · ${t.reference}` : ""} · {timeAgo(t.at)}
                    </p>
                  </div>
                  <span
                    className="num shrink-0 text-[0.8125rem] font-medium"
                    style={{ color: t.delta < 0 ? "rgb(225 29 72)" : "rgb(5 150 105)" }}
                  >
                    {t.delta > 0 ? "+" : ""}
                    {fmtQty(t.delta)} {t.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
