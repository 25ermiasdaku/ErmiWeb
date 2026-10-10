import { Card, PageHeader, Stat } from "@/components/ui";
import { RecipeBoard } from "@/components/recipe-board";
import { gate } from "@/lib/auth";
import { duration, pluralize } from "@/lib/format";
import { getItemsMissingRecipes, getRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const { user, denied } = await gate("recipes.view");
  if (denied) return denied;
  const recipes = getRecipes();
  const missing = getItemsMissingRecipes();

  const methods = [...new Set(recipes.map((r) => r.brew_method))];
  const avgTime = recipes.length
    ? Math.round(recipes.reduce((s, r) => s + r.brew_time_s, 0) / recipes.length)
    : 0;
  const consumables = recipes.reduce((s, r) => s + (r.ingredients?.length ?? 0), 0);
  const starWars = recipes.filter((r) => r.icon === "☕").length;

  return (
    <>
      <PageHeader
        title="Recipes"
        subtitle="The barista spec for every drink, and the stock each one consumes when it is sold."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recipes on file" value={recipes.length} hint={pluralize(methods.length, "brew method")} />
        <Stat label="Drink specs" value={starWars} hint="Espresso based" />
        <Stat label="Stock links" value={consumables} hint="Recipe → ingredient edges" />
        <Stat
          label="Average brew time"
          value={duration(avgTime)}
          hint="Across all methods"
        />
      </div>

      <RecipeBoard recipes={recipes} canEdit={user!.permissions.has("recipes.manage")} />

      {missing.length > 0 && (
        <Card
          className="mt-4"
          title="No recipe yet"
          subtitle="These menu items sell but have no spec, so they deduct nothing from stock"
        >
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <li key={m.id} className="chip border">
                <span aria-hidden>{m.icon}</span> {m.name}
                <span className="faint">· {m.category_name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
