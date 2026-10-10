import { json, readJson, requireApiPermission } from "@/lib/api";
import { getMyOrders } from "@/lib/my-order";
import { placeOrder } from "@/lib/my-order-service";
import type { LineRequest } from "@/lib/fulfilment";

export const dynamic = "force-dynamic";

function apiOrder(o: ReturnType<typeof getMyOrders>[number]) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    note: o.note,
    subtotalCents: o.subtotal_cents,
    taxCents: o.tax_cents,
    totalCents: o.total_cents,
    pointsEarned: o.points_earned,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    confirmedAt: o.confirmed_at,
    collectedAt: o.collected_at,
    items: o.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      lineTotalCents: i.line_total_cents,
      options: i.options,
    })),
  };
}

/** This account's own orders, newest first. */
export async function GET(req: Request): Promise<Response> {
  const auth = requireApiPermission(req, "orders.self");
  if ("deny" in auth) return auth.deny;
  return json({ orders: getMyOrders(auth.user.id, 24).map(apiOrder) });
}

/** Place an order on your own account. Starts life as `pending`. */
export async function POST(req: Request): Promise<Response> {
  const auth = requireApiPermission(req, "orders.self");
  if ("deny" in auth) return auth.deny;

  const body = await readJson(req);
  if (!body) return json({ ok: false, message: "Malformed request." }, { status: 400 });

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const lines: LineRequest[] = rawLines.map((raw) => {
    const line = raw as { itemId?: unknown; qty?: unknown; optionIds?: unknown };
    return {
      itemId: Number(line.itemId),
      qty: Number(line.qty),
      optionIds: Array.isArray(line.optionIds) ? line.optionIds.map(Number) : [],
    };
  });

  const result = await placeOrder(auth.user, {
    lines,
    note: typeof body.note === "string" ? body.note : "",
    rewardId: typeof body.rewardId === "number" ? body.rewardId : null,
  });

  return json(result, { status: result.ok ? 200 : 400 });
}
