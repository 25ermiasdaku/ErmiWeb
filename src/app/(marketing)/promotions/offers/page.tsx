import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { PROMOTIONS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seasonal offers",
  description:
    "Seasonal drinks, member-only deals and everyday perks at Ermi Coffee. Here is everything running right now.",
};

export default function OffersPage() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Seasonal offers"
        title="Good things, while they last"
        lead="Our offers change with the harvest and the weather. Members hear about them first."
      />

      <div className="space-y-6">
        {PROMOTIONS.map((p) => (
          <article key={p.id} className="mk-card overflow-hidden">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className={`relative min-h-40 bg-gradient-to-br ${p.accent} p-8`}>
                <span
                  className="chip ring-1 ring-inset"
                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand)" }}
                >
                  {p.badge}
                </span>
                <h2 className="mk-h2 mt-4">{p.title}</h2>
                <p className="mt-2 text-[0.9375rem]" style={{ color: "var(--text-muted)" }}>
                  {p.blurb}
                </p>
              </div>
              <div className="p-8">
                <p className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {p.detail}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={p.href} className="btn btn-primary">
                    {p.cta}
                  </Link>
                  <Link href="/register" className="btn">
                    Join for free
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mk-card mt-10 p-6 sm:p-8">
        <h3 className="mk-h3">A note on fairness</h3>
        <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Offers cannot be combined, and seasonal pricing is honest year round — we do not inflate a
          price to call the discount a saving. Tasting notes on every card reflect the cup we are
          actually pouring.
        </p>
      </div>
    </Section>
  );
}
