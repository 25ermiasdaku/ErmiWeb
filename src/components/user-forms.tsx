"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  eraseUserAction,
  resetUserPasswordAction,
  softDeleteUserAction,
  updateUserAction,
} from "@/lib/admin-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-parts";

type Role = { id: number; name: string; slug: string };

/** Create a new account. The password is temporary; they must change it. */
export function CreateUserForm({ roles }: { roles: Role[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, EMPTY_STATE);
  const [open, setOpen] = useState(false);
  const errs = state.fieldErrors ?? {};

  return (
    <div>
      <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
        {open ? "Cancel" : "Create user"}
      </button>

      {open && (
        <form
          action={async (formData) => {
            await formAction(formData);
            if (state.ok) setOpen(false);
          }}
          className="mt-3 grid gap-3 rounded-xl p-4 ring-1 ring-inset sm:grid-cols-2 lg:grid-cols-3"
          style={{ backgroundColor: "var(--surface-sunken)" }}
        >
          <div className="sm:col-span-2 lg:col-span-3">
            <FormMessage state={state} />
          </div>

          <TextField
            label="Full name"
            name="full_name"
            autoComplete="off"
            required
            error={errs.full_name}
          />
          <TextField
            label="Username"
            name="username"
            error={errs.username}
            hint="Lowercase, 3-32 characters. Used to sign in."
            required
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            error={errs.email}
            required
          />
          <TextField label="Job title" name="job_title" hint="Shown on the account page. Optional." />

          <label className="block">
            <span className="mb-1 block text-[0.75rem] font-medium">Role</span>
            <select name="role_id" className="field" required defaultValue="">
              <option value="" disabled>
                Choose a role…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {errs.role_id && (
              <span className="mt-1 block text-[0.6875rem] text-rose-600 dark:text-rose-400">
                {errs.role_id}
              </span>
            )}
          </label>

          <TextField
            label="Temporary password"
            name="password"
            type="text"
            error={errs.password}
            hint="At least 8 characters. They must change it at first sign-in."
            required
          />

          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Inline edit for one account. */
export function EditUserForm({
  user,
  roles,
  onDone,
}: {
  user: { id: number; full_name: string; email: string; job_title: string; role_id: number };
  roles: Role[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateUserAction, EMPTY_STATE);
  const errs = state.fieldErrors ?? {};

  return (
    <form
      action={async (formData) => {
        formData.set("user_id", String(user.id));
        await formAction(formData);
        onDone();
      }}
      className="grid gap-3 rounded-xl p-4 ring-1 ring-inset sm:grid-cols-2 lg:grid-cols-4"
      style={{ backgroundColor: "var(--surface-sunken)" }}
    >
      <div className="sm:col-span-2 lg:col-span-4">
        <FormMessage state={state} />
      </div>

      <TextField label="Full name" name="full_name" defaultValue={user.full_name} error={errs.full_name} required />
      <TextField label="Email" name="email" type="email" defaultValue={user.email} error={errs.email} required />
      <TextField label="Job title" name="job_title" defaultValue={user.job_title} />

      <label className="block">
        <span className="mb-1 block text-[0.75rem] font-medium">Role</span>
        <select name="role_id" className="field" defaultValue={String(user.role_id)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {errs.role_id && (
          <span className="mt-1 block text-[0.6875rem] text-rose-600 dark:text-rose-400">{errs.role_id}</span>
        )}
      </label>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ user, onDone }: { user: { id: number; username: string }; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, EMPTY_STATE);

  return (
    <form
      action={async (formData) => {
        formData.set("user_id", String(user.id));
        await formAction(formData);
        onDone();
      }}
      className="flex flex-wrap items-end gap-3 rounded-xl p-4 ring-1 ring-inset"
      style={{ backgroundColor: "var(--surface-sunken)" }}
    >
      <div className="w-full">
        <FormMessage state={state} />
      </div>
      <div className="min-w-[14rem] flex-1">
        <TextField
          label={`New temporary password for ${user.username}`}
          name="password"
          error={state.fieldErrors?.password}
          hint="At least 8 characters, not derived from their name. This signs them out everywhere."
          required
        />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onDone}>
        Cancel
      </button>
    </form>
  );
}

/** Archive an account. Reversible, and keeps the name on orders. */
export function SoftDeleteForm({ user, onDone }: { user: { id: number; username: string }; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(softDeleteUserAction, EMPTY_STATE);

  return (
    <form
      action={async (formData) => {
        formData.set("user_id", String(user.id));
        await formAction(formData);
        onDone();
      }}
      className="rounded-xl p-4 ring-1 ring-inset ring-amber-500/30"
      style={{ backgroundColor: "rgb(245 158 11 / 0.07)" }}
    >
      <p className="text-[0.8125rem] font-medium">Archive {user.username}?</p>
      <p className="mt-1 text-[0.75rem] muted">
        The account is switched off, its sessions are revoked, and it disappears from the staff
        list. Orders and log entries keep the name, so you can bring it back later.
      </p>
      <div className="mt-3">
        <FormMessage state={state} />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Archiving…" : "Archive account"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Irreversible. The operator has to type the exact username. */
export function EraseUserForm({ user, onDone }: { user: { id: number; username: string }; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(eraseUserAction, EMPTY_STATE);
  const [typed, setTyped] = useState("");
  const matches = typed === user.username;

  return (
    <form
      action={async (formData) => {
        formData.set("user_id", String(user.id));
        await formAction(formData);
        onDone();
      }}
      className="rounded-xl p-4 ring-1 ring-inset ring-rose-500/35"
      style={{ backgroundColor: "rgb(244 63 94 / 0.07)" }}
    >
      <p className="text-[0.8125rem] font-semibold text-rose-700 dark:text-rose-300">
        Erase {user.username} permanently
      </p>
      <p className="mt-1 text-[0.75rem] muted">
        This deletes the row. Their orders survive with no author attached, and the activity log
        keeps their username but drops the link to the account. There is no undo — archiving is
        almost always the better option.
      </p>

      <label className="mt-3 block max-w-sm">
        <span className="mb-1 block text-[0.75rem] font-medium">
          Type <code className="font-mono">{user.username}</code> to confirm
        </span>
        <input
          name="confirm_username"
          className="field font-mono"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <div className="mt-3">
        <FormMessage state={state} />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary" disabled={pending || !matches}>
          {pending ? "Erasing…" : "Erase permanently"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------

function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  hint,
  required,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.75rem] font-medium">{label}</span>
      <input
        name={name}
        type={type}
        className="field"
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
      />
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
