"use server";

/**
 * Writes for a customer ordering coffee for themselves — the web entry point.
 *
 * The work lives in `my-order-service.ts` so the mobile API can share it. Each
 * function here does two things only a "use server" action should: prove the
 * caller holds `orders.self` (the real security boundary), and revalidate the
 * customer's order page after the write. See the service for the flow and the
 * two-sided confirmation handshake.
 */
import { revalidatePath } from "next/cache";
import { requirePermission } from "./auth";
import { cancelOrder, confirmOrder, placeOrder, type ConfirmResult } from "./my-order-service";
import type { LineRequest } from "./fulfilment";
import type { ActionState } from "./action-state";

/** Place an order on your own account. Starts life as `pending`. */
export async function placeMyOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("orders.self");

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, message: "Malformed request." };

  let lines: LineRequest[];
  let note: string;
  let rewardId: number | null;
  try {
    const parsed = JSON.parse(raw) as {
      lines?: LineRequest[];
      note?: string;
      rewardId?: number | null;
    };
    lines = parsed.lines ?? [];
    note = String(parsed.note ?? "");
    rewardId = typeof parsed.rewardId === "number" ? parsed.rewardId : null;
  } catch {
    return { ok: false, message: "Could not read your order." };
  }

  const result = await placeOrder(user, { lines, note, rewardId });
  if (result.ok) revalidatePath("/my-orders");
  return result;
}

/** Confirm an order, at whichever end is waiting on you. */
export async function confirmMyOrder(orderId: number): Promise<ConfirmResult> {
  const user = await requirePermission("orders.self");
  const result = confirmOrder(user, orderId);
  if (result.ok) revalidatePath("/my-orders");
  return result;
}

/** Withdraw an order the cafe has not started yet. */
export async function cancelMyOrder(orderId: number): Promise<ConfirmResult> {
  const user = await requirePermission("orders.self");
  const result = cancelOrder(user, orderId);
  if (result.ok) revalidatePath("/my-orders");
  return result;
}
