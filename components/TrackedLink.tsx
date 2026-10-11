"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackMenu } from "@/lib/track-menu";

/** Link kartu menu yang mencatat pemakaian saat diklik (untuk menu tambahan). */
export function TrackedLink({
  menuId,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { menuId: string }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackMenu(menuId);
        onClick?.(e);
      }}
    />
  );
}