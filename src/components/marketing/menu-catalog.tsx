"use client";

import { useMemo, useState } from "react";
import { ALL_ROASTS, coffeeMeta, type Roast } from "@/lib/marketing";
import type { MenuItem } from "@/lib/types";

type Sort = "featured" | "name";

/**
 * The public catalogue. Everything it needs arrives as a prop, so the page does
 * the database read and this stays a pure, testable filter over the list.
 */
export function MenuCatalog({ items }: { items: MenuItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [roast, setRoast] = useState<"all" | Roast>("all");
  const [sort, setSort] = useState<Sort>("featured");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) {
      const slug = i.category_slug ?? "other";
      if (!seen.has(slug)) seen.set(slug, i.category_name ?? slug);
    }
    return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
  }, [items]);

  const roastsPresent = useMemo(() => {
    const set = new Set(items.map((i) => coffeeMeta(i).roast));
    return ALL_ROASTS.filter((r) => set.has(r));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((i) => {
      if (category !== "all" && (i.category_slug ?? "other") !== category) return false;
      const meta = coffeeMeta(i);
      if (roast !== "all" && meta.roast !== roast) return false;
      if (!q) return true;
      return [i.name, i.description, meta.origin, meta.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    switch (sort) {
      case "name":
        return out.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return out.sort((a, b) => b.is_signature - a.is_signature || a.name.localeCompare(b.name));
    }
  }, [items, query, category, roast, sort]);

  return (
    <div>
      {/* Controls */}
      <div className="mk-card mb-6 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search the menu</span>
            <input
              className="mk-field pl-9"
              placeholder="Search coffee, origins, tasting notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50">
              ⌕
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
              Roast
              <select
                className="mk-field w-auto"
                value={roast}
                onChange={(e) => setRoast(e.target.value as "all" | Roast)}
              >
                <option value="all">All roasts</option>
                {roastsPresent.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
              Sort
              <select
                className="mk-field w-auto"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="featured">Featured</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            Everything
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </FilterChip>
          ))}
        </div>
      </div>

      <p className="mb-4 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
        {filtered.length} {filtered.length === 1 ? "item" : "items"}
        {category !== "all" && ` in ${categories.find((c) => c.slug === category)?.name ?? ""}`}
      </p>

      {filtered.length === 0 ? (
        <div className="mk-card px-6 py-16 text-center">
          <p className="text-2xl opacity-40" aria-hidden>
            ☕
          </p>
          <p className="mt-2 text-sm font-medium">Nothing matches that yet</p>
          <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
            Try a different roast or clear the search.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const meta = coffeeMeta(item);
            const groups = [...new Set(item.options.map((o) => o.group_name))];
            return (
              <article key={item.id} className="mk-card mk-card-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden className="text-3xl">
                    {item.icon}
                  </span>
                  {item.is_signature === 1 && (
                    <span
                      className="chip ring-1 ring-inset"
                      style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                    >
                      Signature
                    </span>
                  )}
                </div>

                <h3 className="mk-h3 mt-3">{item.name}</h3>
                <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                  {item.description}
                </p>

                <dl className="mt-4 space-y-1 text-[0.75rem]">
                  <div className="flex gap-2">
                    <dt style={{ color: "var(--text-faint)" }}>Origin</dt>
                    <dd style={{ color: "var(--text-muted)" }}>{meta.origin}</dd>
                  </div>
                  {meta.roast !== "-" && (
                    <div className="flex gap-2">
                      <dt style={{ color: "var(--text-faint)" }}>Roast</dt>
                      <dd style={{ color: "var(--text-muted)" }}>{meta.roast}</dd>
                    </div>
                  )}
                  {meta.notes && (
                    <div className="flex gap-2">
                      <dt style={{ color: "var(--text-faint)" }}>Notes</dt>
                      <dd style={{ color: "var(--text-muted)" }}>{meta.notes}</dd>
                    </div>
                  )}
                </dl>

                {groups.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {groups.map((g) => (
                      <span
                        key={g}
                        className="chip"
                        style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-muted)" }}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p
                  className="mt-auto border-t pt-4 text-[0.75rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  Made to order — sign in to order ahead.
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors"
      style={
        active
          ? { backgroundColor: "var(--color-espresso-500)", borderColor: "var(--color-espresso-500)", color: "var(--color-cream-50)" }
          : { backgroundColor: "transparent", borderColor: "var(--line)", color: "var(--text-muted)" }
      }
    >
      {children}
    </button>
  );
}
