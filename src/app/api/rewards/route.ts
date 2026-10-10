import { json } from "@/lib/api";
import { getRewards } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Active rewards, cheapest first, so the affordable ones are near the top. */
export async function GET(): Promise<Response> {
  const rewards = getRewards().map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    pointsCost: r.points_cost,
    kind: r.kind,
    valueCents: r.value_cents,
  }));
  return json({ rewards });
}
