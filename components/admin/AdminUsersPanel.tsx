"use client";

import { useEffect, useState } from "react";
import { Check, User, UserPlus, Users } from "@/components/icons";
import { Button, EmptyState, Field, Note, Panel, Select, TextInput } from "@/components/ui";

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
    fetch("/api/admin/users")
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
    <div className="space-y-5">
      <Panel
        title="Tambah akun"
        description="Untuk sementara hanya admin yang bisa mendaftarkan akun baru."
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
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
      </Panel>

      <Panel
        title="Daftar akun"
        description="Semua akun yang bisa masuk ke Setup Mikrotik Baru."
        right={
          users && (
            <span className="font-mono text-[11px] text-faint">{users.length} akun</span>
          )
        }
      >
        {loadError ? (
          <Note tone="bad">{loadError}</Note>
        ) : users === null ? (
          <p className="py-6 text-center text-xs text-faint">Memuat…</p>
        ) : users.length === 0 ? (
          <EmptyState>Belum ada akun.</EmptyState>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-raised/50 p-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-faint">
                  {u.role === "ADMIN" ? (
                    <Users className="h-4 w-4 text-brand" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-ink">
                    <span className="font-mono">{u.username}</span>
                    {u.name && <span className="truncate text-faint">· {u.name}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    Dibuat {formatDate(u.createdAt)} · {u.configCount} konfigurasi tersimpan
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    u.role === "ADMIN"
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-line text-faint"
                  }`}
                >
                  {u.role === "ADMIN" ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> admin
                    </span>
                  ) : (
                    "user"
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
