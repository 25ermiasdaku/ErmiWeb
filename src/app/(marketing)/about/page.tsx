import type { Metadata } from "next";
import Link from "next/link";
import { Callout, Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { BRAND, PROCESS, SOURCING, TESTIMONIALS, VALUES } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our story & sustainability",
  description:
    "How Ermi Coffee sources, roasts and serves: direct-trade relationships, weekly small-batch roasting, and a low-waste counter.",
};

export default function AboutPage() {
  return (
    <>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mk-eyebrow mb-3">About Ermi</p>
            <h1 className="mk-h1">{BRAND.storyTitle}</h1>
            <p className="mk-lead mt-5">{BRAND.storyBody}</p>
            <p className="mk-lead mt-4">{BRAND.storyBody2}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/menu" className="btn btn-primary">
                See what we pour
              </Link>
              <Link href="/locations" className="btn">
                Visit a cafe
              </Link>
            </div>
          </div>

          <div
            className="rounded-2xl p-8"
            style={{
              background: "linear-gradient(155deg, var(--color-espresso-800), var(--color-espresso-950))",
              color: "var(--color-cream-100)",
            }}
          >
            <p className="mk-eyebrow" style={{ color: "var(--color-caramel-400)" }}>
              By the numbers
            </p>
            <dl className="mt-5 space-y-5">
              {[
                { k: "9", v: "named farm partners, year on year" },
                { k: "2×", v: "the commodity price paid, on average" },
                { k: "48h", v: "from roast to your cup, at its best" },
                { k: "100%", v: "of spent grounds composted locally" },
              ].map((s) => (
                <div key={s.v} className="flex items-baseline gap-4 border-b pb-4" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                  <dt className="num w-16 shrink-0 text-2xl font-semibold text-cream-50">{s.k}</dt>
                  <dd className="text-[0.875rem] text-cream-200/80">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section sunken>
        <SectionHeading
          align="center"
          eyebrow="How we work"
          title="From the farm gate to your flat white"
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((p) => (
            <li key={p.step} className="mk-card p-6">
              <span className="num text-[0.6875rem] font-semibold" style={{ color: "var(--brand)" }}>
                {p.step}
              </span>
              <h3 className="mk-h3 mt-2">{p.title}</h3>
              <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {p.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Sourcing"
          title="The lots we buy, and why"
          lead="We keep a short list of origins and return to them season after season, so the growers can plan and you can taste the consistency."
        />
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ backgroundColor: "var(--surface-sunken)" }}>
                <th className="th">Region</th>
                <th className="th">What it brings</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SOURCING.map((s) => (
                <tr key={s.region}>
                  <td className="td font-medium whitespace-nowrap">{s.region}</td>
                  <td className="td" style={{ color: "var(--text-muted)" }}>
                    {s.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section sunken>
        <SectionHeading align="center" eyebrow="Sustainability" title="Good coffee should be good all the way down" />
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="mk-card p-6">
              <span aria-hidden className="text-3xl">
                {v.icon}
              </span>
              <h3 className="mk-h3 mt-3">{v.title}</h3>
              <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
                {v.body}
              </p>
            </div>
          ))}
        </div>
        <Callout className="mt-6">
          <h3 className="mk-h3">Our roadmap, not a round-up</h3>
          <ul className="mt-3 grid gap-2.5 text-[0.875rem] sm:grid-cols-2" style={{ color: "var(--text-muted)" }}>
            <li>Move the to-go range to fully home-compostable by next summer.</li>
            <li>Publish an annual sourcing report with the prices we paid.</li>
            <li>Fit a heat-recovery unit on the roaster to cut gas use.</li>
            <li>Return 1% of retail bean sales to the growers&apos; cooperative fund.</li>
          </ul>
        </Callout>
      </Section>

      <Section>
        <SectionHeading align="center" eyebrow="In their words" title="What our regulars say" />
        <div className="grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="mk-card flex flex-col p-6">
              <span aria-hidden className="text-2xl" style={{ color: "var(--brand)" }}>
                &ldquo;
              </span>
              <blockquote className="mt-2 flex-1 text-[0.9375rem] leading-relaxed">{t.quote}</blockquote>
              <figcaption className="mt-4 border-t pt-3">
                <span className="block text-[0.875rem] font-medium">{t.name}</span>
                <span className="block text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {t.role}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </>
  );
}
