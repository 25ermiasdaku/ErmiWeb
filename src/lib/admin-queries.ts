/**
 * Reads for the admin area and the personal account pages.
 *
 * Kept apart from queries.ts because these are all about who did what,
 * rather than about the cafe trading.
 */
import { all, get } from "./db";
import { isLocked } from "./lockout";

export type AdminUserRow = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  job_title: string;
  is_active: number;
  deleted_at: string | null;
  must_change_password: number;
  failed_logins: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  role_id: number;
  role_name: string;
  role_slug: string;
  session_count: number;
  orders_placed: number;
};

export function getUsers(includeArchived = true): AdminUserRow[] {
  return all<AdminUserRow>(
    `SELECT u.id, u.username, u.email, u.full_name, u.job_title, u.is_active, u.deleted_at,
            u.must_change_password, u.failed_logins, u.locked_until, u.last_login_at, u.created_at,
            r.id AS role_id, r.name AS role_name, r.slug AS role_slug,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.user_id = u.id AND s.expires_at > datetime('now')) AS session_count,
            (SELECT COUNT(*) FROM orders o WHERE o.placed_by = u.id) AS orders_placed
       FROM users u
       JOIN roles r ON r.id = u.role_id
      ${includeArchived ? "" : "WHERE u.deleted_at IS NULL"}
      ORDER BY u.deleted_at IS NOT NULL, r.is_system DESC, u.full_name`,
  );
}

export type RoleRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_system: number;
  user_count: number;
  permission_count: number;
};

export function getRoles(): RoleRow[] {
  return all<RoleRow>(
    `SELECT r.id, r.slug, r.name, r.description, r.is_system,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS user_count,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
       FROM roles r
      ORDER BY r.is_system DESC, r.name`,
  );
}

/** role id -> permission keys */
export function getRolePermissionMap(): Map<number, string[]> {
  const rows = all<{ role_id: number; key: string }>(
    `SELECT rp.role_id, p.key
       FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
      ORDER BY p.sort_order`,
  );
  const map = new Map<number, string[]>();
  for (const row of rows) {
    const list = map.get(row.role_id) ?? [];
    list.push(row.key);
    map.set(row.role_id, list);
  }
  return map;
}

// ---------------------------------------------------------------
// Activity
// ---------------------------------------------------------------

export type ActivityRow = {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
  ip: string;
  at: string;
};

export type ActivityFilter = {
  limit?: number;
  action?: string;
  userId?: number;
  search?: string;
};

export function getActivity(filter: ActivityFilter = {}): ActivityRow[] {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filter.action && filter.action !== "all") {
    where.push("action = ?");
    params.push(filter.action);
  }
  if (filter.userId) {
    where.push("user_id = ?");
    params.push(filter.userId);
  }
  if (filter.search) {
    where.push("(username LIKE ? OR detail LIKE ? OR action LIKE ?)");
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }

  params.push(filter.limit ?? 120);
  return all<ActivityRow>(
    `SELECT * FROM activity_log
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY at DESC, id DESC
      LIMIT ?`,
    ...params,
  );
}

/** Distinct actions present in the log, for the filter dropdown. */
export function getActivityActions(): string[] {
  return all<{ action: string }>("SELECT DISTINCT action FROM activity_log ORDER BY action")
    .map((r) => r.action);
}

export function getActivityCounts(): { total: number; last24h: number; failures: number } {
  return {
    total: get<{ n: number }>("SELECT COUNT(*) AS n FROM activity_log")?.n ?? 0,
    last24h:
      get<{ n: number }>("SELECT COUNT(*) AS n FROM activity_log WHERE at >= datetime('now', '-1 day')")?.n ?? 0,
    failures:
      get<{ n: number }>("SELECT COUNT(*) AS n FROM activity_log WHERE action = 'auth.login_failed' AND at >= datetime('now', '-1 day')")?.n ?? 0,
  };
}

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------

export type SessionRow = {
  id: string;
  user_id: number;
  username: string;
  full_name: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip: string;
  user_agent: string;
};

export function getActiveSessions(): SessionRow[] {
  return all<SessionRow>(
    `SELECT s.id, s.user_id, s.created_at, s.last_seen_at, s.expires_at, s.ip, s.user_agent,
            u.username, u.full_name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > datetime('now') AND u.deleted_at IS NULL
      ORDER BY s.last_seen_at DESC`,
  );
}

// ---------------------------------------------------------------
// System stats for the admin dashboard
// ---------------------------------------------------------------

export type SystemStats = {
  users: number;
  activeUsers: number;
  archivedUsers: number;
  lockedUsers: number;
  roles: number;
  sessions: number;
  menuItems: number;
  activeMenuItems: number;
  orders: number;
  revenueCents: number;
  members: number;
  stockValueCents: number;
  lowStock: number;
  openOrders: number;
};

export function getSystemStats(): SystemStats {
  const one = <T>(sql: string): T => get<T>(sql) ?? ({} as T);
  return {
    users: one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL").n,
    activeUsers: one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND is_active = 1").n,
    archivedUsers: one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NOT NULL").n,
    lockedUsers: one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE locked_until > datetime('now')").n,
    roles: one<{ n: number }>("SELECT COUNT(*) AS n FROM roles").n,
    sessions: one<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > datetime('now')").n,
    menuItems: one<{ n: number }>("SELECT COUNT(*) AS n FROM menu_items").n,
    activeMenuItems: one<{ n: number }>("SELECT COUNT(*) AS n FROM menu_items WHERE active = 1").n,
    orders: one<{ n: number }>("SELECT COUNT(*) AS n FROM orders").n,
    revenueCents: one<{ n: number }>("SELECT COALESCE(SUM(total_cents), 0) AS n FROM orders WHERE status <> 'cancelled'").n,
    members: one<{ n: number }>("SELECT COUNT(*) AS n FROM members").n,
    stockValueCents: one<{ n: number }>("SELECT ROUND(COALESCE(SUM(qty_on_hand * unit_cost_cents), 0)) AS n FROM inventory_items").n,
    lowStock: one<{ n: number }>("SELECT COUNT(*) AS n FROM inventory_items WHERE qty_on_hand <= reorder_level").n,
    openOrders: one<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending', 'received', 'brewing', 'ready')").n,
  };
}

