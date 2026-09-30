"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-faint transition-colors hover:bg-bad/10 hover:text-bad"
    >
      Keluar
    </button>
  );
}
