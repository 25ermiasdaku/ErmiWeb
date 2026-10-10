import { json } from "@/lib/api";
import { coffeeMeta } from "@/lib/marketing";
import { getMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** The live catalogue, with tasting notes and modifier options. */
export async function GET(): Promise<Response> {
  const items = getMenu().map((item) => {
    const meta = coffeeMeta(item);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      basePriceCents: item.base_price_cents,
      icon: item.icon,
      isSignature: item.is_signature === 1,
      categoryName: item.category_name ?? "",
      categorySlug: item.category_slug ?? "",
      roast: meta.roast,
      origin: meta.origin,
      notes: meta.notes,
      options: item.options.map((o) => ({
        id: o.id,
        groupName: o.group_name,
        label: o.label,
        priceDeltaCents: o.price_delta_cents,
        isDefault: o.is_default === 1,
      })),
    };
  });

  return json({ items });
}
