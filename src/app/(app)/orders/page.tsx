import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { OrderBoard } from "@/components/order-board";
import { gate } from "@/lib/auth";
import { money, timeAgo } from "@/lib/format";
import { getOpenOrders, getOrders } from "@/lib/queries";
import { STATUS_META, type Order, type OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { user, denied } = await gate("orders.view");
  if (denied) return denied;

  const open = getOpenOrders();
  const recent = getOrders().filter((o) => o.status === "completed" || o.status === "cancelled").slice(0, 25);

  const byStatus = (s: OrderStatus) => open.filter((o) => o.status === s);
  const incoming = byStatus("pending").length;
  const waiting = byStatus("received").length;
  const brewing = byStatus("brewing").length;
  const ready = byStatus("ready").length;
  const openValue = open.reduce((s, o) => s + o.total_cents, 0);

  return (
    <>
      <PageHeader
        title="Order Board"
        subtitle="Work the queue left to right. Stock is deducted when the ticket is sent, not when it is finished."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Incoming"
          value={incoming}
          tone={incoming > 0 ? "warn" : "default"}
          hint="Waiting on the customer"
        />
        <Stat label="Waiting" value={waiting} tone={waiting > 4 ? "warn" : "default"} hint="Not started yet" />
        <Stat label="On the bar" value={brewing} hint="Being made now" />
        <Stat label="Ready" value={ready} tone={ready > 0 ? "good" : "default"} hint="Waiting for pickup" />
        <Stat label="Open value" value={money(openValue)} hint="Across all open tickets" />
      </div>

      <OrderBoard
        columns={BOARD_COLUMNS.map((s) => ({ status: s, orders: byStatus(s) }))}
        canManage={user!.permissions.has("orders.manage")}
      />

      <Card
        title="Recently closed"
        subtitle="Completed and cancelled tickets"
        className="mt-4"
        bodyClassName="p-0"
      >
        {recent.length === 0 ? (
          <EmptyState icon="▤" title="Nothing closed yet today" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b">
                  <th className="th">Order</th>
                  <th className="th">Customer</th>
                  <th className="th">Items</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Points</th>
                  <th className="th text-right">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((o) => (
                  <Row key={o.id} order={o} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * The columns on the board.
 *
 * `pending` is first because a customer order that has not been confirmed yet
 * is not the bar's to work on — but it is shown, so they can get ahead of it.
 */
const BOARD_COLUMNS: OrderStatus[] = ["pending", "received", "brewing", "ready"];

function Row({ order }: { order: Order }) {
  const meta = STATUS_META[order.status];
  const itemCount = order.items?.reduce((s, i) => s + i.qty, 0) ?? 0;

  return (
    <tr className="transition-colors hover:bg-[var(--surface-sunken)]">
      <td className="td num font-medium">{order.order_number}</td>
      <td className="td">
        <span className="block max-w-[12rem] truncate">{order.member_name ?? order.customer_name}</span>
        <span className="text-[0.6875rem] capitalize" style={{ color: "var(--text-faint)" }}>
          {order.channel}
          {order.note ? ` · ${order.note}` : ""}
        </span>
      </td>
      <td className="td" style={{ color: "var(--text-muted)" }}>
        <span className="block max-w-[16rem] truncate">
          {order.items?.map((i) => `${i.qty}× ${i.name_snapshot}`).join(", ")}
        </span>
      </td>
      <td className="td">
        <span className={`chip ring-1 ring-inset ${meta.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="td num text-right font-medium">{money(order.total_cents)}</td>
      <td className="td num text-right" style={{ color: "var(--text-muted)" }}>
        {order.points_earned > 0 ? `+${order.points_earned}` : "—"}
      </td>
      <td className="td num text-right" style={{ color: "var(--text-faint)" }}>
        {timeAgo(order.updated_at)}
      </td>
    </tr>
  );
}
