import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { LOCATIONS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cafés & locations",
  description:
    "Find your nearest Ermi Coffee. Three cafés across the city, all pouring the same weekly roast.",
};

export default function LocationsPage() {
  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Visit us"
          title="Find your nearest counter"
          lead="Every location pours the same roast and honours the same rewards. Order ahead and collect without queueing."
        />

        <div className="grid gap-6">
          {LOCATIONS.map((l) => (
            <article key={l.name} className="mk-card grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="flex items-center gap-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  <span aria-hidden>📍</span>
                  {l.area}
                </div>
                <h2 className="mk-h2 mt-2">{l.name}</h2>
                <p className="mt-2 text-[0.9375rem]" style={{ color: "var(--text-muted)" }}>
                  {l.address}, {l.area}
                </p>
                <p className="mt-3 text-[0.875rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {l.note}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/register" className="btn btn-primary">
                    Create account to order
                  </Link>
                  <a
                    className="btn"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.address} ${l.area}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Directions
                  </a>
                </div>
              </div>

              <dl className="grid gap-4 self-start rounded-xl p-5" style={{ backgroundColor: "var(--surface-sunken)" }}>
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    Opening hours
                  </dt>
                  <dd className="mt-1 text-[0.875rem]">{l.hours}</dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    Address
                  </dt>
                  <dd className="mt-1 text-[0.875rem]">
                    {l.address}, {l.area}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>

      <Section sunken>
        <div className="mk-card p-6 sm:p-8">
          <h2 className="mk-h2">Roasting days</h2>
          <p className="mk-lead mt-3 max-w-2xl">
            The drum roaster runs Monday and Thursday mornings. Bags bought at the counter are
            stamped with their roast date — ask the barista for the freshest one on the shelf.
          </p>
        </div>
      </Section>
    </>
  );
}
