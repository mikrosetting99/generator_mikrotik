"use client";

import { useState } from "react";
import { ConfirmSignOutModal } from "@/components/ConfirmSignOut";

export function SignOutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-faint transition-colors hover:bg-bad/10 hover:text-bad"
      >
        Keluar
      </button>
      <ConfirmSignOutModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}