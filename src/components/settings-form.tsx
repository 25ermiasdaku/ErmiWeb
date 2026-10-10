"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/lib/admin-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import type { SettingDef } from "@/lib/settings";
import { FormMessage } from "./form-parts";

export type SettingRow = SettingDef & { value: string };

export function SettingsForm({ settings, canEdit }: { settings: SettingRow[]; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, EMPTY_STATE);
  const errs = state.fieldErrors ?? {};

  const sections: Array<[string, SettingRow[]]> = [];
  for (const s of settings) {
    const last = sections[sections.length - 1];
    if (last && last[0] === s.section) last[1].push(s);
    else sections.push([s.section, [s]]);
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      {sections.map(([section, list]) => (
        <section key={section} className="card p-4">
          <h2 className="text-sm font-semibold">{section}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <label key={s.key} className="block">
                <span className="mb-1 block text-[0.75rem] font-medium">
                  {s.label}
                  {s.key === "tax_rate" && (
                    <span className="ml-1.5 text-[0.6875rem] font-normal faint">%</span>
                  )}
                </span>
                <input
                  name={s.key}
                  className="field"
                  defaultValue={s.value}
                  type={s.type === "text" ? "text" : "number"}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  disabled={!canEdit}
                  required={s.type === "text" && s.key !== "cafe_tagline"}
                />
                {errs[s.key] ? (
                  <span className="mt-1 block text-[0.6875rem] text-rose-600 dark:text-rose-400">
                    {errs[s.key]}
                  </span>
                ) : (
                  <span className="mt-1 block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                    {s.description}
                  </span>
                )}
                <code className="mt-0.5 block font-mono text-[0.625rem]" style={{ color: "var(--text-faint)" }}>
                  {s.key}
                </code>
              </label>
            ))}
          </div>
        </section>
      ))}

      {canEdit ? (
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      ) : (
        <p className="text-[0.8125rem] muted">
          Read only — changing settings needs the{" "}
          <code className="font-mono text-xs">settings.manage</code> permission.
        </p>
      )}
    </form>
  );
}
