export type OrderStatus =
  | "pending"
  | "received"
  | "brewing"
  | "ready"
  | "completed"
  | "cancelled";

/**
 * The progress a ticket makes through the cafe.
 *
 * `pending` is a customer's order that nobody has accepted yet. Staff orders
 * start at `received`, because ringing something up at the counter is already
 * the cafe accepting it.
 */
export const ORDER_FLOW: OrderStatus[] = [
  "pending",
  "received",
  "brewing",
  "ready",
  "completed",
];

/** True for an order the bar is still working on. */
export function isOpenStatus(status: OrderStatus): boolean {
  return status === "pending" || status === "received" || status === "brewing" || status === "ready";
}

export const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    badge: string;
    dot: string;
    column: string;
    /** What the customer is expected to do next, or null if nobody is waiting. */
    customerPrompt: string | null;
    /** What the cafe is expected to do next, or null. */
    staffPrompt: string | null;
  }
> = {
  pending: {
    label: "Awaiting confirmation",
    badge: "bg-sky-500/15 text-sky-800 dark:text-sky-300 ring-sky-500/30",
    dot: "bg-sky-500",
    column: "border-sky-500/40",
    customerPrompt: "Confirm you still want this and the cafe will start it.",
    staffPrompt: null,
  },
  received: {
    label: "Received",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    dot: "bg-amber-500",
    column: "border-amber-500/40",
    customerPrompt: null,
    staffPrompt: "Start brewing.",
  },
  brewing: {
    label: "Brewing",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30",
    dot: "bg-orange-500",
    column: "border-orange-500/40",
    customerPrompt: null,
    staffPrompt: "Mark ready for collection.",
  },
  ready: {
    label: "Ready to collect",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
    dot: "bg-emerald-500",
    column: "border-emerald-500/40",
    customerPrompt: "Collect it, then confirm to earn your points.",
    staffPrompt: null,
  },
  completed: {
    label: "Completed",
    badge: "bg-stone-500/15 text-stone-600 dark:text-stone-300 ring-stone-500/30",
    dot: "bg-stone-400",
    column: "border-stone-500/30",
    customerPrompt: null,
    staffPrompt: null,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-500/30",
    dot: "bg-rose-500",
    column: "border-rose-500/40",
    customerPrompt: null,
    staffPrompt: null,
  },
};

export type Category = { id: number; slug: string; name: string; sort_order: number };

export type ItemOption = {
  id: number;
  menu_item_id: number;
  group_name: string;
  label: string;
  price_delta_cents: number;
  is_default: number;
  sort_order: number;
};

export type MenuItem = {
  id: number;
  category_id: number;
  name: string;
  description: string;
  base_price_cents: number;
  icon: string;
  is_signature: number;
  active: number;
  options: ItemOption[];
  /** joined from categories */
  category_name?: string;
  category_slug?: string;
};

export type ChosenOption = {
  optionId: number;
  label: string;
  group: string;
  priceDeltaCents: number;
};

export type CartLine = {
  /** Stable key so two different configurations of the same item stay separate. */
  key: string;
  itemId: number;
  name: string;
  icon: string;
  qty: number;
  unitPriceCents: number;
  options: ChosenOption[];
};

export type OrderItem = {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  name_snapshot: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  options_json: string;
};

export type Order = {
  id: number;
  order_number: string;
  status: OrderStatus;
  channel: string;
  customer_name: string;
  member_id: number | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  points_earned: number;
  points_spent: number;
  note: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  member_name?: string | null;
};

export type OrderEvent = { id: number; order_id: number; status: OrderStatus; at: string };

export type InventoryItem = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty_on_hand: number;
  reorder_level: number;
  reorder_qty: number;
  unit_cost_cents: number;
  supplier: string;
  updated_at: string;
  /** computed */
  value_cents?: number;
  is_low?: number;
  is_out?: number;
};

export type InventoryTxn = {
  id: number;
  inventory_item_id: number;
  delta: number;
  reason: string;
  reference: string;
  at: string;
  item_name?: string;
  sku?: string;
  unit?: string;
};

export type RestockOrder = {
  id: number;
  supplier: string;
  status: string;
  note: string;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  lines?: RestockLine[];
};

export type RestockLine = {
  id: number;
  restock_order_id: number;
  inventory_item_id: number;
  qty: number;
  unit_cost_cents: number;
  item_name?: string;
  sku?: string;
  unit?: string;
};

export type RecipeStep = {
  id: number;
  recipe_id: number;
  step_no: number;
  title: string;
  instruction: string;
  seconds: number;
};

export type RecipeIngredient = {
  id: number;
  recipe_id: number;
  inventory_item_id: number;
  qty: number;
  item_name?: string;
  sku?: string;
  unit?: string;
  qty_on_hand?: number;
};

export type Recipe = {
  id: number;
  menu_item_id: number;
  brew_method: string;
  dose_g: number;
  water_g: number;
  ratio: string;
  grind: string;
  water_temp_c: number;
  brew_time_s: number;
  notes: string;
  steps?: RecipeStep[];
  ingredients?: RecipeIngredient[];
  /** joined from menu_items */
  item_name?: string;
  item_description?: string;
  icon?: string;
  category_name?: string;
};

export type Member = {
  id: number;
  name: string;
  email: string;
  phone: string;
  points: number;
  joined_at: string;
  last_visit_at: string | null;
  notes: string;
  orders_count?: number;
  spend_cents?: number;
};

export type LoyaltyTxn = {
  id: number;
  member_id: number;
  order_id: number | null;
  delta: number;
  balance_after: number;
  reason: string;
  at: string;
  member_name?: string;
};

export type Reward = {
  id: number;
  name: string;
  description: string;
  points_cost: number;
  kind: "discount" | "item" | "upgrade";
  value_cents: number;
  active: number;
};

export type Redemption = {
  id: number;
  member_id: number;
  reward_id: number;
  order_id: number | null;
  points_spent: number;
  value_cents: number;
  at: string;
  member_name?: string;
  reward_name?: string;
};

export type Tier = { name: string; min: number; next: number | null; tone: string };

export const TIERS: Tier[] = [
  { name: "Bronze", min: 0, next: 300, tone: "bg-amber-700/15 text-amber-800 dark:text-amber-200 ring-amber-700/30" },
  { name: "Silver", min: 300, next: 900, tone: "bg-slate-500/15 text-slate-700 dark:text-slate-200 ring-slate-500/30" },
  { name: "Gold", min: 900, next: null, tone: "bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 ring-yellow-500/40" },
];

export function tierFor(points: number): Tier {
  let found: Tier = TIERS[0]!;
  for (const t of TIERS) if (points >= t.min) found = t;
  return found;
}
