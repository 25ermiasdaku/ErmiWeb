"use server";

import { revalidatePath } from "next/cache";
import { all, get, run, tx } from "./db";
import { requirePermission } from "./auth";
import { logActivity } from "./activity";
import { getPointsPerDollar, getTaxRate } from "./settings";
import { priceLines, resolveDeductions, type LineRequest } from "./fulfilment";
import { ALLOWED_NEXT, isCustomerTransition } from "./order-flow";
import { nextOrderNumber } from "./queries";
import type { OrderStatus } from "./types";

import type { ActionState } from "./action-state";

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

// ---------------------------------------------------------------
// POS — place an order
// ---------------------------------------------------------------

export type OrderPayload = {
  customerName: string;
  memberId: number | null;
  channel: string;
  note: string;
  rewardId: number | null;
  lines: LineRequest[];
};

export async function placeOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Two separate capabilities: working the till, and being allowed to commit
  // a sale. Checked here as well as in the page, because a server action can
  // be invoked directly.
  const staff = await requirePermission("pos.use");
  await requirePermission("orders.create");

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, message: "Malformed request." };

  let payload: OrderPayload;
  try {
    payload = JSON.parse(raw) as OrderPayload;
  } catch {
    return { ok: false, message: "Could not read the cart." };
  }

  try {
    // Prices are recomputed server-side; the client never supplies them.
    const lines = priceLines(payload.lines);

    // Read live, so an owner changing the tax rate takes effect immediately.
    const taxRate = getTaxRate();
    const pointsPerDollar = getPointsPerDollar();

    const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
    const tax = Math.round(subtotal * taxRate);
    let total = subtotal + tax;

    // --- loyalty
    const member = payload.memberId ? get<{ id: number; points: number; name: string }>(
      "SELECT id, points, name FROM members WHERE id = ?",
      payload.memberId,
    ) : undefined;

    let pointsSpent = 0;
    let rewardValue = 0;
    let rewardName = "";
    if (payload.rewardId && member) {
      const reward = get<{ id: number; name: string; points_cost: number; value_cents: number; kind: string; active: number }>(
        "SELECT * FROM rewards WHERE id = ?",
        payload.rewardId,
      );
      if (!reward || reward.active !== 1) throw new Error("That reward is no longer available.");
      if (member.points < reward.points_cost) {
        throw new Error(`${member.name} needs ${reward.points_cost - member.points} more points for ${reward.name}.`);
      }
      pointsSpent = reward.points_cost;
      rewardValue = reward.kind === "discount" ? Math.min(reward.value_cents, total) : 0;
      rewardName = reward.name;
      total -= rewardValue;
    }

    const pointsEarned = Math.floor((total / 100) * pointsPerDollar);
    const orderNumber = nextOrderNumber();
    const customerName = member?.name ?? (payload.customerName.trim() || "Walk-in");

    const result = tx(() => {
      const order = run(
        `INSERT INTO orders
           (order_number, status, channel, customer_name, member_id, placed_by, subtotal_cents, tax_cents,
            total_cents, points_earned, points_spent, note)
         VALUES (?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderNumber,
        payload.channel || "counter",
        customerName,
        member?.id ?? null,
        staff.id,
        subtotal,
        tax,
        total,
        pointsEarned,
        pointsSpent,
        payload.note.trim().slice(0, 300),
      );
      const orderId = order.lastInsertRowid;

      for (const l of lines) {
        run(
          `INSERT INTO order_items
             (order_id, menu_item_id, name_snapshot, qty, unit_price_cents, line_total_cents, options_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          orderId,
          l.itemId,
          l.name,
          l.qty,
          l.unitPriceCents,
          l.unitPriceCents * l.qty,
          JSON.stringify(l.options.map((o) => ({ label: o.label, priceDeltaCents: o.priceDeltaCents }))),
        );
      }

      run("INSERT INTO order_events (order_id, status) VALUES (?, 'received')", orderId);

      // --- stock: deduct what the recipes consume
      const deductions = resolveDeductions(
        lines.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          optionLabels: l.options.map((o) => o.label),
        })),
      );
      for (const d of deductions) {
        const inv = get<{ id: number }>("SELECT id FROM inventory_items WHERE sku = ?", d.sku);
        if (!inv) continue;
        run("UPDATE inventory_items SET qty_on_hand = ROUND(qty_on_hand - ?, 3), updated_at = datetime('now') WHERE id = ?", d.qty, inv.id);
        run(
          "INSERT INTO inventory_txns (inventory_item_id, delta, reason, reference) VALUES (?, ?, ?, ?)",
          inv.id,
          -d.qty,
          "Order sale",
          orderNumber,
        );
      }

      // --- loyalty ledger
      if (member) {
        if (pointsSpent > 0) {
          const balance = member.points - pointsSpent;
          run("UPDATE members SET points = ?, last_visit_at = datetime('now') WHERE id = ?", balance, member.id);
          run(
            "INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason) VALUES (?, ?, ?, ?, ?)",
            member.id, orderId, -pointsSpent, balance, rewardName ? `Redeemed: ${rewardName}` : "Reward redeemed",
          );
          if (payload.rewardId) {
            run(
              "INSERT INTO redemptions (member_id, reward_id, order_id, points_spent, value_cents) VALUES (?, ?, ?, ?, ?)",
              member.id, payload.rewardId, orderId, pointsSpent, rewardValue,
            );
          }
        }
        if (pointsEarned > 0) {
          const balance =
            (member.points - pointsSpent) + pointsEarned;
          run("UPDATE members SET points = ?, last_visit_at = datetime('now') WHERE id = ?", balance, member.id);
          run(
            "INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason) VALUES (?, ?, ?, ?, ?)",
            member.id, orderId, pointsEarned, balance, "Order earned",
          );
        }
        if (pointsSpent === 0 && pointsEarned === 0) {
          run("UPDATE members SET last_visit_at = datetime('now') WHERE id = ?", member.id);
        }
      }

      return orderId;
    });

    refresh("/", "/menu", "/orders", "/inventory", "/loyalty", "/me");
    logActivity({
      action: "order.place",
      entity: "order",
      entityId: result,
      userId: staff.id,
      username: staff.username,
      detail: `${orderNumber} · ${lines.length} line(s) · $${(total / 100).toFixed(2)}`,
    });
    return {
      ok: true,
      message: `${orderNumber} placed.`,
      orderId: result,
      orderNumber,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not place the order." };
  }
}

