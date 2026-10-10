import type { ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

/** Green/red banner for the result of a server action. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`rounded-lg px-3 py-2 text-[0.8125rem] font-medium ring-1 ring-inset ${
        state.ok
          ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300"
          : "bg-rose-500/10 text-rose-800 ring-rose-500/25 dark:text-rose-300"
      }`}
      role="status"
    >
      {state.message}
    </p>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <label className="block" htmlFor={name}>
      <span className="mb-1 block text-[0.75rem] font-medium">{label}</span>
      {children ?? <input id={name} name={name} className="field" />}
      {error ? (
        <span className="mt-1 block text-[0.6875rem] text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/**
 * A permission matrix cell. Kept as a controlled checkbox in a plain form so
 * it works without JavaScript state juggling across ~25 checkboxes.
 */
export function PermissionCheckbox({
  name,
  label,
  description,
  defaultChecked,
  disabled,
  locked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
  /** Rendered as "always on" and not editable. */
  locked?: boolean;
}) {
  return (
    <label
      className={`flex gap-2.5 rounded-lg p-2.5 transition-colors ${
        disabled ? "opacity-60" : "hover:bg-[var(--surface-sunken)]"
      }`}
      style={{ cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={defaultChecked || locked}
        disabled={disabled || locked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-medium">
          {label}
          {locked && (
            <span
              className="chip ml-1.5 ring-1 ring-inset"
              style={{ color: "var(--brand)", backgroundColor: "var(--brand-soft)", borderColor: "transparent" }}
            >
              always
            </span>
          )}
        </span>
        <span className="block text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
          {description}
        </span>
      </span>
    </label>
  );
}
