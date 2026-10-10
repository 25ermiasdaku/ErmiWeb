import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { PROMOTIONS, REWARD_TIERS, SUBSCRIPTION_PLANS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offers & promotions",
  description:
    "Seasonal drinks, coffee subscriptions, a loyalty programme and everyday perks. Everything Ermi is running right now.",
};

const HUB = [
  {
    href: "/promotions/offers" as const,
    title: "Seasonal offers",
    body: "Limited drinks and member-only deals, refreshed with the calendar.",
    icon: "🍂",
  },
  {
    href: "/promotions/subscriptions" as const,
    title: "Coffee subscriptions",
    body: "Freshly roasted beans delivered monthly, from $18 a bag.",
    icon: "📦",
  },
  {
    href: "/promotions/rewards" as const,
    title: "Rewards programme",
    body: "Earn a point per dollar and trade them for drinks and upgrades.",
    icon: "🎁",
  },
  {
    href: "/locations" as const,
    title: "Find a cafe",
    body: "Three doors across the city, all pouring the same roast.",
    icon: "📍",
  },
];

export default function PromotionsPage() {
  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="What's on"
          title="Offers, subscriptions and rewards"
          lead="We keep the good stuff simple: a seasonal drink worth waiting for, beans you can take home, and points that actually add up."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {HUB.map((h) => (
            <Link key={h.href} href={h.href} className="mk-card mk-card-hover flex gap-4 p-6">
              <span aria-hidden className="text-3xl">
                {h.icon}
              </span>
              <span>
                <span className="mk-h3 block">{h.title}</span>
                <span className="mt-1 block text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
                  {h.body}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section sunken>
        <SectionHeading eyebrow="Running now" title="Current promotions" />
        <div className="grid gap-4 lg:grid-cols-3">
          {PROMOTIONS.map((p) => (
            <article key={p.id} className={`mk-card overflow-hidden p-6`}>
              <div className={`-mx-6 -mt-6 mb-5 bg-gradient-to-br ${p.accent} px-6 py-5`}>
                <span
                  className="chip ring-1 ring-inset"
                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand)" }}
                >
                  {p.badge}
                </span>
                <h3 className="mk-h3 mt-3">{p.title}</h3>
                <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {p.blurb}
                </p>
              </div>
              <p className="text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {p.detail}
              </p>
              <Link href={p.href} className="btn mt-5">
                {p.cta}
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Subscriptions"
          title="Beans on repeat"
          lead="From a single monthly bag to a rotating roaster's selection. Skip, pause or cancel any time."
          action={
            <Link href="/promotions/subscriptions" className="btn">
              Compare plans
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div key={plan.id} className={`mk-card p-6 ${plan.featured ? "ring-2 ring-inset" : ""}`} style={plan.featured ? { borderColor: "var(--brand)" } : undefined}>
              {plan.featured && <p className="mk-eyebrow mb-2">Most popular</p>}
              <h3 className="mk-h3">{plan.name}</h3>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="num text-2xl font-semibold">{plan.price}</span>
                <span className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
                  {plan.cadence}
                </span>
              </p>
              <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {plan.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section sunken>
        <SectionHeading
          eyebrow="Rewards"
          title="Three tiers, real perks"
          action={
            <Link href="/promotions/rewards" className="btn">
              Programme details
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {REWARD_TIERS.map((t) => (
            <div key={t.name} className={`mk-card ring-1 ring-inset p-6 ${t.tone}`}>
              <h3 className="mk-h3">{t.name}</h3>
              <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                {t.min}
              </p>
              <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {t.perks[0]}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
