/**
 * Human-readable names for activity-log actions.
 *
 * Deliberately separate from activity.ts: that module writes to the database,
 * and client components (the log table, the account page) need these labels
 * without dragging `node:sqlite` into the browser bundle.
 */

const LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.logout": "Signed out",
  "auth.password_changed": "Changed own password",
  "auth.profile_update": "Updated own profile",
  "user.create": "Created user",
  "user.update": "Updated user",
  "user.activate": "Reactivated user",
  "user.deactivate": "Deactivated user",
  "user.soft_delete": "Archived user",
  "user.restore": "Restored user",
  "user.erase": "Erased user permanently",
  "user.password_reset": "Reset another user's password",
  "user.sessions_revoked": "Revoked a user's sessions",
  "user.unlock": "Unlocked a user",
  "role.create": "Created role",
  "role.update": "Changed role permissions",
  "role.delete": "Deleted role",
  "settings.update": "Changed system settings",
  "session.purge": "Purged expired sessions",
  "order.place": "Placed order",
  "order.status": "Changed order status",
  "order.self_place": "Ordered a coffee for themselves",
  "order.self_confirm": "Customer confirmed their order",
  "order.self_collect": "Customer confirmed collection",
  "order.self_cancel": "Customer withdrew their order",
  "stock.adjust": "Adjusted stock",
  "stock.restock": "Changed purchasing",
  "member.create": "Added loyalty member",
  "member.points": "Adjusted loyalty points",
  "member.redeem": "Redeemed a reward",
  "recipe.save": "Edited a brew spec",
  "menu.toggle": "Toggled a menu item",
};

export function actionLabel(action: string): string {
  return LABELS[action] ?? action;
}

const TONES: Record<string, string> = {
  "auth.login_failed": "amber",
  "user.erase": "rose",
  "user.soft_delete": "rose",
  "user.deactivate": "amber",
  "user.create": "emerald",
  "user.restore": "emerald",
  "role.create": "emerald",
  "role.delete": "rose",
  "settings.update": "sky",
};

export function actionTone(action: string): string {
  return TONES[action] ?? "";
}
