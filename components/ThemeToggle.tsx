"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@/components/icons";

export type Theme = "light" | "dark";

/** Kunci penyimpanan; dibaca juga oleh skrip anti-kedip di <head>. */
export const THEME_KEY = "generator-mikrotik/tema";

/**
 * Skrip yang dijalankan sebelum halaman digambar, supaya tema tersimpan sudah
 * terpasang di gambar pertama. Tanpa ini, halaman sempat berkedip gelap dulu
 * sebelum berubah terang.
 */
export const themeBootScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    var system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = stored === "light" || stored === "dark" ? stored : system;
  } catch (e) {}
})();
`.trim();

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Skrip di <head> sudah menetapkan tema; komponen ini menyusul membacanya
  // agar ikonnya cocok tanpa memicu ketidakcocokan hidrasi.
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Penyimpanan diblokir (mis. mode privat) — tema tetap berlaku sesi ini.
    }
  };

  const label = theme === "light" ? "Beralih ke tema gelap" : "Beralih ke tema terang";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={
        "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-line " +
        "bg-raised text-muted transition-colors hover:border-brand/50 hover:text-brand " +
        (className ?? "")
      }
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
