/**
 * Reads for the customer ordering page.
 *
 * The writes live in ./my-order-actions, because a "use server" module may only
 * export async functions and this file exports types too.
 *
 * Every query here is scoped to one account. "My order" is a join from
 * `users.member_id` rather than a name match, so two people called Sam cannot
 * see each other's coffee, and `channel = 'self'` keeps a staff order rung up
 * at the counter out of the customer's list.
 */
import { all, get } from "./db";
import type { OrderStatus } from "./types";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type MyOrderItem = {
  name: string;
  qty: number;
  line_total_cents: number;
  options: string[];
};

export type MyOrder = {
  id: number;
  order_number: string;
  status: OrderStatus;
  note: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  points_earned: number;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  collected_at: string | null;
  items: MyOrderItem[];
};

export type MyMember = {
  id: number;
  name: string;
  email: string;
  phone: string;
  points: number;
  joined_at: string;
  last_visit_at: string | null;
};

export type MyReward = {
  id: number;
  name: string;
  description: string;
  kind: string;
  points_cost: number;
  value_cents: number;
};

/** The statuses a customer is still waiting on. Anything else is history. */
const OPEN_STATUSES: OrderStatus[] = ["pending", "received", "brewing", "ready"];

// ---------------------------------------------------------------
// Reads
// ---------------------------------------------------------------

/** Attach the lines and their option labels to a set of orders. */
function withItems(orders: Array<Omit<MyOrder, "items">>): MyOrder[] {
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);
  const rows = all<{
    order_id: number;
    name_snapshot: string;
    qty: number;
    line_total_cents: number;
    options_json: string;
  }>(
    `SELECT order_id, name_snapshot, qty, line_total_cents, options_json
       FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})
      ORDER BY id`,
    ...ids,
  );

  const byOrder = new Map<number, MyOrderItem[]>();
  for (const r of rows) {
    const list = byOrder.get(r.order_id) ?? [];
    list.push({
      name: r.name_snapshot,
      qty: r.qty,
      line_total_cents: r.line_total_cents,
      options: (JSON.parse(r.options_json || "[]") as Array<{ label: string }>).map((o) => o.label),
    });
    byOrder.set(r.order_id, list);
  }

  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}

const ORDER_COLUMNS = `o.id, o.order_number, o.status, o.note, o.subtotal_cents,
            o.tax_cents, o.total_cents, o.points_earned, o.created_at,
            o.updated_at, o.confirmed_at, o.collected_at`;

/** This account's own orders, newest first. */
export function getMyOrders(userId: number, limit = 12): MyOrder[] {
  const rows = all<Omit<MyOrder, "items">>(
    `SELECT ${ORDER_COLUMNS}
       FROM orders o
       JOIN users u ON u.id = ? AND u.member_id = o.member_id
      WHERE o.channel = 'self'
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT ?`,
    userId,
    limit,
  );
  return withItems(rows);
}

/** The newest order still in progress, which is the one worth tracking. */
export function getLiveMyOrder(userId: number): MyOrder | null {
  const rows = all<Omit<MyOrder, "items">>(
    `SELECT ${ORDER_COLUMNS}
       FROM orders o
       JOIN users u ON u.id = ? AND u.member_id = o.member_id
      WHERE o.channel = 'self'
        AND o.status IN ('pending', 'received', 'brewing', 'ready')
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 1`,
    userId,
  );
  return withItems(rows)[0] ?? null;
}

/**
 * The loyalty record behind this account, or null.
 *
 * Null before the first order: the record is created on demand by the place
 * action, so nobody accumulates a loyalty row by signing up.
 */
export function getMyMember(userId: number): MyMember | null {
  return (
    get<MyMember>(
      `SELECT m.id, m.name, m.email, m.phone, m.points, m.joined_at, m.last_visit_at
         FROM members m
         JOIN users u ON u.member_id = m.id
        WHERE u.id = ?`,
      userId,
    ) ?? null
  );
}

/** Active rewards, cheapest first, so the affordable ones are near the top. */
export function getMyRewards(): MyReward[] {
  return all<MyReward>(
    `SELECT id, name, description, kind, points_cost, value_cents
       FROM rewards WHERE active = 1 ORDER BY points_cost ASC, id ASC`,
  );
}

export { OPEN_STATUSES };
