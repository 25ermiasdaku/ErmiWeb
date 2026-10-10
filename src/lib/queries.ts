import { all, get, scalar } from "./db";
import { getOrderPrefix } from "./settings";
import type {
  Category,
  InventoryItem,
  InventoryTxn,
  LoyaltyTxn,
  Member,
  MenuItem,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Recipe,
  Redemption,
  Reward,
  RestockLine,
  RestockOrder,
} from "./types";

// ---------------------------------------------------------------
// Menu
// ---------------------------------------------------------------

export function getCategories(): Category[] {
  return all<Category>("SELECT * FROM categories ORDER BY sort_order, name");
}

export function getMenu(includeInactive = false): MenuItem[] {
  const items = all<MenuItem>(
    `SELECT m.*, c.name AS category_name, c.slug AS category_slug
       FROM menu_items m
       JOIN categories c ON c.id = m.category_id
      ${includeInactive ? "" : "WHERE m.active = 1"}
      ORDER BY c.sort_order, m.name`,
  );
  const opts = all<MenuItem["options"][number]>(
    `SELECT o.* FROM item_options o
       JOIN menu_items m ON m.id = o.menu_item_id
      WHERE m.active = 1
      ORDER BY o.menu_item_id, o.group_name, o.sort_order, o.id`,
  );
  const byItem = new Map<number, MenuItem["options"]>();
  for (const o of opts) {
    const list = byItem.get(o.menu_item_id) ?? [];
    list.push(o);
    byItem.set(o.menu_item_id, list);
  }
  return items.map((i) => ({ ...i, options: byItem.get(i.id) ?? [] }));
}

// ---------------------------------------------------------------
// Orders
// ---------------------------------------------------------------

function attachItems(orders: Order[]): Order[] {
  if (orders.length === 0) return orders;
  const ids = orders.map((o) => o.id);
  const items = all<OrderItem>(
    `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")})
      ORDER BY order_id, id`,
    ...ids,
  );
  const byOrder = new Map<number, OrderItem[]>();
  for (const it of items) {
    const list = byOrder.get(it.order_id) ?? [];
    list.push(it);
    byOrder.set(it.order_id, list);
  }
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}

export function getOrders(statuses?: OrderStatus[]): Order[] {
  const where = statuses?.length
    ? `WHERE o.status IN (${statuses.map(() => "?").join(",")})`
    : "";
  const rows = all<Order>(
    `SELECT o.*, m.name AS member_name
       FROM orders o
       LEFT JOIN members m ON m.id = o.member_id
       ${where}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 200`,
    ...(statuses ?? []),
  );
  return attachItems(rows);
}

export function getOrder(id: number): (Order & { events: OrderEvent[] }) | undefined {
  const row = get<Order>(
    `SELECT o.*, m.name AS member_name, m.points AS member_points
       FROM orders o LEFT JOIN members m ON m.id = o.member_id
      WHERE o.id = ?`,
    id,
  );
  if (!row) return undefined;
  const order = attachItems([row])[0]!;
  return {
    ...order,
    events: all<OrderEvent>("SELECT * FROM order_events WHERE order_id = ? ORDER BY id", id),
  };
}

/**
 * Open tickets, oldest first — the barista queue.
 *
 * `pending` is in here even though staff cannot advance it: the bar still needs
 * to see a customer order coming so they can have beans grinding before the
 * customer confirms.
 */
export function getOpenOrders(): Order[] {
  const rows = all<Order>(
    `SELECT o.*, m.name AS member_name
       FROM orders o LEFT JOIN members m ON m.id = o.member_id
      WHERE o.status IN ('pending', 'received', 'brewing', 'ready')
      ORDER BY o.created_at ASC, o.id ASC`,
  );
  return attachItems(rows);
}

