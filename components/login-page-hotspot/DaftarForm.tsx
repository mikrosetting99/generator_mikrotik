"use client";

import { useActionState } from "react";
import Link from "next/link";
import { daftar } from "@/lib/actions/auth";
import { Button, cn, controlBase, Note } from "@/components/ui";

export function DaftarForm() {
  const [pesan, formAction, pending] = useActionState(daftar, undefined);
  const kolom = cn(controlBase, "h-11 sm:h-10");

  /* Server action membalas "TERKIRIM" bila Supabase menyalakan verifikasi
     email — sesinya belum ada dan pengguna harus membuka tautan dulu. */
  if (pesan === "TERKIRIM") {
    return (
      <Note>
        Akun dibuat. Buka email Anda dan klik tautan konfirmasinya, lalu{" "}
        <Link href="/login-page-hotspot/login" className="font-medium text-brand hover:underline">
          masuk di sini
        </Link>
        .
      </Note>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-line bg-surface p-5">
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted" htmlFor="nama">
          Nama usaha
        </label>
        <input id="nama" name="nama" type="text" autoComplete="organization" className={kolom} />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted" htmlFor="wa">
          Nomor WhatsApp
        </label>
        <input
          id="wa"
          name="wa"
          type="tel"
          inputMode="numeric"
          placeholder="0812xxxxxxxx"
          autoComplete="tel"
          className={kolom}
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={kolom}
        />
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
          minLength={8}
          autoComplete="new-password"
          className={kolom}
        />
        <span className="text-xs text-faint">Minimal 8 karakter.</span>
      </div>

      {pesan && <p className="text-sm text-bad">{pesan}</p>}

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Membuat akun…" : "Daftar"}
      </Button>

      <p className="text-center text-xs text-muted">
        Sudah punya akun?{" "}
        <Link href="/login-page-hotspot/login" className="font-medium text-brand hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}