// ---------------------------------------------------------------
// Order board
// ---------------------------------------------------------------

export async function setOrderStatus(orderId: number, status: OrderStatus): Promise<void> {
  const staff = await requirePermission("orders.manage");
  const order = get<{ status: OrderStatus; order_number: string; channel: string; confirmed_at: string | null }>(
    "SELECT status, order_number, channel, confirmed_at FROM orders WHERE id = ?",
    orderId,
  );
  if (!order) return;
  if (!ALLOWED_NEXT[order.status].includes(status)) return;

  // A customer's two confirmations are theirs to make. Staff can still cancel
  // (an item selling out is real), but accepting an order or declaring it
  // collected on their behalf would make the confirmation mean nothing.
  if (isCustomerTransition(order.status, status)) return;

  tx(() => {
    run("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", status, orderId);
    run("INSERT INTO order_events (order_id, status) VALUES (?, ?)", orderId, status);

    // Cancelling puts the stock back on the shelf — but only if it ever left.
    // A customer order sitting in `pending` was never charged to the shelf, so
    // returning it would invent stock out of nothing.
    if (status === "cancelled" && stockWasDeducted(order.channel, order.confirmed_at)) {
      const items = getAllLines(orderId);
      for (const l of items) {
        for (const d of resolveDeductions([{ itemId: l.menu_item_id, qty: l.qty, optionLabels: l.labels }])) {
          const inv = get<{ id: number }>("SELECT id FROM inventory_items WHERE sku = ?", d.sku);
          if (!inv) continue;
          run("UPDATE inventory_items SET qty_on_hand = ROUND(qty_on_hand + ?, 3), updated_at = datetime('now') WHERE id = ?", d.qty, inv.id);
          run("INSERT INTO inventory_txns (inventory_item_id, delta, reason, reference) VALUES (?, ?, ?, ?)", inv.id, d.qty, "Order cancelled", orderIdToNumber(orderId));
        }
      }
    }
  });

  refresh("/orders", "/inventory", "/", "/my-orders");
  logActivity({
    action: "order.status",
    entity: "order",
    entityId: orderId,
    userId: staff.id,
    username: staff.username,
    detail: `${order.order_number}: ${order.status} → ${status}`,
  });
}