export function nextOrderNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = getOrderPrefix();
  const last = get<{ n: string }>(
    "SELECT order_number AS n FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1",
    `${prefix}-${today}-%`,
  );
  const seq = last ? Number(last.n.split("-").pop() ?? "0") + 1 : 1;
  return `${prefix}-${today}-${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------

export function getInventory(): InventoryItem[] {
  return all<InventoryItem>(
    `SELECT *,
            ROUND(qty_on_hand * unit_cost_cents) AS value_cents,
            CASE WHEN qty_on_hand <= 0 THEN 1 ELSE 0 END AS is_out,
            CASE WHEN qty_on_hand <= reorder_level THEN 1 ELSE 0 END AS is_low
       FROM inventory_items
      ORDER BY category, name`,
  );
}

export function getInventoryTxns(itemId?: number, limit = 40): InventoryTxn[] {
  if (itemId) {
    return all<InventoryTxn>(
      `SELECT t.*, i.name AS item_name, i.sku, i.unit
         FROM inventory_txns t JOIN inventory_items i ON i.id = t.inventory_item_id
        WHERE t.inventory_item_id = ?
        ORDER BY t.id DESC LIMIT ?`,
      itemId,
      limit,
    );
  }
  return all<InventoryTxn>(
    `SELECT t.*, i.name AS item_name, i.sku, i.unit
       FROM inventory_txns t JOIN inventory_items i ON i.id = t.inventory_item_id
      ORDER BY t.id DESC LIMIT ?`,
    limit,
  );
}

export function getLowStock(): InventoryItem[] {
  return all<InventoryItem>(
    `SELECT *, CASE WHEN qty_on_hand <= 0 THEN 1 ELSE 0 END AS is_out
       FROM inventory_items
      WHERE qty_on_hand <= reorder_level
      ORDER BY (qty_on_hand / NULLIF(reorder_level, 0)) ASC, name`,
  );
}

export function getRestockOrders(): RestockOrder[] {
  const orders = all<RestockOrder>(
    `SELECT *, (SELECT COUNT(*) FROM restock_lines l WHERE l.restock_order_id = restock_orders.id) AS line_count
       FROM restock_orders ORDER BY id DESC LIMIT 40`,
  );
  if (orders.length === 0) return orders;
  const ids = orders.map((o) => o.id);
  const lines = all<RestockLine>(
    `SELECT l.*, i.name AS item_name, i.sku, i.unit
       FROM restock_lines l JOIN inventory_items i ON i.id = l.inventory_item_id
      WHERE l.restock_order_id IN (${ids.map(() => "?").join(",")})
      ORDER BY l.restock_order_id, l.id`,
    ...ids,
  );
  const byOrder = new Map<number, RestockLine[]>();
  for (const l of lines) {
    const list = byOrder.get(l.restock_order_id) ?? [];
    list.push(l);
    byOrder.set(l.restock_order_id, list);
  }
  return orders.map((o) => ({ ...o, lines: byOrder.get(o.id) ?? [] }));
}

// ---------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------

export function getRecipes(): Recipe[] {
  const recipes = all<Recipe>(
    `SELECT r.*, m.name AS item_name, m.description AS item_description, m.icon,
            c.name AS category_name, m.base_price_cents
       FROM recipes r
       JOIN menu_items m ON m.id = r.menu_item_id
       JOIN categories c ON c.id = m.category_id
      ORDER BY c.sort_order, m.name`,
  );
  if (recipes.length === 0) return recipes;
  const ids = recipes.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");

  const steps = all<Recipe["steps"] extends (infer T)[] | undefined ? NonNullable<T> : never>(
    `SELECT * FROM recipe_steps WHERE recipe_id IN (${placeholders}) ORDER BY recipe_id, step_no`,
    ...ids,
  );
  const ingredients = all<NonNullable<Recipe["ingredients"]>[number]>(
    `SELECT ri.id, ri.recipe_id, ri.inventory_item_id, ri.qty,
            i.name AS item_name, i.sku, i.unit, i.qty_on_hand
       FROM recipe_ingredients ri JOIN inventory_items i ON i.id = ri.inventory_item_id
      WHERE ri.recipe_id IN (${placeholders})
      ORDER BY i.category, i.name`,
    ...ids,
  );

  const byRecipe = new Map<number, { steps: Recipe["steps"]; ingredients: Recipe["ingredients"] }>();
  for (const r of recipes) byRecipe.set(r.id, { steps: [], ingredients: [] });
  for (const s of steps) byRecipe.get(s.recipe_id)?.steps?.push(s);
  for (const g of ingredients) byRecipe.get(g.recipe_id)?.ingredients?.push(g);

  return recipes.map((r) => ({ ...r, ...byRecipe.get(r.id)! }));
}

/** Menu items that have no recipe yet. */
export function getItemsMissingRecipes(): Array<{ id: number; name: string; icon: string; category_name: string }> {
  return all(
    `SELECT m.id, m.name, m.icon, c.name AS category_name
       FROM menu_items m JOIN categories c ON c.id = m.category_id
      WHERE m.active = 1
        AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.menu_item_id = m.id)
      ORDER BY c.sort_order, m.name`,
  );
}

// ---------------------------------------------------------------
// Loyalty
// ---------------------------------------------------------------

export function getMembers(): Member[] {
  return all<Member>(
    `SELECT m.*,
            (SELECT COUNT(*) FROM orders o WHERE o.member_id = m.id AND o.status <> 'cancelled') AS orders_count,
            (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o WHERE o.member_id = m.id AND o.status <> 'cancelled') AS spend_cents
       FROM members m
      ORDER BY m.points DESC, m.name`,
  );
}

export function getMember(id: number): Member | undefined {
  return get<Member>(
    `SELECT m.*,
            (SELECT COUNT(*) FROM orders o WHERE o.member_id = m.id AND o.status <> 'cancelled') AS orders_count,
            (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o WHERE o.member_id = m.id AND o.status <> 'cancelled') AS spend_cents
       FROM members m WHERE m.id = ?`,
    id,
  );
}

export function getLoyaltyTxns(memberId?: number, limit = 60): LoyaltyTxn[] {
  if (memberId) {
    return all<LoyaltyTxn>(
      `SELECT t.*, m.name AS member_name FROM loyalty_txns t
         JOIN members m ON m.id = t.member_id
        WHERE t.member_id = ? ORDER BY t.id DESC LIMIT ?`,
      memberId,
      limit,
    );
  }
  return all<LoyaltyTxn>(
    `SELECT t.*, m.name AS member_name FROM loyalty_txns t
       JOIN members m ON m.id = t.member_id
      ORDER BY t.id DESC LIMIT ?`,
    limit,
  );
}

export function getRewards(): Reward[] {
  return all<Reward>("SELECT * FROM rewards WHERE active = 1 ORDER BY points_cost");
}

export function getRedemptions(limit = 60): Redemption[] {
  return all<Redemption>(
    `SELECT r.*, m.name AS member_name, rw.name AS reward_name
       FROM redemptions r
       JOIN members m ON m.id = r.member_id
       JOIN rewards rw ON rw.id = r.reward_id
      ORDER BY r.id DESC LIMIT ?`,
    limit,
  );
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------

export type Dashboard = ReturnType<typeof getDashboard>;

export function getDashboard() {
  const today = new Date().toISOString().slice(0, 10);

  const revenueToday = scalar(
    `SELECT COALESCE(SUM(total_cents), 0) FROM orders
      WHERE status <> 'cancelled' AND date(created_at) = ?`,
    today,
  );
  const ordersToday = scalar(
    "SELECT COUNT(*) FROM orders WHERE status <> 'cancelled' AND date(created_at) = ?",
    today,
  );
  const revenueMonth = scalar(
    `SELECT COALESCE(SUM(total_cents), 0) FROM orders
      WHERE status <> 'cancelled' AND strftime('%Y-%m', created_at) = ?`,
    today.slice(0, 7),
  );
  const openCount = scalar("SELECT COUNT(*) FROM orders WHERE status IN ('pending','received','brewing','ready')");
  const avgTicket = ordersToday > 0 ? Math.round(revenueToday / ordersToday) : 0;
  const members = scalar("SELECT COUNT(*) FROM members");
  const pointsIssued = scalar("SELECT COALESCE(SUM(delta), 0) FROM loyalty_txns WHERE delta > 0");
  const inventoryValue = scalar("SELECT COALESCE(ROUND(SUM(qty_on_hand * unit_cost_cents)), 0) FROM inventory_items");
  const cogs = scalar(
    `SELECT COALESCE(ROUND(SUM(oi.line_total_cents * 0.31)), 0) FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' AND date(o.created_at) = ?`,
    today,
  );

  const lowStock = getLowStock();

  const recentOrders = attachItems(
    all<Order>(
      `SELECT o.*, m.name AS member_name FROM orders o
         LEFT JOIN members m ON m.id = o.member_id
        ORDER BY o.id DESC LIMIT 6`,
    ),
  );

  const topSellers = all<{ name: string; icon: string; qty: number; revenue_cents: number }>(
    `SELECT m.name, m.icon, SUM(oi.qty) AS qty, SUM(oi.line_total_cents) AS revenue_cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN menu_items m ON m.id = oi.menu_item_id
      WHERE o.status <> 'cancelled'
      GROUP BY m.id
      ORDER BY qty DESC
      LIMIT 6`,
  );

  // 7-day revenue sparkline
  const week = all<{ day: string; revenue_cents: number; orders: number }>(
    `SELECT date(created_at) AS day, COALESCE(SUM(total_cents), 0) AS revenue_cents, COUNT(*) AS orders
       FROM orders
      WHERE status <> 'cancelled' AND date(created_at) >= date(?, '-6 days')
      GROUP BY day ORDER BY day`,
    today,
  );
  const byDay = new Map(week.map((d) => [d.day, d]));
  const spark: Array<{ day: string; revenue_cents: number; orders: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    spark.push(byDay.get(key) ?? { day: key, revenue_cents: 0, orders: 0 });
  }

  const topMembers = all<Member>(
    `SELECT m.*, (SELECT COUNT(*) FROM orders o WHERE o.member_id = m.id) AS orders_count
       FROM members m ORDER BY m.points DESC LIMIT 5`,
  );

  return {
    revenueToday,
    revenueMonth,
    ordersToday,
    avgTicket,
    openCount,
    members,
    pointsIssued,
    inventoryValue,
    cogs,
    grossMarginCents: revenueToday - cogs,
    lowStock,
    recentOrders,
    topSellers,
    spark,
    topMembers,
  };
}
