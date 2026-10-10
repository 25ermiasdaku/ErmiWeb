import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneColor =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-rose-600 dark:text-rose-400"
          : undefined;

  return (
    <div className="card p-4">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <p className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneColor ?? ""}`}>{value}</p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Badge({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`chip ring-1 ring-inset ${className}`} title={title}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="text-3xl opacity-40" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && (
        <p className="max-w-sm text-xs" style={{ color: "var(--text-faint)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Compact bar chart for the 7-day revenue trend. */
export function Sparkline({
  data,
  formatValue,
}: {
  data: Array<{ day: string; revenue_cents: number; orders: number }>;
  formatValue: (cents: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.revenue_cents), 1);
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {data.map((d) => {
          const pct = Math.max(2, Math.round((d.revenue_cents / max) * 100));
          return (
            <div key={d.day} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span
                className="num text-[0.625rem] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--text-faint)" }}
              >
                {formatValue(d.revenue_cents)}
              </span>
              <div
                className="w-full rounded-t-md transition-colors"
                style={{
                  height: `${pct}%`,
                  backgroundColor: d.revenue_cents > 0 ? "var(--brand)" : "var(--surface-sunken)",
                  opacity: d.revenue_cents > 0 ? 0.35 + (pct / 100) * 0.65 : 1,
                  minHeight: 4,
                }}
                title={`${d.day}: ${formatValue(d.revenue_cents)} across ${d.orders} orders`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d) => (
          <span
            key={d.day}
            className="min-w-0 flex-1 truncate text-center text-[0.625rem]"
            style={{ color: "var(--text-faint)" }}
          >
            {new Date(`${d.day}T00:00:00`).toLocaleDateString("en-US", { weekday: "narrow" })}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "var(--brand)",
}: {
  value: number;
  max: number;
  tone?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "var(--surface-sunken)" }}
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: tone }} />
    </div>
  );
}

/** Horizontal bar used in the top-sellers and top-members lists. */
export function RankBar({ value, max, tone }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-sunken)" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: tone ?? "var(--brand)" }}
      />
    </div>
  );
}
