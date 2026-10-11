import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type SiteSettings } from "@/lib/site-settings";

const KEY = "site";

/** Pengaturan tampilan dari database; bawaan bila belum ada atau database bermasalah. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
    return row ? normalizeSiteSettings(row.value) : DEFAULT_SITE_SETTINGS;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

/** Jumlah pemakaian per menu: { setup: 12, cek: 3, ... }. Kosong bila database bermasalah. */
export async function getMenuUsage(): Promise<Record<string, number>> {
  try {
    const rows = await prisma.menuUsage.findMany();
    return Object.fromEntries(rows.map((r) => [r.menuId, r.count]));
  } catch {
    return {};
  }
}

export async function saveSiteSettings(raw: unknown): Promise<SiteSettings> {
  const settings = normalizeSiteSettings(raw);
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    update: { value: settings as unknown as object },
    create: { key: KEY, value: settings as unknown as object },
  });
  return settings;
}
