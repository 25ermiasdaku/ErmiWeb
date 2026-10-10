import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { REWARD_STEPS, REWARD_TIERS } from "@/lib/marketing";
import { getRewards } from "@/lib/queries";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loyalty & rewards",
  description:
    "Earn one point per dollar at Ermi Coffee, climb three tiers, and redeem points for drinks, merchandise and upgrades.",
};

export default function RewardsPage() {
  // The live reward menu, so the public page and the app never disagree.
  const rewards = getRewards();

  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Loyalty programme"
          title="Points for every cup"
          lead="Join free, earn a point for every dollar, and spend them on the things you were going to buy anyway."
          action={
            <Link href="/register" className="btn btn-primary">
              Join &amp; start earning
            </Link>
          }
        />

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REWARD_STEPS.map((s) => (
            <li key={s.step} className="mk-card p-6">
              <span className="num text-[0.6875rem] font-semibold" style={{ color: "var(--brand)" }}>
                {s.step}
              </span>
              <h3 className="mk-h3 mt-2">{s.title}</h3>
              <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {rewards.length > 0 && (
        <Section sunken>
          <SectionHeading
            eyebrow="The redemption menu"
            title="What your points buy"
            lead="Redeem at the counter or in the app at checkout — the reward is taken off your order."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => (
              <div key={r.id} className="mk-card flex flex-col p-6">
                <span className="chip ring-1 ring-inset w-fit" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
                  {r.points_cost.toLocaleString()} pts
                </span>
                <h3 className="mk-h3 mt-3">{r.name}</h3>
                <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {r.description}
                </p>
                {r.value_cents > 0 && (
                  <p className="mt-3 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    Worth up to {money(r.value_cents)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <SectionHeading
          eyebrow="Tiers"
          title="The more you visit, the more you get"
          lead="Tiers are based on the points you have earned, not spent — so redeeming a reward never sets you back."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {REWARD_TIERS.map((t, i) => (
            <div key={t.name} className={`mk-card ring-1 ring-inset p-6 ${t.tone}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="mk-h3">{t.name}</h3>
                <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  Tier {i + 1}
                </span>
              </div>
              <p className="mk-eyebrow mt-1">{t.min}</p>
              <ul className="mt-4 space-y-2.5 text-[0.875rem]">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span aria-hidden style={{ color: "var(--brand)" }}>
                      ✓
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section sunken>
        <div className="mk-card p-6 sm:p-8">
          <h2 className="mk-h2">The small print, openly</h2>
          <ul className="mt-4 space-y-3 text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <li>Points are earned on the amount you pay, after tax and after any reward is applied.</li>
            <li>Points are added when you collect your order, not when you place it.</li>
            <li>One account per person. Points are not transferable between accounts.</li>
            <li>We will never sell your data, and you can close your account at any time.</li>
          </ul>
        </div>
      </Section>
    </>
  );
}
