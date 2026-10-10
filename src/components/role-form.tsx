"use client";

import { useActionState, useState } from "react";
import { createRoleAction } from "@/lib/admin-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-parts";

export function CreateRoleForm() {
  const [state, formAction, pending] = useActionState(createRoleAction, EMPTY_STATE);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
        {open ? "Cancel" : "New role"}
      </button>

      {open && (
        <form
          action={formAction}
          className="mt-3 grid max-w-2xl gap-3 rounded-xl p-4 ring-1 ring-inset sm:grid-cols-2"
          style={{ backgroundColor: "var(--surface-sunken)" }}
        >
          <div className="sm:col-span-2">
            <FormMessage state={state} />
          </div>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium">Name</span>
            <input name="name" className="field" placeholder="Shift supervisor" required />
            {state.fieldErrors?.name && (
              <span className="mt-1 block text-[0.6875rem] text-rose-600 dark:text-rose-400">
                {state.fieldErrors.name}
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium">Description</span>
            <input
              name="description"
              className="field"
              placeholder="Runs a shift but does not change settings."
            />
          </label>

          <div className="sm:col-span-2">
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "Creating…" : "Create role"}
            </button>
            <p className="mt-1.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
              New roles start with no permissions. Tick what it should be able to do on the left
              after creating it.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
