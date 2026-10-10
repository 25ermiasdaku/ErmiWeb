"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/lib/auth-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { Field, FormMessage } from "./form-parts";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, EMPTY_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3.5">
      <Field label="Full name" name="full_name" error={errors.full_name}>
        <input id="full_name" name="full_name" className="field" autoComplete="name" autoFocus required />
      </Field>

      <Field label="Email" name="email" error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          className="field"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>

      <Field label="Phone (optional)" name="phone" error={errors.phone}>
        <input id="phone" name="phone" type="tel" className="field" autoComplete="tel" />
      </Field>

      <Field
        label="Password"
        name="password"
        error={errors.password}
        hint="At least 8 characters, and not part of your name or email."
      >
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="Confirm password" name="confirm_password" error={errors.confirm_password}>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          className="field"
          autoComplete="new-password"
          required
        />
      </Field>

      <FormMessage state={state} />

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium" style={{ color: "var(--brand)" }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
