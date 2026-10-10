import { PageHeader } from "@/components/ui";
import { SettingsForm, type SettingRow } from "@/components/settings-form";
import { gate } from "@/lib/auth";
import { getAllSettings, SETTING_DEFS } from "@/lib/settings";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { user, denied } = await gate("settings.view");
  if (denied) return denied;

  const current = getAllSettings();

  // Merge the stored values onto the definitions, so a newly added setting
  // shows up here with its fallback even before anyone saves.
  const settings: SettingRow[] = SETTING_DEFS.map((def) => ({
    ...def,
    value: current[def.key] ?? def.fallback,
  }));

  // What the current tax rate means for a $5.00 drink, to make it concrete.
  const taxRate = Number(current.tax_rate) / 100;
  const pointsPerDollar = Number(current.points_per_dollar);
  const example = Math.round(500 * taxRate);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="The small set of knobs the cafe runs on. The till reads these live, so a change applies to the next order."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Tax on a $5.00 drink
          </p>
          <p className="num mt-1.5 text-2xl font-semibold tracking-tight">{money(example)}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
            at {current.tax_rate}%
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Loyalty on a $5.00 drink
          </p>
          <p className="num mt-1.5 text-2xl font-semibold tracking-tight">
            {pointsPerDollar === 0
              ? "—"
              : Math.round(5 * pointsPerDollar).toLocaleString()}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
            {pointsPerDollar} point{pointsPerDollar === 1 ? "" : "s"} per dollar
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Next order number
          </p>
          <p className="num mt-1.5 text-2xl font-semibold tracking-tight">
            {current.order_prefix}-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
            prefix + date + running count
          </p>
        </div>
      </div>

      <SettingsForm settings={settings} canEdit={user!.permissions.has("settings.manage")} />

      <section className="card mt-4 p-4">
        <h2 className="text-sm font-semibold">Deliberately not configurable</h2>
        <ul className="mt-2 space-y-1.5 text-[0.8125rem] muted">
          <li>
            <strong className="font-medium">Currency</strong> is fixed to USD. Every{" "}
            <code className="font-mono text-xs">money()</code> call formats it, so making it
            dynamic would mean threading a currency through the whole app for one cafe.
          </li>
          <li>
            <strong className="font-medium">Roles and permissions</strong> live under{" "}
            <a href="/admin/roles" className="underline">Roles &amp; permissions</a>, not here — they
            are part of the access model rather than a cafe setting.
          </li>
          <li>
            <strong className="font-medium">Stock levels and menu prices</strong> are edited where
            they belong, on the <a href="/inventory">Inventory</a> and <a href="/menu">Menu</a>{" "}
            pages.
          </li>
        </ul>
        <p className="mt-3 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          Every save through this form is recorded in the activity log.
        </p>
      </section>
    </>
  );
}
