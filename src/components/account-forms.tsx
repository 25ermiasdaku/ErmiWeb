"use client";

import { useActionState } from "react";
import { changeOwnPassword, updateOwnProfile } from "@/lib/auth-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-parts";

export function ProfileForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(updateOwnProfile, EMPTY_STATE);
  const errs = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <label className="block" htmlFor="p_full_name">
        <span className="mb-1 block text-[0.75rem] font-medium">Full name</span>
        <input
          id="p_full_name"
          name="full_name"
          className="field"
          defaultValue={fullName}
          autoComplete="name"
          required
        />
        {errs.full_name && <p className="mt-1 text-[0.6875rem] text-rose-600 dark:text-rose-400">{errs.full_name}</p>}
      </label>

      <label className="block" htmlFor="p_email">
        <span className="mb-1 block text-[0.75rem] font-medium">Email</span>
        <input
          id="p_email"
          name="email"
          type="email"
          className="field"
          defaultValue={email}
          autoComplete="email"
          required
        />
        {errs.email && <p className="mt-1 text-[0.6875rem] text-rose-600 dark:text-rose-400">{errs.email}</p>}
      </label>

      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, EMPTY_STATE);
  const errs = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />

      <label className="block" htmlFor="current_password">
        <span className="mb-1 block text-[0.75rem] font-medium">Current password</span>
        <input
          id="current_password"
          name="current_password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
        {errs.current_password && (
          <p className="mt-1 text-[0.6875rem] text-rose-600 dark:text-rose-400">{errs.current_password}</p>
        )}
      </label>

      <label className="block" htmlFor="new_password">
        <span className="mb-1 block text-[0.75rem] font-medium">New password</span>
        <input
          id="new_password"
          name="new_password"
          type="password"
          className="field"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {errs.new_password ? (
          <p className="mt-1 text-[0.6875rem] text-rose-600 dark:text-rose-400">{errs.new_password}</p>
        ) : (
          <p className="mt-1 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
            At least 8 characters, and nothing from your name or username.
          </p>
        )}
      </label>

      <label className="block" htmlFor="confirm_password">
        <span className="mb-1 block text-[0.75rem] font-medium">Confirm new password</span>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          className="field"
          autoComplete="new-password"
          required
        />
        {errs.confirm_password && (
          <p className="mt-1 text-[0.6875rem] text-rose-600 dark:text-rose-400">{errs.confirm_password}</p>
        )}
      </label>

      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
