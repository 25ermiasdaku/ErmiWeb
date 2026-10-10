/**
 * The business logic for a customer ordering coffee for themselves.
 *
 * Split out of `my-order-actions.ts` so it can be called from two entry points
 * that authenticate differently: the web server action (a session cookie) and
 * the mobile JSON API (a bearer token). The permission check is deliberately
 * NOT here — each entry point proves who the caller is in its own idiom and
 * passes the resolved user in. That keeps the "hidden link is not a security
 * boundary" rule intact while letting both surfaces share one implementation.
 *
 * A customer order starts at `pending` and moves through a two-sided handshake:
 *   pending -> received   "yes, I want this, start it"   (deducts stock)
 *   ready   -> completed  "I collected it"                (banks points)
 * Neither transition is ever made on the customer's behalf.
 */
import { all, get, run, tx } from "./db";
import { logActivity } from "./activity";
import { getPointsPerDollar, getTaxRate } from "./settings";
import { priceLines, resolveDeductions, type LineRequest } from "./fulfilment";
import { ALLOWED_NEXT, isCustomerTransition } from "./order-flow";
import { getLiveMyOrder } from "./my-order";
import { nextOrderNumber } from "./queries";
import type { SessionUser } from "./auth";
import type { OrderStatus } from "./types";
import type { ActionState } from "./action-state";

const NOTE_LIMIT = 200;
/**
 * One order at a time.
 *
 * The point of the pending step is that "confirm" is unambiguous. With two
 * orders on the go, one button cannot mean "yes to both". One at a time is a
 * smaller promise than the cafe can keep, and the flow stays honest.
 */
const MAX_OPEN_ORDERS = 1;

export type ConfirmResult = { ok: boolean; message: string };

export type PlaceOrderInput = {
  lines: LineRequest[];
  note: string;
  rewardId: number | null;
};

