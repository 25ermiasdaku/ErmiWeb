export const TAX_RATE = 0.0875;
export const POINTS_PER_DOLLAR = 1;

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

/** Compact money for tight table cells, e.g. $1.2k */
export function moneyShort(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}

export function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** SQLite stores dates as "YYYY-MM-DD HH:MM:SS" in UTC. */
export function parseDate(value: string): Date {
  return new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
}

export function timeAgo(value: string, now = Date.now()): string {
  const then = parseDate(value).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return parseDate(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function clockTime(value: string): string {
  return parseDate(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function dateTime(value: string): string {
  return parseDate(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayLabel(value: string): string {
  return parseDate(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function duration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
