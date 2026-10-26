import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kelola Pengguna",
};

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin/users");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <AdminFrame active="pengguna">
      <AdminUsersPanel />
    </AdminFrame>
  );
}