/** Place an order on your own account. Starts life as `pending`. */
export async function placeOrder(user: SessionUser, input: PlaceOrderInput): Promise<ActionState> {
  const lines = input.lines ?? [];
  const note = String(input.note ?? "").slice(0, NOTE_LIMIT);
  const rewardId = typeof input.rewardId === "number" ? input.rewardId : null;

  // Points need somewhere to land. Staff accounts have member_id NULL, so link
  // (or create) a loyalty record the first time somebody orders for themselves.
  const memberId = ensureMemberFor(user.id, user.full_name, user.email);
  if (memberId === null) {
    return {
      ok: false,
      message: "We could not open a loyalty record for you. Please ask at the counter.",
    };
  }

  // One order may be in progress at a time, or "confirm" is ambiguous.
  if (MAX_OPEN_ORDERS > 0 && getLiveMyOrder(user.id)) {
    return {
      ok: false,
      message:
        "You already have an order on the go. Confirm or cancel that one first, then order again.",
    };
  }

  try {
    // Prices come from the database, never from the client. A crafted payload
    // cannot invent a price, exactly as at the till.
    const priced = priceLines(lines);
    const taxRate = getTaxRate();

    const subtotal = priced.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
    const tax = Math.round(subtotal * taxRate);
    let total = subtotal + tax;

    const member = get<{ id: number; points: number }>(
      "SELECT id, points FROM members WHERE id = ?",
      memberId,
    )!;

    let pointsSpent = 0;
    let rewardValue = 0;
    let rewardName = "";
    if (rewardId !== null) {
      const reward = get<{
        id: number;
        name: string;
        points_cost: number;
        value_cents: number;
        kind: string;
        active: number;
      }>("SELECT * FROM rewards WHERE id = ?", rewardId);
      if (!reward || reward.active !== 1) throw new Error("That reward is no longer available.");
      if (member.points < reward.points_cost) {
        throw new Error(
          `You need ${reward.points_cost - member.points} more point(s) for ${reward.name}.`,
        );
      }
      pointsSpent = reward.points_cost;
      // A discount caps at the bill; a freebie takes the price off at the counter.
      rewardValue = reward.kind === "discount" ? Math.min(reward.value_cents, total) : 0;
      rewardName = reward.name;
      total -= rewardValue;
    }

    // Worked out now, banked at collection, so a cancelled or never-confirmed
    // order cannot mint points.
    const pointsEarned = Math.floor((total / 100) * getPointsPerDollar());
    const orderNumber = nextOrderNumber();

    const orderId = tx(() => {
      const inserted = run(
        `INSERT INTO orders
           (order_number, status, channel, customer_name, member_id, placed_by,
            subtotal_cents, tax_cents, total_cents, points_earned, points_spent, note)
         VALUES (?, 'pending', 'self', ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        orderNumber,
        user.full_name,
        memberId,
        subtotal,
        tax,
        total,
        pointsEarned,
        pointsSpent,
        note,
      );
      const id = Number(inserted.lastInsertRowid);

      for (const l of priced) {
        run(
          `INSERT INTO order_items
             (order_id, menu_item_id, name_snapshot, qty, unit_price_cents,
              line_total_cents, options_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id,
          l.itemId,
          l.name,
          l.qty,
          l.unitPriceCents,
          l.unitPriceCents * l.qty,
          JSON.stringify(
            l.options.map((o) => ({ label: o.label, priceDeltaCents: o.priceDeltaCents })),
          ),
        );
      }

      run("INSERT INTO order_events (order_id, status) VALUES (?, 'pending')", id);

      // Spending happens up front, so a cancellation has to hand it back. Held
      // inside the same transaction as the order or the two could disagree.
      if (pointsSpent > 0) {
        const balance = member.points - pointsSpent;
        run("UPDATE members SET points = ? WHERE id = ?", balance, memberId);
        run(
          `INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason)
           VALUES (?, ?, ?, ?, ?)`,
          memberId,
          id,
          -pointsSpent,
          balance,
          `Redeemed: ${rewardName}`,
        );
        run(
          `INSERT INTO redemptions (member_id, reward_id, order_id, points_spent, value_cents)
           VALUES (?, ?, ?, ?, ?)`,
          memberId,
          rewardId,
          id,
          pointsSpent,
          rewardValue,
        );
      }

      return id;
    });

    logActivity({
      action: "order.self_place",
      entity: "order",
      entityId: orderId,
      userId: user.id,
      username: user.username,
      detail: `${orderNumber} · ${priced.length} line(s) · $${(total / 100).toFixed(2)} · awaiting confirmation`,
    });

    return {
      ok: true,
      message: `${orderNumber} sent. Confirm it and the bar will start.`,
      orderId,
      orderNumber,
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/**
 * Confirm an order, at whichever end is waiting on you.
 *
 * One function for both, chosen by the order's current status, because
 * "confirm" means the same thing to the customer either way: yes, this is
 * right. The server decides which transition applies and refuses everything
 * else, so a crafted call cannot jump a ticket straight to `completed`.
 */
export function confirmOrder(user: SessionUser, orderId: number): ConfirmResult {
  const order = loadOwnOrder(orderId, user.id);
  if (!order) return { ok: false, message: "That order is not yours." };

  const to: OrderStatus | null =
    order.status === "pending" ? "received" : order.status === "ready" ? "completed" : null;
  if (!to || !isCustomerTransition(order.status, to) || !ALLOWED_NEXT[order.status].includes(to)) {
    return { ok: false, message: "There is nothing to confirm on that order right now." };
  }

  tx(() => {
    run(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      to,
      orderId,
    );
    run("INSERT INTO order_events (order_id, status) VALUES (?, ?)", orderId, to);

    if (to === "received") {
      // The cafe is committed now, so this is where stock leaves the shelf.
      run("UPDATE orders SET confirmed_at = datetime('now') WHERE id = ?", orderId);
      deductStock(orderId, order.order_number);
    } else {
      run("UPDATE orders SET collected_at = datetime('now') WHERE id = ?", orderId);
      bankPoints(orderId);
    }
  });

  logActivity({
    action: to === "received" ? "order.self_confirm" : "order.self_collect",
    entity: "order",
    entityId: orderId,
    userId: user.id,
    username: user.username,
    detail:
      to === "received"
        ? `${order.order_number}: customer confirmed, cafe accepted`
        : `${order.order_number}: customer confirmed collection`,
  });

  return {
    ok: true,
    message:
      to === "received"
        ? `Confirmed. ${order.order_number} is with the bar now.`
        : `Enjoy. ${order.points_earned} point(s) added to your balance.`,
  };
}

/** Withdraw an order the cafe has not started yet. */
export function cancelOrder(user: SessionUser, orderId: number): ConfirmResult {
  const order = loadOwnOrder(orderId, user.id);
  if (!order) return { ok: false, message: "That order is not yours." };

  if (order.status !== "pending") {
    return {
      ok: false,
      message: "That order is already being made, so it cannot be withdrawn. Please ask at the counter.",
    };
  }

  tx(() => {
    run("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", orderId);
    run("INSERT INTO order_events (order_id, status) VALUES (?, 'cancelled')", orderId);
    // Nothing was deducted, so this is only ever about giving points back.
    refundPoints(orderId);
  });

  logActivity({
    action: "order.self_cancel",
    entity: "order",
    entityId: orderId,
    userId: user.id,
    username: user.username,
    detail: `${order.order_number}: customer withdrew the order`,
  });

  return { ok: true, message: `${order.order_number} cancelled.` };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Load an order only if this account placed it.
 *
 * Ownership is part of the WHERE clause, not a check afterwards, so there is no
 * point at which somebody else's order is in memory to leak.
 */
function loadOwnOrder(orderId: number, userId: number) {
  return get<{
    id: number;
    order_number: string;
    status: OrderStatus;
    points_earned: number;
    member_id: number | null;
  }>(
    `SELECT o.id, o.order_number, o.status, o.points_earned, o.member_id
       FROM orders o
       JOIN users u ON u.member_id = o.member_id AND u.id = ?
      WHERE o.id = ? AND o.channel = 'self'`,
    userId,
    orderId,
  );
}

/** Link the account to a loyalty record, creating one the first time. */
function ensureMemberFor(userId: number, fullName: string, email: string): number | null {
  const existing = get<{ member_id: number | null }>(
    "SELECT member_id FROM users WHERE id = ?",
    userId,
  );
  if (existing?.member_id) return existing.member_id;

  // members.email is UNIQUE, so somebody who already has a loyalty record under
  // this address joins it rather than being created twice.
  const byEmail = get<{ id: number }>("SELECT id FROM members WHERE email = ?", email);
  const memberId =
    byEmail?.id ??
    Number(run("INSERT INTO members (name, email) VALUES (?, ?)", fullName, email).lastInsertRowid);

  run("UPDATE users SET member_id = ?, updated_at = datetime('now') WHERE id = ?", memberId, userId);
  return memberId;
}

/** Take the recipe's ingredients off the shelf. */
function deductStock(orderId: number, orderNumber: string): void {
  const lines = all<{ menu_item_id: number | null; qty: number; options_json: string }>(
    "SELECT menu_item_id, qty, options_json FROM order_items WHERE order_id = ?",
    orderId,
  );
  for (const l of lines) {
    if (l.menu_item_id === null) continue;
    const labels = (JSON.parse(l.options_json || "[]") as Array<{ label: string }>).map((o) => o.label);
    for (const d of resolveDeductions([{ itemId: l.menu_item_id, qty: l.qty, optionLabels: labels }])) {
      const inv = get<{ id: number }>("SELECT id FROM inventory_items WHERE sku = ?", d.sku);
      if (!inv) continue;
      run(
        "UPDATE inventory_items SET qty_on_hand = ROUND(qty_on_hand - ?, 3), updated_at = datetime('now') WHERE id = ?",
        d.qty,
        inv.id,
      );
      run(
        "INSERT INTO inventory_txns (inventory_item_id, delta, reason, reference) VALUES (?, ?, ?, ?)",
        inv.id,
        -d.qty,
        "Order sale",
        orderNumber,
      );
    }
  }
}

/** Bank the points worked out when the order was placed. */
function bankPoints(orderId: number): void {
  const order = get<{ member_id: number | null; points_earned: number }>(
    "SELECT member_id, points_earned FROM orders WHERE id = ?",
    orderId,
  );
  if (!order?.member_id) return;

  if (order.points_earned <= 0) {
    run("UPDATE members SET last_visit_at = datetime('now') WHERE id = ?", order.member_id);
    return;
  }

  const member = get<{ points: number }>("SELECT points FROM members WHERE id = ?", order.member_id)!;
  const balance = member.points + order.points_earned;
  run(
    "UPDATE members SET points = ?, last_visit_at = datetime('now') WHERE id = ?",
    balance,
    order.member_id,
  );
  run(
    `INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason)
     VALUES (?, ?, ?, ?, ?)`,
    order.member_id,
    orderId,
    order.points_earned,
    balance,
    "Order collected",
  );
}

/** Hand back points spent on an order that was withdrawn before it was made. */
function refundPoints(orderId: number): void {
  const order = get<{ member_id: number | null; points_spent: number }>(
    "SELECT member_id, points_spent FROM orders WHERE id = ?",
    orderId,
  );
  if (!order?.member_id || order.points_spent <= 0) return;

  const member = get<{ points: number }>("SELECT points FROM members WHERE id = ?", order.member_id)!;
  const balance = member.points + order.points_spent;
  run("UPDATE members SET points = ? WHERE id = ?", balance, order.member_id);
  run(
    `INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason)
     VALUES (?, ?, ?, ?, ?)`,
    order.member_id,
    orderId,
    order.points_spent,
    balance,
    "Order withdrawn, refund",
  );
  run("DELETE FROM redemptions WHERE order_id = ?", orderId);
}
