/**
 * The permission catalogue and the seeded system roles.
 *
 * This module imports nothing from the database so it can be used from the
 * seed script, from server components, and from client components (the nav
 * needs to know which links to draw).
 */

export type PermissionDef = {
  key: string;
  label: string;
  category: string;
  description: string;
};

/**
 * Every capability the system knows about. `category` is what groups the
 * checkboxes in the role editor; order here is the order they appear.
 */
export const PERMISSIONS: PermissionDef[] = [
  {
    key: "dashboard.view",
    label: "View dashboard",
    category: "Overview",
    description: "Trading figures, stock alerts and the loyalty book.",
  },
  {
    key: "pos.use",
    label: "Use the point of sale",
    category: "Point of Sale",
    description: "Open the till, build a cart and choose modifiers.",
  },
  {
    key: "orders.create",
    label: "Ring up orders",
    category: "Point of Sale",
    description: "Send a cart from the till to the order board.",
  },
  {
    key: "orders.view",
    label: "View order board",
    category: "Orders",
    description: "See live tickets and today's order history.",
  },
  {
    key: "orders.manage",
    label: "Move orders along",
    category: "Orders",
    description:
      "Advance a ticket to brewing or ready, or cancel it. A customer's own confirmations are never the staff's to make.",
  },
  {
    key: "menu.manage",
    label: "Manage the menu",
    category: "Menu",
    description: "Take items off the till and put them back.",
  },
  {
    key: "inventory.view",
    label: "View inventory",
    category: "Inventory",
    description: "See stock levels, reorder points and purchase orders.",
  },
  {
    key: "inventory.adjust",
    label: "Correct stock",
    category: "Inventory",
    description: "Record deliveries, waste and count corrections.",
  },
  {
    key: "inventory.manage",
    label: "Manage purchasing",
    category: "Inventory",
    description: "Change reorder levels and raise or receive purchase orders.",
  },
  {
    key: "recipes.view",
    label: "Read brew specs",
    category: "Recipes",
    description: "See the method, dose and steps for every drink.",
  },
  {
    key: "recipes.manage",
    label: "Edit brew specs",
    category: "Recipes",
    description: "Change doses, grind, temperature and timings.",
  },
  {
    key: "loyalty.view",
    label: "View loyalty book",
    category: "Loyalty",
    description: "See members, points balances and the ledger.",
  },
  {
    key: "loyalty.manage",
    label: "Manage members",
    category: "Loyalty",
    description: "Add members and adjust point balances by hand.",
  },
  {
    key: "loyalty.redeem",
    label: "Redeem rewards",
    category: "Loyalty",
    description: "Spend a member's points at the till.",
  },
  {
    key: "orders.self",
    label: "Order for yourself",
    category: "Orders",
    description:
      "Order coffee on your own account, then confirm it to the cafe and confirm collection.",
  },
  {
    key: "reports.view",
    label: "View system reports",
    category: "Reports",
    description: "System-wide trading, stock and staff reports.",
  },
  {
    key: "admin.access",
    label: "Open the admin area",
    category: "Administration",
    description: "Reach the admin dashboard at all.",
  },
  { key: "users.view", label: "View users", category: "Administration", description: "See the staff list and each account's role." },
  { key: "users.create", label: "Create users", category: "Administration", description: "Add new staff accounts with a role." },
  { key: "users.edit", label: "Edit users", category: "Administration", description: "Change names, emails, roles and active state." },
  { key: "users.delete", label: "Delete users", category: "Administration", description: "Deactivate accounts, or erase them permanently." },
  { key: "roles.view", label: "View roles", category: "Administration", description: "See roles and the permissions they grant." },
  { key: "roles.manage", label: "Manage roles", category: "Administration", description: "Create roles and change what each one can do." },
  { key: "settings.view", label: "View settings", category: "Administration", description: "Read cafe and system settings." },
  { key: "settings.manage", label: "Change settings", category: "Administration", description: "Edit tax, loyalty rates and cafe details." },
  { key: "logs.view", label: "View activity log", category: "Administration", description: "Read the audit trail of who did what." },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

export const PERMISSION_CATEGORIES: string[] = [...new Set(PERMISSIONS.map((p) => p.category))];

export function permissionDef(key: string): PermissionDef | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}

/** The permissions guarding each route, used by the nav and the page guards. */
export const ROUTE_PERMISSION: Record<string, string> = {
  "/": "dashboard.view",
  "/menu": "pos.use",
  "/orders": "orders.view",
  "/my-orders": "orders.self",
  "/inventory": "inventory.view",
  "/loyalty": "loyalty.view",
  "/recipes": "recipes.view",
  "/admin": "admin.access",
  "/admin/users": "users.view",
  "/admin/roles": "roles.view",
  "/admin/settings": "settings.view",
  "/admin/reports": "reports.view",
  "/admin/logs": "logs.view",
};

export type RoleDef = {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
};

/**
 * The roles created by the seed. `owner` deliberately holds every permission,
 * computed rather than listed, so a new permission cannot be forgotten.
 */
export const SYSTEM_ROLES: RoleDef[] = [
  {
    slug: "owner",
    name: "Owner",
    description: "Unrestricted. The only role that can erase accounts or rewrite the permission model.",
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    slug: "manager",
    name: "Manager",
    description: "Runs the cafe day to day. Manages staff and settings, but cannot erase accounts or redesign roles.",
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== "users.delete" && k !== "roles.manage"),
  },
  {
    slug: "barista",
    name: "Barista",
    description: "Works the bar. Takes orders, moves tickets along and reads the brew specs.",
    permissions: [
      "dashboard.view",
      "pos.use",
      "orders.create",
      "orders.self",
      "orders.view",
      "orders.manage",
      "menu.manage",
      "inventory.view",
      "recipes.view",
    ],
  },
  {
    slug: "cashier",
    name: "Cashier",
    description: "Front counter only. Rings up orders and handles loyalty at the till.",
    permissions: [
      "dashboard.view",
      "pos.use",
      "orders.create",
      "orders.self",
      "orders.view",
      "loyalty.view",
      "loyalty.redeem",
    ],
  },
  {
    slug: "customer",
    name: "Customer",
    description:
      "Orders coffee on their own account and follows it through. No till, no stock, no staff tools.",
    permissions: ["orders.self"],
  },
];

/** Does this set of granted permission keys include `key`? */
export function can(granted: ReadonlySet<string>, key: string): boolean {
  return granted.has(key);
}

/** All permissions granted, or only those the set actually has. */
export function canAll(granted: ReadonlySet<string>, keys: string[]): boolean {
  return keys.every((k) => granted.has(k));
}