type LineWithLabels = { menu_item_id: number; qty: number; labels: string[] };

/**
 * Has this order taken stock off the shelf yet?
 *
 * Staff orders are charged at the till, when the sale happens. A customer order
 * is only charged once they confirm it, so `confirmed_at` is the record. Without
 * this check, cancelling a `pending` order would credit back beans that were
 * never taken.
 */
function stockWasDeducted(channel: string, confirmedAt: string | null): boolean {
  return channel === "self" ? confirmedAt !== null : true;
}

function getAllLines(orderId: number): LineWithLabels[] {
  return all<{ menu_item_id: number | null; qty: number; options_json: string }>(
    "SELECT menu_item_id, qty, options_json FROM order_items WHERE order_id = ?",
    orderId,
  )
    .filter((r) => r.menu_item_id !== null)
    .map((r) => ({
      menu_item_id: r.menu_item_id!,
      qty: r.qty,
      labels: (JSON.parse(r.options_json || "[]") as Array<{ label: string }>).map((o) => o.label),
    }));
}

function orderIdToNumber(orderId: number): string {
  return get<{ order_number: string }>("SELECT order_number FROM orders WHERE id = ?", orderId)?.order_number ?? String(orderId);
}

// ---------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------

export async function adjustStock(itemId: number, delta: number, reason: string): Promise<void> {
  const staff = await requirePermission("inventory.adjust");
  const item = get<{ qty_on_hand: number; sku: string; name: string }>(
    "SELECT qty_on_hand, sku, name FROM inventory_items WHERE id = ?",
    itemId,
  );
  if (!item || !Number.isFinite(delta) || delta === 0) return;

  // Never let a correction push stock below zero.
  const next = Math.max(0, Math.round((item.qty_on_hand + delta) * 1000) / 1000);
  const applied = Math.round((next - item.qty_on_hand) * 1000) / 1000;

  tx(() => {
    run("UPDATE inventory_items SET qty_on_hand = ?, updated_at = datetime('now') WHERE id = ?", next, itemId);
    run("INSERT INTO inventory_txns (inventory_item_id, delta, reason) VALUES (?, ?, ?)", itemId, applied, reason.trim() || "Manual adjustment");
  });
  refresh("/inventory", "/recipes", "/");
  logActivity({
    action: "stock.adjust",
    entity: "inventory_item",
    entityId: itemId,
    userId: staff.id,
    username: staff.username,
    detail: `${item.sku} ${item.name}: ${applied > 0 ? "+" : ""}${applied} — ${reason.trim() || "Manual adjustment"}`,
  });
}

export async function updateStockTarget(itemId: number, reorderLevel: number, reorderQty: number): Promise<void> {
  await requirePermission("inventory.manage");
  run(
    "UPDATE inventory_items SET reorder_level = ?, reorder_qty = ?, updated_at = datetime('now') WHERE id = ?",
    Math.max(0, reorderLevel),
    Math.max(0, reorderQty),
    itemId,
  );
  refresh("/inventory", "/");
}

