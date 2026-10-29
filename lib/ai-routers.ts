import { prisma } from "@/lib/prisma";
import { resolvePublicHost } from "@/lib/net-guard";
import { openRouter, type RouterTarget } from "@/lib/routeros-api";
import { open, seal } from "@/lib/vault";

export const MAX_AI_ROUTERS = 20;

/** Bentuk yang dikirim ke browser: tanpa password. */
export interface RouterPublic {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  username: string;
}

export interface RouterInput {
  name: string;
  host: string;
  port: number;
  tls: boolean;
  username: string;
  /** Kosong saat mengubah = pertahankan password lama. */
  password: string;
}

const HOST_OK = /^[A-Za-z0-9]([A-Za-z0-9.:-]*[A-Za-z0-9])?$/;

export function parseRouterInput(body: unknown): { ok: true; data: RouterInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const host = String(b.host ?? "").trim().slice(0, 253);
  const username = String(b.username ?? "").trim().slice(0, 100);
  const port = Math.round(Number(b.port)) || 8728;
  if (!host || !HOST_OK.test(host)) return { ok: false, error: "Alamat router (IP publik atau domain) tidak valid." };
  if (!username) return { ok: false, error: "Username router belum diisi." };
  if (port < 1 || port > 65535) return { ok: false, error: "Port API harus 1–65535." };
  return {
    ok: true,
    data: {
      name: String(b.name ?? "").trim().slice(0, 80) || host,
      host,
      port,
      tls: Boolean(b.tls),
      username,
      password: String(b.password ?? "").slice(0, 200),
    },
  };
}

export const toPublic = (r: { id: string; name: string; host: string; port: number; tls: boolean; username: string }): RouterPublic => ({
  id: r.id,
  name: r.name,
  host: r.host,
  port: r.port,
  tls: r.tls,
  username: r.username,
});

export const sealPassword = seal;

/** Router milik pengguna ini sebagai target koneksi (DNS diselesaikan dan dicek publik). */
export async function loadTarget(userId: string, id: string): Promise<{ profile: RouterPublic; target: RouterTarget }> {
  const row = await prisma.aiRouter.findFirst({ where: { id, userId } });
  if (!row) throw new Error("Router tidak ditemukan.");
  const ip = await resolvePublicHost(row.host);
  return { profile: toPublic(row), target: { ip, host: row.host, port: row.port, tls: row.tls, username: row.username, password: open(row.passwordEnc) } };
}

export type RouterState = "online" | "offline" | "auth" | "timeout" | "blocked";

export interface RouterStatus {
  id: string;
  state: RouterState;
  message: string;
  latencyMs: number;
  checkedAt: number;
  info?: { identity: string; version: string; board: string; uptime: string; cpuLoad: string };
}

/** Memeriksa satu router: tersambung, salah login, tidak terjangkau, atau waktu habis. */
export async function checkTarget(id: string, target: RouterTarget): Promise<RouterStatus> {
  const started = Date.now();
  const base = { id, checkedAt: started, latencyMs: 0 };
  try {
    const conn = await openRouter(target);
    try {
      const latencyMs = Date.now() - started;
      const [identity] = await conn.talk(["/system/identity/print"], { timeoutMs: 6000 });
      const [res] = await conn.talk(["/system/resource/print"], { timeoutMs: 6000 });
      return {
        ...base,
        state: "online",
        message: "Tersambung",
        latencyMs,
        info: {
          identity: identity?.name ?? "",
          version: res?.version ?? "",
          board: res?.["board-name"] ?? "",
          uptime: res?.uptime ?? "",
          cpuLoad: res?.["cpu-load"] ?? "",
        },
      };
    } finally {
      conn.close();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal tersambung.";
    const state: RouterState = /username atau password salah/i.test(message) ? "auth" : /waktu habis/i.test(message) ? "timeout" : "offline";
    return { ...base, state, message, latencyMs: Date.now() - started };
  }
}

/** Menjalankan pemeriksaan beberapa router sekaligus dengan jumlah paralel terbatas. */
export async function checkMany(items: Array<{ id: string; load: () => Promise<RouterTarget> }>, concurrency = 5): Promise<RouterStatus[]> {
  const out: RouterStatus[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      const it = items[i];
      try {
        out[i] = await checkTarget(it.id, await it.load());
      } catch (e) {
        out[i] = { id: it.id, state: "blocked", message: e instanceof Error ? e.message : "Alamat tidak boleh dituju.", latencyMs: 0, checkedAt: Date.now() };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}