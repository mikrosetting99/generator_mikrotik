"use client";

import { useEffect, useState } from "react";
import { AdminSection } from "@/components/admin/AdminSection";
import { Check, UserPlus } from "@/components/icons";
import { Button, EmptyState, Field, Note, Select, TextInput } from "@/components/ui";

interface AdminUser {
  id: string;
  username: string;
  name: string | null;
  role: "ADMIN" | "USER";
  createdAt: string;
  configCount: number;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState("");

  const load = () => {
    setLoadError("");
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setUsers(data.users))
      .catch(() => setLoadError("Gagal memuat daftar pengguna."));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setCreated("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Gagal membuat akun.");
        return;
      }
      setCreated(`Akun "${username}" dibuat.`);
      // Langsung tampil di daftar tanpa menunggu muat ulang dari server.
      if (data.user) {
        setUsers((prev) => [...(prev ?? []).filter((u) => u.id !== data.user.id), data.user]);
      }
      setUsername("");
      setName("");
      setPassword("");
      setRole("USER");
      load();
    } catch {
      setFormError("Gagal menghubungi server.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <AdminSection
        title="Tambah akun"
        description="Untuk sementara hanya admin yang bisa mendaftarkan akun baru."
      >
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Username" required hint="Dipakai untuk login, tidak bisa diubah nanti.">
            <TextInput mono value={username} onChange={setUsername} placeholder="teknisi1" />
          </Field>
          <Field label="Nama (opsional)">
            <TextInput value={name} onChange={setName} placeholder="Budi Santoso" />
          </Field>
          <Field label="Password" required hint="Minimal 8 karakter.">
            <TextInput type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          </Field>
          <Field label="Peran">
            <Select
              value={role}
              placeholder=""
              onChange={setRole}
              options={[
                { value: "USER", label: "User — riwayat sendiri" },
                { value: "ADMIN", label: "Admin — bisa lihat riwayat semua akun" },
              ]}
            />
          </Field>

          {formError && (
            <div className="sm:col-span-2">
              <Note tone="bad">{formError}</Note>
            </div>
          )}
          {created && !formError && (
            <div className="sm:col-span-2">
              <Note>{created}</Note>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={creating}>
              <UserPlus className="h-4 w-4" />
              {creating ? "Membuat…" : "Buat akun"}
            </Button>
          </div>
        </form>
      </AdminSection>

      <AdminSection
        title="Daftar akun"
        description="Semua akun yang bisa masuk ke Setup Mikrotik Baru."
        badge={users && <span className="font-mono text-[11px] text-muted">{users.length} akun</span>}
      >
        {loadError ? (
          <div className="p-5">
            <Note tone="bad">{loadError}</Note>
          </div>
        ) : users === null ? (
          <p className="py-8 text-center text-xs text-faint">Memuat…</p>
        ) : users.length === 0 ? (
          <div className="p-5">
            <EmptyState>Belum ada akun.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Tampilan daftar ala Odoo: kepala abu-abu, baris bergaris, sorotan saat disentuh. */}
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-raised/60 text-[11px] uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Username</th>
                  <th className="px-5 py-2.5 font-semibold">Nama</th>
                  <th className="px-5 py-2.5 font-semibold">Peran</th>
                  <th className="px-5 py-2.5 font-semibold">Dibuat</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Konfigurasi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line-soft last:border-0 hover:bg-brand/[0.05]">
                    <td className="px-5 py-2.5 font-mono text-ink">{u.username}</td>
                    <td className="px-5 py-2.5 text-muted">{u.name || "—"}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          u.role === "ADMIN"
                            ? "bg-brand/15 text-brand"
                            : "bg-raised text-muted"
                        }`}
                      >
                        {u.role === "ADMIN" && <Check className="h-3 w-3" />}
                        {u.role === "ADMIN" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-ink">{u.configCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </div>
  );
}
