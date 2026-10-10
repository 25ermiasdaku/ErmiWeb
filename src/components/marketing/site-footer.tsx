import Link from "next/link";
import type { Route } from "next";
import { LOCATIONS } from "@/lib/marketing";

/**
 * Public site footer. Server component — no state, just links and the brand
 * line. The store list is shared with /locations so the two never drift.
 */
export function SiteFooter({ cafeName, tagline }: { cafeName: string; tagline: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t" style={{ backgroundColor: "var(--surface-sunken)" }}>
      <div className="mk-wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl text-lg"
              style={{ backgroundColor: "var(--color-espresso-500)", color: "var(--color-cream-50)" }}
              aria-hidden
            >
              ☕
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-tight">{cafeName}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
            {tagline}. Small-batch coffee, direct-trade beans and a loyalty card that actually
            pays you back.
          </p>
        </div>

        <FooterColumn
          title="Explore"
          links={[
            { href: "/menu", label: "Menu & beans" },
            { href: "/promotions", label: "Offers" },
            { href: "/promotions/rewards", label: "Loyalty & rewards" },
            { href: "/promotions/subscriptions", label: "Subscriptions" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { href: "/about", label: "Our story" },
            { href: "/about", label: "Sustainability" },
            { href: "/locations", label: "Find a cafe" },
            { href: "/register", label: "Create account" },
            { href: "/login", label: "Sign in" },
          ]}
        />

        <div>
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Visit
          </h3>
          <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {LOCATIONS.map((l) => (
              <li key={l.name}>
                <span className="block font-medium" style={{ color: "var(--text)" }}>
                  {l.name}
                </span>
                <span className="text-[0.8125rem]">
                  {l.address}, {l.area}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mk-wrap flex flex-col items-center justify-between gap-2 py-5 text-[0.75rem] sm:flex-row" style={{ color: "var(--text-faint)" }}>
          <p>
            © {year} {cafeName}. Roasted with care.
          </p>
          <p>Order on the web or in the app · Rewards shared across both</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: Route; label: string }>;
}) {
  return (
    <div>
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="transition-colors hover:underline" style={{ color: "var(--text-muted)" }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