export async function createRestockForLow(): Promise<void> {
  await requirePermission("inventory.manage");
  const low = all<LowRow>(
    `SELECT id, name, supplier, reorder_qty, unit_cost_cents, reorder_level, qty_on_hand
       FROM inventory_items WHERE qty_on_hand <= reorder_level`,
  );
  if (low.length === 0) return;

  // One purchase order per supplier keeps the paperwork sane.
  const bySupplier = new Map<string, LowRow[]>();
  for (const row of low) {
    const list = bySupplier.get(row.supplier) ?? [];
    list.push(row);
    bySupplier.set(row.supplier, list);
  }

  tx(() => {
    for (const [supplier, items] of bySupplier) {
      const ro = run(
        "INSERT INTO restock_orders (supplier, status, note) VALUES (?, 'draft', ?)",
        supplier,
        "Generated from low stock",
      );
      for (const it of items) {
        run(
          "INSERT INTO restock_lines (restock_order_id, inventory_item_id, qty, unit_cost_cents) VALUES (?, ?, ?, ?)",
          ro.lastInsertRowid,
          it.id,
          it.reorder_qty || 1,
          it.unit_cost_cents,
        );
      }
    }
  });
  refresh("/inventory", "/");
}

type LowRow = {
  id: number;
  name: string;
  supplier: string;
  reorder_qty: number;
  unit_cost_cents: number;
  reorder_level: number;
  qty_on_hand: number;
};

export async function setRestockStatus(
  restockId: number,
  status: "draft" | "ordered" | "received" | "cancelled",
): Promise<void> {
  await requirePermission("inventory.manage");
  if (status === "received") {
    tx(() => {
      const ro = get<{ status: string }>("SELECT status FROM restock_orders WHERE id = ?", restockId);
      if (!ro || ro.status === "received" || ro.status === "cancelled") return;

      const lines = all<{ inventory_item_id: number; qty: number }>(
        "SELECT inventory_item_id, qty FROM restock_lines WHERE restock_order_id = ?",
        restockId,
      );
      for (const l of lines) {
        run("UPDATE inventory_items SET qty_on_hand = ROUND(qty_on_hand + ?, 3), updated_at = datetime('now') WHERE id = ?", l.qty, l.inventory_item_id);
        run("INSERT INTO inventory_txns (inventory_item_id, delta, reason, reference) VALUES (?, ?, ?, ?)", l.inventory_item_id, l.qty, "Restock received", `PO-${restockId}`);
      }
      run("UPDATE restock_orders SET status = 'received', received_at = datetime('now') WHERE id = ?", restockId);
    });
  } else {
    run("UPDATE restock_orders SET status = ? WHERE id = ?", status, restockId);
    if (status === "ordered") run("UPDATE restock_orders SET ordered_at = datetime('now') WHERE id = ?", restockId);
  }
  refresh("/inventory", "/");
}

// ---------------------------------------------------------------
// Loyalty
// ---------------------------------------------------------------

export async function createMember(formData: FormData): Promise<void> {
  const staff = await requirePermission("loyalty.manage");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) return;

  const existing = get<{ id: number }>("SELECT id FROM members WHERE email = ?", email);
  if (existing) return;

  run("INSERT INTO members (name, email, phone, notes) VALUES (?, ?, ?, ?)", name, email, String(formData.get("phone") ?? "").trim(), String(formData.get("notes") ?? "").trim());
  logActivity({ action: "member.create", entity: "member", detail: `${name} <${email}>`, userId: staff.id, username: staff.username });
  refresh("/loyalty", "/menu");
}

