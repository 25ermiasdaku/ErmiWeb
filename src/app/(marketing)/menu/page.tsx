import type { Metadata } from "next";
import Link from "next/link";
import { MenuCatalog } from "@/components/marketing/menu-catalog";
import { Section, SectionHeading } from "@/components/marketing/marketing-ui";
import { getCategories, getMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu & beans",
  description:
    "The full Ermi menu: espresso, brewed coffee, house signatures, pastries and beans to take home. Filter by roast or search by origin and tasting note.",
};

export default function PublicMenuPage() {
  const items = getMenu();
  const categories = getCategories();

  return (
    <Section>
      <SectionHeading
        eyebrow="The menu"
        title="Coffee, pastries and beans to go"
        lead="A look at what we pour and bake — origins, roasts and tasting notes. Create a free account to see the live menu with prices and order ahead."
      />

      {items.length === 0 ? (
        <div className="mk-card px-6 py-16 text-center">
          <p className="text-2xl opacity-40" aria-hidden>
            ☕
          </p>
          <p className="mt-2 text-sm font-medium">The menu is being written</p>
          <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
            Once the roastery publishes the catalogue it will appear here.
          </p>
          {categories.length > 0 && (
            <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              {categories.length} categories configured.
            </p>
          )}
        </div>
      ) : (
        <MenuCatalog items={items} />
      )}

      <div className="mk-card mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="mk-h3">Want it ready when you arrive?</h3>
          <p className="mt-1 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            Create a free account to order ahead, collect at your chosen cafe and earn points on
            every cup.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/register" className="btn btn-primary btn-lg">
            Create account
          </Link>
          <Link href={{ pathname: "/login", query: { next: "/my-orders" } }} className="btn btn-lg">
            Sign in
          </Link>
        </div>
      </div>
    </Section>
  );
}
