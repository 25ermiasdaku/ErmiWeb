import Link from "next/link";
import { Callout, Section, SectionHeading } from "@/components/marketing/marketing-ui";
import {
  APP_FEATURES,
  BRAND,
  LOCATIONS,
  PROCESS,
  PROMOTIONS,
  REWARD_TIERS,
  TESTIMONIALS,
  VALUES,
  coffeeMeta,
} from "@/lib/marketing";
import { getMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * The landing page. Everything static comes from lib/marketing; the "on the bar"
 * showcase is the live catalogue, so a seasonal drink an owner adds at the till
 * shows up here without a code change.
 */
export default function HomePage() {
  const menu = getMenu();
  const signature = menu.filter((m) => m.is_signature === 1);
  const featured = (
    signature.length >= 4 ? signature : [...signature, ...menu.filter((m) => !m.is_signature)]
  ).slice(0, 4);
  const hero = featured[0];
  const heroMeta = hero ? coffeeMeta(hero) : null;

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(155deg, var(--color-espresso-900), var(--color-espresso-800) 55%, var(--color-espresso-950))",
          color: "var(--color-cream-100)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-caramel-500), transparent 65%)" }}
        />
        <div className="mk-wrap relative grid gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
          <div>
            <p className="mk-eyebrow" style={{ color: "var(--color-caramel-400)" }}>
              Roastery &amp; counter · since 2016
            </p>
            <h1 className="mk-h1 mt-4 max-w-2xl text-cream-50">
              Better coffee, poured with intent.
            </h1>
            <p className="mk-lead mt-5 max-w-xl text-cream-200/85">
              Direct-trade beans roasted in small batches, a menu built around the season, and a
              loyalty card that gives a little back on every cup. Order at the counter or ahead on
              the web and in the app.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-lg btn-cream">
                Create a free account
              </Link>
              <Link href="/menu" className="btn btn-lg" style={{ color: "var(--color-cream-100)" }}>
                Browse the menu
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
              {[
                { k: "3", v: "cafés & counting" },
                { k: "1 pt", v: "per dollar spent" },
                { k: "Weekly", v: "small-batch roast" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="text-lg font-semibold text-cream-50">{s.k}</dt>
                  <dd className="text-[0.75rem] text-cream-200/70">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Featured drink card */}
          {hero && heroMeta && (
            <div className="relative">
              <div
                className="mk-card p-6 sm:p-7"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--color-espresso-950) 70%, transparent)",
                  borderColor: "rgba(255,255,255,0.14)",
                  color: "var(--color-cream-100)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="chip"
                    style={{ backgroundColor: "rgba(217,160,102,0.18)", color: "var(--color-caramel-400)" }}
                  >
                    On the bar now
                  </span>
                  <span className="text-[0.6875rem] text-cream-200/60">Signature</span>
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <span aria-hidden className="text-5xl">
                    {hero.icon}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-cream-50">{hero.name}</h3>
                    <p className="text-[0.8125rem] text-cream-200/75">{heroMeta.origin}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-cream-200/80">{heroMeta.notes}</p>
                <div className="mt-6 flex items-end justify-between gap-3 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                  <div className="flex flex-wrap gap-2 text-[0.6875rem]">
                    <span className="chip" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                      Roast · {heroMeta.roast}
                    </span>
                    <span className="chip" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                      Customisable
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- On the bar ---------------- */}
      {featured.length > 0 && (
        <Section>
          <SectionHeading
            eyebrow="The showcase"
            title="This season on the bar"
            lead="A short list of what we are proudest of right now. Every drink can be sized, milked and sweetened your way."
            action={
              <Link href="/menu" className="btn">
                Full menu
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => {
              const meta = coffeeMeta(item);
              return (
                <Link
                  key={item.id}
                  href="/menu"
                  className="mk-card mk-card-hover flex flex-col p-5"
                >
                  <span aria-hidden className="text-3xl">
                    {item.icon}
                  </span>
                  <h3 className="mk-h3 mt-3">{item.name}</h3>
                  <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                    {meta.notes}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    <span>{meta.roast} roast</span>
                    <span>{meta.origin}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ---------------- Values ---------------- */}
      <Section sunken>
        <SectionHeading
          align="center"
          eyebrow="What we stand for"
          title="Good coffee should be good all the way down"
          lead="Three promises we keep from the farm gate to your cup."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="mk-card p-6">
              <span aria-hidden className="text-3xl">
                {v.icon}
              </span>
              <h3 className="mk-h3 mt-3">{v.title}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- Story + process ---------------- */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mk-eyebrow mb-2">Our story</p>
            <h2 className="mk-h2">{BRAND.storyTitle}</h2>
            <p className="mk-lead mt-4">{BRAND.storyBody}</p>
            <p className="mk-lead mt-4">{BRAND.storyBody2}</p>
            <Link href="/about" className="btn mt-6">
              Read our story
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {PROCESS.map((p) => (
              <li key={p.step} className="mk-card p-5">
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
        </div>
      </Section>

      {/* ---------------- Rewards teaser ---------------- */}
      <Section sunken>
        <SectionHeading
          eyebrow="Loyalty"
          title="A rewards card you actually use"
          lead="One account for the app and the web portal. Every dollar earns a point, and points turn into drinks."
          action={
            <Link href="/promotions/rewards" className="btn">
              How rewards work
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {REWARD_TIERS.map((t) => (
            <div key={t.name} className={`mk-card ring-1 ring-inset p-6 ${t.tone}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="mk-h3">{t.name}</h3>
                <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  {t.min}
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden style={{ color: "var(--brand)" }}>
                      ✓
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- Promotion ---------------- */}
      <Section>
        <Callout className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{ background: "linear-gradient(120deg, transparent, var(--brand-soft))" }}
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <span className="chip ring-1 ring-inset" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
                {PROMOTIONS[0]!.badge}
              </span>
              <h2 className="mk-h2 mt-3">{PROMOTIONS[0]!.title}</h2>
              <p className="mk-lead mt-3">{PROMOTIONS[0]!.detail}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href={PROMOTIONS[0]!.href} className="btn btn-primary btn-lg">
                {PROMOTIONS[0]!.cta}
              </Link>
              <Link href="/promotions" className="btn btn-lg">
                All offers
              </Link>
            </div>
          </div>
        </Callout>
      </Section>

      {/* ---------------- App ---------------- */}
      <Section sunken>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mk-eyebrow mb-2">The app</p>
            <h2 className="mk-h2">Your coffee, one tap ahead</h2>
            <p className="mk-lead mt-4">
              The Ermi app is where ordering, loyalty and your account live together. Pick a pickup
              time, reorder a favourite and watch your points climb — the same account works on the
              web.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {APP_FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span aria-hidden className="text-xl">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-[0.875rem] font-medium">{f.title}</p>
                    <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      {f.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mk-card p-6 sm:p-8">
            <h3 className="mk-h3">Coming to the stores</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              The iOS and Android apps are on the way. Until then, order and earn rewards right here
              on the web portal.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { name: "App Store", note: "iOS 16+" },
                { name: "Google Play", note: "Android 10+" },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span aria-hidden className="text-xl">
                    {s.name === "App Store" ? "" : "▶"}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[0.8125rem] font-medium">{s.name}</span>
                    <span className="block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {s.note} · coming soon
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <Link href="/register" className="btn btn-primary btn-lg mt-5 w-full">
              Create a free account
            </Link>
          </div>
        </div>
      </Section>

      {/* ---------------- Testimonials ---------------- */}
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

      {/* ---------------- Locations ---------------- */}
      <Section sunken>
        <SectionHeading
          eyebrow="Find us"
          title="Three doors, one roastery"
          action={
            <Link href="/locations" className="btn">
              All locations
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {LOCATIONS.map((l) => (
            <div key={l.name} className="mk-card p-5">
              <h3 className="mk-h3">{l.name}</h3>
              <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                {l.address}, {l.area}
              </p>
              <p className="mt-3 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                {l.hours}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- Closing CTA ---------------- */}
      <Section>
        <div
          className="rounded-2xl px-6 py-12 text-center sm:px-12"
          style={{
            background: "linear-gradient(155deg, var(--color-espresso-800), var(--color-espresso-950))",
            color: "var(--color-cream-100)",
          }}
        >
          <h2 className="mk-h2 text-cream-50">Ready when you are.</h2>
          <p className="mk-lead mx-auto mt-3 max-w-xl text-cream-200/85">
            Create an account to order ahead and earn rewards, or wander into any of our cafés and
            let us make it for you.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn btn-lg btn-cream">
              Create account
            </Link>
            <Link href="/menu" className="btn btn-lg" style={{ color: "var(--color-cream-100)" }}>
              See the menu
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
