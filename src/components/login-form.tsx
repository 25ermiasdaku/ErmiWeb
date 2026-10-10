"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/auth-actions";
import { EMPTY_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-parts";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, EMPTY_STATE);

  return (
    <form action={formAction} className="space-y-3.5">
      {next && <input type="hidden" name="next" value={next} />}

      <label className="block" htmlFor="username">
        <span className="mb-1 block text-[0.75rem] font-medium">Username</span>
        <input
          id="username"
          name="username"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          spellCheck={false}
          required
        />
      </label>

      <label className="block" htmlFor="password">
        <span className="mb-1 block text-[0.75rem] font-medium">Password</span>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
      </label>

      <FormMessage state={state} />

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
