"use client";

import { useMemo, useState } from "react";
import { saveRecipe } from "@/lib/actions";
import { duration, qty as fmtQty } from "@/lib/format";
import type { Recipe } from "@/lib/types";

export function RecipeBoard({
  recipes,
  canEdit = false,
}: {
  recipes: Recipe[];
  /** recipes.manage — shows the inline spec editor on each card. */
  canEdit?: boolean;
}) {
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<number | null>(recipes[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () => [...new Set(recipes.map((r) => r.category_name ?? ""))].filter(Boolean),
    [recipes],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (category !== "all" && r.category_name !== category) return false;
      if (q && !`${r.item_name} ${r.brew_method} ${r.grind}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipes, category, query]);

  return (
    <section className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 px-3 py-2.5">
        <input
          className="field max-w-[14rem] flex-1"
          placeholder="Search recipes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <button
            className="chip border transition-colors"
            style={category === "all" ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" } : undefined}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className="chip border transition-colors"
              style={category === c ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" } : undefined}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="num ml-auto text-[0.6875rem] faint">{visible.length} recipes</span>
      </div>

      {visible.length === 0 ? (
        <div className="card px-6 py-12 text-center text-[0.8125rem] faint">No recipes match.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              open={open === r.id}
              canEdit={canEdit}
              onToggle={() => setOpen(open === r.id ? null : r.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecipeCard({
  recipe,
  open,
  onToggle,
  canEdit,
}: {
  recipe: Recipe;
  open: boolean;
  onToggle: () => void;
  /** recipes.manage — the inline spec editor. */
  canEdit: boolean;
}) {
  const ratio =
    recipe.ratio ||
    (recipe.water_g > 0 && recipe.dose_g > 0 ? `1:${(recipe.water_g / recipe.dose_g).toFixed(1)}` : "—");

  return (
    <article className="card overflow-hidden">
      <button
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-sunken)]"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-2xl" aria-hidden>
          {recipe.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{recipe.item_name}</span>
            <span className="chip">{recipe.category_name}</span>
          </span>
          <span className="mt-0.5 block text-[0.75rem] muted">{recipe.item_description}</span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            <Spec label="Method" value={recipe.brew_method} />
            <Spec label="Ratio" value={ratio} />
            <Spec label="Grind" value={recipe.grind} />
            <Spec label="Temp" value={recipe.water_temp_c > 0 ? `${recipe.water_temp_c}°C` : "—"} />
            <Spec label="Time" value={duration(recipe.brew_time_s)} />
          </span>
        </span>
        <span className="shrink-0 text-xs faint">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          {/* Dose / water */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Dose" value={`${fmtQty(recipe.dose_g)} g`} />
            <Metric label="Water" value={`${fmtQty(recipe.water_g)} g`} />
            <Metric label="Steps" value={String(recipe.steps?.length ?? 0)} />
            <Metric label="Consumes" value={`${recipe.ingredients?.length ?? 0} items`} />
          </div>

          {recipe.notes && (
            <p
              className="rounded-lg px-3 py-2 text-[0.75rem] leading-relaxed"
              style={{ backgroundColor: "var(--brand-soft)", color: "var(--text-muted)" }}
            >
              <span className="font-semibold" style={{ color: "var(--brand)" }}>
                Note ·{" "}
              </span>
              {recipe.notes}
            </p>
          )}

          {/* Steps */}
          {recipe.steps && recipe.steps.length > 0 && (
            <div>
              <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider faint">Method</h3>
              <ol className="space-y-2">
                {recipe.steps.map((s) => (
                  <li key={s.id} className="flex gap-2.5">
                    <span
                      className="num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold"
                      style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-muted)" }}
                    >
                      {s.step_no}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium">
                        {s.title}
                        {s.seconds > 0 && (
                          <span className="num ml-1.5 text-[0.6875rem] font-normal faint">
                            {duration(s.seconds)}
                          </span>
                        )}
                      </p>
                      <p className="text-[0.75rem] leading-snug muted">{s.instruction}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <BrewTimer total={recipe.brew_time_s} label={`${recipe.item_name} target time`} />
            </div>
          )}

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider faint">
                Stock consumed per unit
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {recipe.ingredients.map((g) => {
                  const low = g.qty_on_hand !== undefined && g.qty_on_hand <= g.qty * 5;
                  return (
                    <li
                      key={g.id}
                      className="chip border"
                      title={`On hand: ${fmtQty(g.qty_on_hand ?? 0)} ${g.unit}`}
                      style={low ? { color: "rgb(217 119 6)" } : undefined}
                    >
                      {g.item_name}
                      <span className="num opacity-70">
                        {fmtQty(g.qty)} {g.unit}
                      </span>
                      {low && <span aria-hidden>⚠</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {canEdit && <SpecEditor recipe={recipe} />}
        </div>
      )}
    </article>
  );
}

function SpecEditor({ recipe }: { recipe: Recipe }) {
  const [editing, setEditing] = useState(false);

  return (
    <details className="border-t pt-3">
      <summary
        className="cursor-pointer list-none text-[0.75rem] font-medium"
        style={{ color: editing ? "var(--brand)" : "var(--text-muted)" }}
        onClick={() => setEditing((v) => !v)}
      >
        {editing ? "Close editor" : "Edit spec"}
      </summary>
      <form
        action={async (formData) => {
          await saveRecipe(recipe.id, formData);
          setEditing(false);
        }}
        className="mt-2 grid gap-2 sm:grid-cols-3"
      >
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-[0.625rem] muted">Method</span>
          <input className="field py-1 text-xs" name="brewMethod" defaultValue={recipe.brew_method} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.625rem] muted">Dose (g)</span>
          <input className="field num py-1 text-xs" name="dose" type="number" step="0.1" defaultValue={recipe.dose_g} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.625rem] muted">Water (g)</span>
          <input className="field num py-1 text-xs" name="water" type="number" step="0.1" defaultValue={recipe.water_g} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.625rem] muted">Grind</span>
          <input className="field py-1 text-xs" name="grind" defaultValue={recipe.grind} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.625rem] muted">Temp (°C)</span>
          <input className="field num py-1 text-xs" name="temp" type="number" step="1" defaultValue={recipe.water_temp_c} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.625rem] muted">Time (s)</span>
          <input className="field num py-1 text-xs" name="time" type="number" step="1" defaultValue={recipe.brew_time_s} />
        </label>
        <label className="block sm:col-span-3">
          <span className="mb-1 block text-[0.625rem] muted">Notes</span>
          <textarea className="field text-xs" name="notes" rows={2} defaultValue={recipe.notes} />
        </label>
        <button className="btn btn-primary sm:col-span-3" type="submit">
          Save spec
        </button>
      </form>
    </details>
  );
}

/** Countdown for the target brew time. Only runs while the user starts it. */
function BrewTimer({ total, label }: { total: number; label: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  // Skip timers longer than an hour (cold brew steeps overnight).
  if (total <= 0 || total > 3600) return null;

  const running = remaining !== null;
  const done = running && remaining <= 0;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <span className="num text-sm font-semibold" style={{ color: done ? "rgb(5 150 105)" : "var(--brand)" }}>
        {done
          ? "Ready"
          : running
            ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
            : duration(total)}
      </span>
      <span className="text-[0.6875rem] faint">{label}</span>
      <div className="ml-auto flex gap-1.5">
        {!running ? (
          <button
            className="btn btn-primary py-1"
            onClick={() => {
              setRemaining(total);
              tick(total);
            }}
          >
            Start timer
          </button>
        ) : (
          <button className="btn py-1" onClick={() => setRemaining(null)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );

  function tick(value: number) {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r === null) {
          clearInterval(id);
          return null;
        }
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <span className="chip border">
      <span className="faint">{label}</span>
      {value}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--surface-sunken)" }}>
      <p className="text-[0.625rem] uppercase tracking-wider faint">{label}</p>
      <p className="num text-[0.8125rem] font-semibold">{value}</p>
    </div>
  );
}
