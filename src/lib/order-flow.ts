import type { OrderStatus } from "./types";

/**
 * Which statuses an order may move to next.
 *
 * Kept in its own module (no `node:sqlite` import) so client components can
 * use it without pulling the database layer into the browser bundle.
 */
export const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["received", "cancelled"],
  received: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * The two moves only the customer may make.
 *
 * A customer order is a handshake: they ask for it, confirm the cafe has it,
 * then confirm they actually collected it. Staff can cancel at any point (an
 * item selling out is a real thing that happens) but must not advance the
 * ticket on the customer's behalf, or "confirm you collected it" stops meaning
 * anything.
 *
 * Keyed by the status being left, so the UI can ask the same question the
 * server action enforces.
 */
export const CUSTOMER_ONLY_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ["received"],
  ready: ["completed"],
};

export function isCustomerTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (CUSTOMER_ONLY_TRANSITIONS[from] ?? []).includes(to);
}

/** The single status a customer can advance this order to, if any. */
export function customerNext(status: OrderStatus): OrderStatus | null {
  return CUSTOMER_ONLY_TRANSITIONS[status]?.[0] ?? null;
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const forward = ALLOWED_NEXT[status].find((s) => s !== "cancelled");
  return forward ?? null;
}
