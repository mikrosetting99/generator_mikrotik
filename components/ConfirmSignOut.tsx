"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { fullSignOut } from "@/lib/sign-out";

/** Popup konfirmasi sebelum keluar dari akun. */
export function ConfirmSignOutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Keluar dari akun?"
      description="Anda perlu login lagi untuk membuka menu yang memerlukan akun. Isian yang belum disimpan tidak ikut tersimpan."
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void fullSignOut();
          }}
        >
          {busy ? "Keluar…" : "Ya, keluar"}
        </Button>
      </div>
    </Modal>
  );
}