// ---------------------------------------------------------------
// Reports
// ---------------------------------------------------------------

export function getTradingByDay(days: number): Array<{ day: string; orders: number; revenue_cents: number; tax_cents: number }> {
  return all(
    `SELECT date(created_at) AS day,
            COUNT(*) AS orders,
            COALESCE(SUM(total_cents), 0) AS revenue_cents,
            COALESCE(SUM(tax_cents), 0) AS tax_cents
       FROM orders
      WHERE status <> 'cancelled' AND created_at >= date('now', ?)
      GROUP BY day ORDER BY day`,
    `-${days} days`,
  );
}

export type StaffSalesRow = {
  user_id: number | null;
  username: string;
  full_name: string;
  role_name: string;
  orders: number;
  revenue_cents: number;
  last_order_at: string | null;
};

export function getSalesByStaff(days: number): StaffSalesRow[] {
  return all<StaffSalesRow>(
    `SELECT o.placed_by AS user_id,
            COALESCE(u.username, '—') AS username,
            COALESCE(u.full_name, 'Erased account') AS full_name,
            COALESCE(r.name, '—') AS role_name,
            COUNT(*) AS orders,
            COALESCE(SUM(o.total_cents), 0) AS revenue_cents,
            MAX(o.created_at) AS last_order_at
       FROM orders o
       LEFT JOIN users u ON u.id = o.placed_by
       LEFT JOIN roles r ON r.id = u.role_id
      WHERE o.status <> 'cancelled' AND o.created_at >= date('now', ?)
      GROUP BY o.placed_by
      ORDER BY revenue_cents DESC`,
    `-${days} days`,
  );
}

export function getTradingByChannel(days: number): Array<{ channel: string; orders: number; revenue_cents: number }> {
  return all(
    `SELECT channel, COUNT(*) AS orders, COALESCE(SUM(total_cents), 0) AS revenue_cents
       FROM orders
      WHERE status <> 'cancelled' AND created_at >= date('now', ?)
      GROUP BY channel ORDER BY revenue_cents DESC`,
    `-${days} days`,
  );
}

/** Best sellers inside the reporting window, unlike the dashboard's all-time list. */
export function getTopItemsByDays(days: number, limit = 8): Array<{
  id: number;
  name: string;
  icon: string;
  category: string;
  qty: number;
  revenue_cents: number;
}> {
  return all(
    `SELECT m.id, m.name, m.icon, c.name AS category,
            SUM(oi.qty) AS qty,
            SUM(oi.line_total_cents) AS revenue_cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN menu_items m ON m.id = oi.menu_item_id
       LEFT JOIN categories c ON c.id = m.category_id
      WHERE o.status <> 'cancelled' AND o.created_at >= date('now', ?)
      GROUP BY m.id
      ORDER BY qty DESC
      LIMIT ?`,
    `-${days} days`,
    limit,
  );
}

export function getTradingByHour(days: number): Array<{ hour: number; orders: number; revenue_cents: number }> {
  return all(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour,
            COUNT(*) AS orders,
            COALESCE(SUM(total_cents), 0) AS revenue_cents
       FROM orders
      WHERE status <> 'cancelled' AND created_at >= date('now', ?)
      GROUP BY hour ORDER BY hour`,
    `-${days} days`,
  );
}

// ---------------------------------------------------------------
// The signed-in user's own records (the /me area)
// ---------------------------------------------------------------

export type MyOrderRow = {
  id: number;
  order_number: string;
  status: string;
  total_cents: number;
  items: number;
  created_at: string;
};

export function getMyOrders(userId: number, limit = 40): MyOrderRow[] {
  return all<MyOrderRow>(
    `SELECT o.id, o.order_number, o.status, o.total_cents, o.created_at,
            COALESCE((SELECT SUM(qty) FROM order_items oi WHERE oi.order_id = o.id), 0) AS items
       FROM orders o
      WHERE o.placed_by = ?
      ORDER BY o.created_at DESC
      LIMIT ?`,
    userId,
    limit,
  );
}

export type MySummary = {
  orders: number;
  revenueCents: number;
  thisWeek: number;
  stockAdjusted: number;
  firstSeen: string | null;
};

export function getMySummary(userId: number): MySummary {
  return {
    orders: get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE placed_by = ?", userId)?.n ?? 0,
    revenueCents:
      get<{ n: number }>("SELECT COALESCE(SUM(total_cents), 0) AS n FROM orders WHERE placed_by = ? AND status <> 'cancelled'", userId)?.n ?? 0,
    thisWeek:
      get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE placed_by = ? AND created_at >= date('now', '-7 days')", userId)?.n ?? 0,
    stockAdjusted: get<{ n: number }>("SELECT COUNT(*) AS n FROM activity_log WHERE user_id = ? AND action = 'stock.adjust'", userId)?.n ?? 0,
    firstSeen: get<{ at: string }>("SELECT MIN(at) AS at FROM activity_log WHERE user_id = ?", userId)?.at ?? null,
  };
}

// ---------------------------------------------------------------
// Helpers reused by the UI
// -------------------------------------------------------------------------

/** Accounts currently locked out after too many failed sign-ins. */
export function countLocked(users: AdminUserRow[]): number {
  return users.filter((u) => isLocked(u)).length;
}
