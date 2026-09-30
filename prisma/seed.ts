import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Membuat akun admin pertama dari SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD di
 * .env. Aman dijalankan berkali-kali — dilewati bila username sudah ada.
 * Setelah login pertama, ganti passwordnya lewat panel admin.
 */
async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    console.log("SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD tidak diisi di .env — lewati seed.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Akun "${username}" sudah ada — lewati.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { username, passwordHash, role: "ADMIN" },
  });
  console.log(`Akun admin "${username}" dibuat.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
