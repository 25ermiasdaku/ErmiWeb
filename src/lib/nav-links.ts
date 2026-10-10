/**
 * Which navigation entries exist, and what each one needs.
 *
 * The layout filters this list against the signed-in user's permissions. The
 * pages re-check the same permission themselves, so hiding a link here is a
 * convenience, not the security boundary.
 */
import type { NavLink } from "@/components/nav";

export type NavEntry = NavLink & { permission: string | null };

export const NAV_ENTRIES: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◈", group: "main", permission: "dashboard.view" },
  { href: "/pos", label: "Point of Sale", icon: "☕", group: "main", permission: "pos.use" },
  { href: "/orders", label: "Order Board", icon: "▤", group: "main", permission: "orders.view" },
  // Order for yourself and follow it through. Granted to every role, so a
  // customer and a member of staff order the same way.
  { href: "/my-orders", label: "My Coffee", icon: "✦", group: "main", permission: "orders.self" },
  { href: "/inventory", label: "Inventory", icon: "▦", group: "main", permission: "inventory.view" },
  { href: "/loyalty", label: "Loyalty", icon: "★", group: "main", permission: "loyalty.view" },
  { href: "/recipes", label: "Recipes", icon: "⚗", group: "main", permission: "recipes.view" },
  // Every signed-in account gets this one, whatever their role.
  { href: "/me", label: "My Account", icon: "◍", group: "main", permission: null },

  { href: "/admin", label: "Admin Home", icon: "⚙", group: "admin", permission: "admin.access" },
  { href: "/admin/users", label: "Users", icon: "⚇", group: "admin", permission: "users.view" },
  { href: "/admin/roles", label: "Roles & Permissions", icon: "⚿", group: "admin", permission: "roles.view" },
  { href: "/admin/reports", label: "Reports", icon: "◫", group: "admin", permission: "reports.view" },
  { href: "/admin/settings", label: "Settings", icon: "⚒", group: "admin", permission: "settings.view" },
  { href: "/admin/logs", label: "Activity Log", icon: "≡", group: "admin", permission: "logs.view" },
];

/** The subset of navigation this user is allowed to see. */
export function linksFor(permissions: ReadonlySet<string>): NavLink[] {
  return NAV_ENTRIES.filter(
    (entry) => entry.permission === null || permissions.has(entry.permission),
  ).map(({ href, label, icon, group }) => ({ href, label, icon, group }));
}
