import { json, readJson, requireApiPermission } from "@/lib/api";
import { cancelOrder, confirmOrder } from "@/lib/my-order-service";

export const dynamic = "force-dynamic";

/**
 * The customer's two confirmations, and withdrawing a pending order.
 *
 * `action` picks the move; the service still decides whether it is legal from
 * the order's current status, so a crafted call cannot jump the ticket.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = requireApiPermission(req, "orders.self");
  if ("deny" in auth) return auth.deny;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return json({ ok: false, message: "Unknown order." }, { status: 400 });
  }

  const body = (await readJson(req)) ?? {};
  const action = String(body.action ?? "");

  const result =
    action === "confirm"
      ? confirmOrder(auth.user, orderId)
      : action === "cancel"
        ? cancelOrder(auth.user, orderId)
        : { ok: false, message: 'Send {"action":"confirm"|"cancel"}.' };

  return json(result, { status: result.ok ? 200 : 400 });
}
