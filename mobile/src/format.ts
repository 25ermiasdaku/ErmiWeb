/**
 * Small formatting helpers, shared by every screen.
 *
 * `money` mirrors the web's formatter so a price looks the same in both
 * places, and `STATUS_COPY` is the single source of truth for what a customer
 * is told about an order and which move (if any) they can make on it.
 */
import type { OrderStatus } from "./api";
import { colors } from "./theme";

/** All money is integer cents everywhere; this is the only place it becomes text. */
export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

/** "in_progress" -> "In Progress". Used for statuses and category slugs. */
export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/** A short, friendly timestamp for an order row. */
export function dateTime(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type StatusAction = "confirm" | "cancel";

export type StatusCopy = {
  /** What the customer sees as the status name. */
  label: string;
  /** One line explaining where the order is. */
  description: string;
  /** The move the customer can make from here, or null. */
  action: StatusAction | null;
  /** The button label for that move. */
  actionLabel: string | null;
  /** Whether a customer may withdraw the order from this status. */
  canCancel: boolean;
  /** Accent colour for the status chip. */
  tone: string;
};

/**
 * The status vocabulary. `pending` and `ready` are the only two a customer
 * acts on; everything else is the bar's job or already history.
 */
export const STATUS_COPY: Record<OrderStatus, StatusCopy> = {
  pending: {
    label: "Awaiting confirmation",
    description: "Confirm you still want this and the cafe will start it.",
    action: "confirm",
    actionLabel: "Confirm order",
    canCancel: true,
    tone: colors.info,
  },
  received: {
    label: "Received",
    description: "The cafe has your order and will start it shortly.",
    action: null,
    actionLabel: null,
    canCancel: false,
    tone: colors.warning,
  },
  brewing: {
    label: "Brewing",
    description: "Your drink is on the bar now. Almost there.",
    action: null,
    actionLabel: null,
    canCancel: false,
    tone: colors.caramelDark,
  },
  ready: {
    label: "Ready to collect",
    description: "Collect it, then confirm to earn your points.",
    action: "confirm",
    actionLabel: "Confirm collection",
    canCancel: false,
    tone: colors.success,
  },
  completed: {
    label: "Completed",
    description: "Enjoy — your points are banked.",
    action: null,
    actionLabel: null,
    canCancel: false,
    tone: colors.muted,
  },
  cancelled: {
    label: "Cancelled",
    description: "This order was withdrawn. Nothing was made.",
    action: null,
    actionLabel: null,
    canCancel: false,
    tone: colors.danger,
  },
};
