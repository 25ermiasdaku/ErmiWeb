import { get, all } from "./db";
import type { MenuItem } from "./types";

/**
 * Turns a placed order into concrete stock movements.
 *
 * Three adjustments happen on top of the base recipe:
 *   1. Size scales the recipe. Only mass/volume ingredients (g, mL) scale —
 *      a "Large" still uses exactly one cup.
 *   2. A milk choice replaces the recipe's default milk SKU.
 *   3. Extras pull additional stock (an extra shot is real coffee).
 */

export const MILK_SKUS: Record<string, string> = {
  Whole: "MILK-WHOLE",
  Skim: "MILK-SKIM",
  "Non-dairy": "MILK-OAT",
  Oat: "MILK-OAT",
  Almond: "MILK-ALMOND",
};

export const EXTRA_PULLS: Record<string, Array<{ sku: string; qty: number }>> = {
  "Extra shot": [{ sku: "BEAN-HOUSE", qty: 9 }],
  "Double shot": [{ sku: "BEAN-HOUSE", qty: 18 }],
  Vanilla: [{ sku: "SYRUP-VAN", qty: 15 }],
  Caramel: [{ sku: "SYRUP-CAR", qty: 15 }],
  Hazelnut: [{ sku: "SYRUP-HAZ", qty: 10 }],
  Chocolate: [{ sku: "SYRUP-CHOC", qty: 20 }],
};

export const SIZE_FACTORS: Record<string, number> = {
  Small: 0.75,
  Medium: 1,
  Large: 1.25,
  "12 oz": 1,
  "16 oz": 1.33,
  "250 g": 1,
  "500 g": 2,
  "1 kg": 4,
};

const SCALABLE_UNITS = new Set(["g", "mL", "ml", "L", "l"]);

export type Deduction = { sku: string; name: string; qty: number; unit: string };

/** Input: itemId + chosen option labels + qty. */
export type DeductionRequest = {
  itemId: number;
  optionLabels: string[];
  qty: number;
};

export function resolveDeductions(requests: DeductionRequest[]): Deduction[] {
  const totals = new Map<string, Deduction>();

  const add = (sku: string, qty: number) => {
    if (qty <= 0) return;
    const inv = get<{ name: string; unit: string }>(
      "SELECT name, unit FROM inventory_items WHERE sku = ?",
      sku,
    );
    if (!inv) return;
    const existing = totals.get(sku);
    if (existing) {
      existing.qty += qty;
    } else {
      totals.set(sku, { sku, name: inv.name, qty, unit: inv.unit });
    }
  };

  for (const req of requests) {
    const recipe = get<{ id: number }>("SELECT id FROM recipes WHERE menu_item_id = ?", req.itemId);
    if (!recipe) continue;

    const ingredients = all<{ inventory_item_id: number; qty: number; sku: string; unit: string }>(
      `SELECT ri.inventory_item_id, ri.qty, i.sku, i.unit
         FROM recipe_ingredients ri
         JOIN inventory_items i ON i.id = ri.inventory_item_id
        WHERE ri.recipe_id = ?`,
      recipe.id,
    );

    const sizeLabel = req.optionLabels.find((l) => l in SIZE_FACTORS);
    const factor = sizeLabel ? SIZE_FACTORS[sizeLabel]! : 1;

    const milkLabel = req.optionLabels.find((l) => l in MILK_SKUS || l === "None");
    const milkSku = milkLabel === "None" ? null : milkLabel ? MILK_SKUS[milkLabel] : undefined;

    for (const ing of ingredients) {
      let sku = ing.sku;
      // A milk choice overrides whatever milk the recipe calls for.
      if (milkSku !== undefined && ing.sku.startsWith("MILK-")) {
        if (milkSku === null) continue; // "None" removes the milk entirely
        sku = milkSku;
      }
      const scale = SCALABLE_UNITS.has(ing.unit) ? factor : 1;
      add(sku, round3(ing.qty * scale * req.qty));
    }

    for (const label of req.optionLabels) {
      for (const pull of EXTRA_PULLS[label] ?? []) {
        add(pull.sku, round3(pull.qty * req.qty));
      }
    }
  }

  return [...totals.values()];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------
// Server-side price validation
// ---------------------------------------------------------------

export type PricedLine = {
  itemId: number;
  name: string;
  icon: string;
  qty: number;
  unitPriceCents: number;
  options: Array<{ label: string; group: string; priceDeltaCents: number }>;
};

export type LineRequest = { itemId: number; qty: number; optionIds: number[] };

/**
 * Recompute every price from the database. The client only ever sends ids,
 * so a tampered payload cannot invent a price.
 */
export function priceLines(lines: LineRequest[]): PricedLine[] {
  if (lines.length === 0) throw new Error("Cart is empty.");

  const itemIds = [...new Set(lines.map((l) => l.itemId))];
  const items = all<MenuItem>(
    `SELECT * FROM menu_items WHERE active = 1 AND id IN (${itemIds.map(() => "?").join(",")})`,
    ...itemIds,
  );
  const itemById = new Map(items.map((i) => [i.id, i]));

  const optionIds = [...new Set(lines.flatMap((l) => l.optionIds))];
  const options = optionIds.length
    ? all<{ id: number; menu_item_id: number; group_name: string; label: string; price_delta_cents: number }>(
        `SELECT id, menu_item_id, group_name, label, price_delta_cents
           FROM item_options WHERE id IN (${optionIds.map(() => "?").join(",")})`,
        ...optionIds,
      )
    : [];
  const optById = new Map(options.map((o) => [o.id, o]));

  return lines.map((line) => {
    const item = itemById.get(line.itemId);
    if (!item) throw new Error("That item is no longer on the menu.");
    const qty = Math.floor(line.qty);
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) throw new Error("Invalid quantity.");

    // One choice per group; drop any option that doesn't belong to this item.
    const byGroup = new Map<string, { label: string; group: string; priceDeltaCents: number }>();
    for (const oid of line.optionIds) {
      const opt = optById.get(oid);
      if (!opt || opt.menu_item_id !== item.id) continue;
      byGroup.set(opt.group_name, {
        label: opt.label,
        group: opt.group_name,
        priceDeltaCents: opt.price_delta_cents,
      });
    }
    const chosen = [...byGroup.values()];
    const unitPriceCents =
      item.base_price_cents + chosen.reduce((sum, o) => sum + o.priceDeltaCents, 0);

    return {
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      qty,
      unitPriceCents,
      options: chosen,
    };
  });
}

// ---------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------
// `ALLOWED_NEXT` lives in ./order-flow so client components can import it
// without dragging `node:sqlite` into the browser bundle.
