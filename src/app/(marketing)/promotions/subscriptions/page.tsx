import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { SUBSCRIPTION_PLANS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coffee subscriptions",
  description:
    "Freshly roasted Ermi beans delivered every month. Choose a plan, pick your grind, cancel any time.",
};

const FAQ = [
  {
    q: "When do you roast and ship?",
    a: "We roast on Mondays and Thursdays, so your beans are usually in the post within a day of roasting and land within three.",
  },
  {
    q: "Whole bean or ground?",
    a: "Choose either at checkout. If you choose ground, tell us your brewer and we will match the grind — filter, espresso or press.",
  },
  {
    q: "Can I pause or cancel?",
    a: "Yes, from your account at any time. There is no minimum term and no cancellation fee.",
  },
  {
    q: "Is the subscription shared with my app account?",
    a: "It is. Subscribers earn loyalty points on every delivery, and your discount applies automatically at the counter.",
  },
];

export default function SubscriptionsPage() {
  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Subscriptions"
          title="Beans on repeat, roasted to order"
          lead="Pick the plan that fits your kitchen. Every delivery earns loyalty points, and subscribers get money off at the counter."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className="mk-card relative flex flex-col p-6"
              style={plan.featured ? { borderColor: "var(--brand)", boxShadow: "0 10px 40px -24px var(--brand)" } : undefined}
            >
              {plan.featured && (
                <span
                  className="absolute -top-3 left-6 chip ring-1 ring-inset"
                  style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  Most popular
                </span>
              )}
              <h2 className="mk-h3">{plan.name}</h2>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="num text-3xl font-semibold">{plan.price}</span>
                <span className="text-[0.875rem]" style={{ color: "var(--text-faint)" }}>
                  {plan.cadence}
                </span>
              </p>
              <p className="mt-3 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
                {plan.description}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-[0.875rem]">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span aria-hidden style={{ color: "var(--brand)" }}>
                      ✓
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`btn btn-lg mt-6 ${plan.featured ? "btn-primary" : ""}`}
              >
                Create account to subscribe
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section sunken>
        <SectionHeading eyebrow="Questions" title="Before you subscribe" />
        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="mk-card p-6">
              <h3 className="mk-h3">{f.q}</h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
