import { PrismaClient } from "@prisma/client";

/**
 * Next.js membuat ulang modul saat hot-reload di development — tanpa
 * menyimpan instance di `global`, setiap reload membuka koneksi MySQL baru
 * sampai limit koneksi server tercapai.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
