"use client";

import { useEffect } from "react";
import { trackMenu } from "@/lib/track-menu";

/** Dipasang di halaman sebuah menu: mencatat satu pemakaian saat halaman dibuka. */
export function MenuHit({ id }: { id: string }) {
  useEffect(() => {
    trackMenu(id);
  }, [id]);
  return null;
}