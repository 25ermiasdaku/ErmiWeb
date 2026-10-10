/**
 * System settings — the small set of knobs an owner can turn from the admin
 * area. Anything the app needs to read goes through here so there is a single
 * definition of the key, its type, its bounds and its fallback.
 *
 * Note: currency is deliberately not configurable. money() in format.ts
 * formats USD, and making it dynamic would mean threading a currency through
 * every table cell for little gain in a single-cafe system.
 */
import { all, run } from "./db";
import { POINTS_PER_DOLLAR, TAX_RATE } from "./format";

export type SettingDef = {
  key: string;
  label: string;
  type: "text" | "number" | "percent";
  description: string;
  fallback: string;
  min?: number;
  max?: number;
  step?: number;
  /** Grouping in the settings form. */
  section: string;
};

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "cafe_name",
    label: "Cafe name",
    type: "text",
    section: "Cafe",
    description: "Shown in the header and on printed tickets.",
    fallback: "Ermi Coffee",
  },
  {
    key: "cafe_tagline",
    label: "Tagline",
    type: "text",
    section: "Cafe",
    description: "The line under the name.",
    fallback: "Roastery & counter",
  },
  {
    key: "order_prefix",
    label: "Order number prefix",
    type: "text",
    section: "Orders",
    description: "Order numbers look like PREFIX-20260928-001.",
    fallback: "E",
  },
  {
    key: "tax_rate",
    label: "Tax rate",
    type: "percent",
    section: "Orders",
    description: "Applied to the subtotal at the till. The till reads this live.",
    fallback: String(TAX_RATE * 100),
    min: 0,
    max: 40,
    step: 0.05,
  },
  {
    key: "points_per_dollar",
    label: "Points per dollar",
    type: "number",
    section: "Loyalty",
    description: "How many loyalty points a member earns per dollar spent.",
    fallback: String(POINTS_PER_DOLLAR),
    min: 0,
    max: 20,
    step: 0.5,
  },
];

const BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));

export function settingDef(key: string): SettingDef | undefined {
  return BY_KEY.get(key);
}

/** Every setting, with fallbacks filled in for anything not yet stored. */
export function getAllSettings(): Record<string, string> {
  const stored: Record<string, string> = {};
  for (const row of all<{ key: string; value: string }>("SELECT key, value FROM settings")) {
    stored[row.key] = row.value;
  }
  const out: Record<string, string> = {};
  for (const def of SETTING_DEFS) out[def.key] = stored[def.key] ?? def.fallback;
  return out;
}

export function getSetting(key: string): string {
  const def = BY_KEY.get(key);
  if (!def) return "";
  const row = all<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row[0]?.value ?? def.fallback;
}

/** A numeric setting clamped to its declared bounds, falling back safely. */
function numericSetting(key: string, fallback: number): number {
  const parsed = Number(getSetting(key));
  const def = BY_KEY.get(key);
  if (!Number.isFinite(parsed)) return fallback;
  if (def?.min !== undefined && parsed < def.min) return def.min;
  if (def?.max !== undefined && parsed > def.max) return def.max;
  return parsed;
}

/** As a fraction: 8.75 stored means 0.0875 applied. */
export function getTaxRate(): number {
  return numericSetting("tax_rate", TAX_RATE * 100) / 100;
}

export function getPointsPerDollar(): number {
  return numericSetting("points_per_dollar", POINTS_PER_DOLLAR);
}

export function getOrderPrefix(): string {
  const raw = getSetting("order_prefix").replace(/[^A-Za-z0-9]/g, "").slice(0, 4);
  return raw || "E";
}

export function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}
