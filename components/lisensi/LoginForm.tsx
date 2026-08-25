"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";
import { Button, cn, controlBase } from "@/components/ui";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(signIn, undefined);
  const kolom = cn(controlBase, "h-11 sm:h-10");

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-line bg-surface p-5">
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={kolom} />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={kolom}
        />
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