export async function adjustMemberPoints(memberId: number, delta: number, reason: string): Promise<void> {
  const staff = await requirePermission("loyalty.manage");
  const member = get<{ id: number; points: number; name: string }>("SELECT id, points, name FROM members WHERE id = ?", memberId);
  if (!member || !Number.isFinite(delta) || delta === 0) return;

  const balance = Math.max(0, member.points + Math.floor(delta));
  const applied = balance - member.points;
  if (applied === 0) return;

  tx(() => {
    run("UPDATE members SET points = ? WHERE id = ?", balance, memberId);
    run(
      "INSERT INTO loyalty_txns (member_id, delta, balance_after, reason) VALUES (?, ?, ?, ?)",
      memberId,
      applied,
      balance,
      reason.trim() || "Manual adjustment",
    );
  });
  refresh("/loyalty");
  logActivity({
    action: "member.points",
    entity: "member",
    entityId: memberId,
    userId: staff.id,
    username: staff.username,
    detail: `${member.name}: ${applied > 0 ? "+" : ""}${applied} pts (${balance} total) — ${reason.trim() || "Manual adjustment"}`,
  });
}

export async function redeemReward(memberId: number, rewardId: number, orderId: number | null): Promise<void> {
  const staff = await requirePermission("loyalty.redeem");
  const member = get<{ id: number; points: number; name: string }>("SELECT id, points, name FROM members WHERE id = ?", memberId);
  const reward = get<{ id: number; name: string; points_cost: number; value_cents: number; kind: string; active: number }>(
    "SELECT * FROM rewards WHERE id = ?",
    rewardId,
  );
  if (!member || !reward || reward.active !== 1) return;
  if (member.points < reward.points_cost) return;

  const balance = member.points - reward.points_cost;
  tx(() => {
    run("UPDATE members SET points = ? WHERE id = ?", balance, memberId);
    run(
      "INSERT INTO loyalty_txns (member_id, order_id, delta, balance_after, reason) VALUES (?, ?, ?, ?, ?)",
      memberId, orderId, -reward.points_cost, balance, `Redeemed: ${reward.name}`,
    );
    run(
      "INSERT INTO redemptions (member_id, reward_id, order_id, points_spent, value_cents) VALUES (?, ?, ?, ?, ?)",
      memberId, rewardId, orderId, reward.points_cost, reward.kind === "discount" ? reward.value_cents : 0,
    );
    if (orderId) run("UPDATE orders SET points_spent = points_spent + ? WHERE id = ?", reward.points_cost, orderId);
  });
  refresh("/loyalty", "/orders", "/menu");
  logActivity({
    action: "member.redeem",
    entity: "member",
    entityId: memberId,
    userId: staff.id,
    username: staff.username,
    detail: `${member.name} redeemed ${reward.name} for ${reward.points_cost} pts`,
  });
}

// ---------------------------------------------------------------
// Menu / recipes
// ---------------------------------------------------------------

export async function toggleMenuItem(itemId: number, active: boolean): Promise<void> {
  const staff = await requirePermission("menu.manage");
  const item = get<{ name: string }>("SELECT name FROM menu_items WHERE id = ?", itemId);
  run("UPDATE menu_items SET active = ? WHERE id = ?", active ? 1 : 0, itemId);
  refresh("/menu", "/recipes", "/inventory");
  logActivity({
    action: "menu.toggle",
    entity: "menu_item",
    entityId: itemId,
    userId: staff.id,
    username: staff.username,
    detail: `${item?.name ?? itemId} ${active ? "returned to" : "taken off"} the till`,
  });
}

export async function saveRecipe(
  recipeId: number,
  formData: FormData,
): Promise<void> {
  const staff = await requirePermission("recipes.manage");
  const num = (k: string) => Number(formData.get(k) ?? 0);
  run(
    `UPDATE recipes SET brew_method = ?, dose_g = ?, water_g = ?, grind = ?, water_temp_c = ?, brew_time_s = ?, notes = ?
      WHERE id = ?`,
    String(formData.get("brewMethod") ?? "").trim() || "Espresso machine",
    num("dose"),
    num("water"),
    String(formData.get("grind") ?? "").trim(),
    num("temp"),
    num("time"),
    String(formData.get("notes") ?? "").trim(),
    recipeId,
  );
  refresh("/recipes");
  logActivity({ action: "recipe.save", entity: "recipe", entityId: recipeId, userId: staff.id, username: staff.username });
}
