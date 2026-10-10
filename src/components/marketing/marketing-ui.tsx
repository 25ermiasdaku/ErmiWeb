import type { ReactNode } from "react";

/**
 * Presentational helpers shared by the public pages. Server-only: nothing here
 * holds state or reads the browser, so it stays out of the client bundle.
 */

export function Section({
  children,
  className = "",
  sunken = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  sunken?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`py-16 sm:py-20 ${className}`}
      style={sunken ? { backgroundColor: "var(--surface-sunken)" } : undefined}
    >
      <div className="mk-wrap">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  action,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  action?: ReactNode;
}) {
  return (
    <div
      className={`mb-8 flex flex-col gap-4 sm:mb-10 ${
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between"
      }`}
    >
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        {eyebrow && <p className="mk-eyebrow mb-2">{eyebrow}</p>}
        <h2 className="mk-h2">{title}</h2>
        {lead && <p className="mk-lead mt-3">{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A tinted, bordered panel used for cross-links and callouts. */
export function Callout({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mk-card overflow-hidden p-6 sm:p-8 ${className}`}
      style={{ backgroundColor: "var(--surface-raised)" }}
    >
      {children}
    </div>
  );
}
