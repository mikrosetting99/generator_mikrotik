import net from "node:net";
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
/* ------------------------------------------------------------ test koneksi API */

export interface DiagStep {
  id: "address" | "port" | "login" | "read";
  label: string;
  ok: boolean;
  /** Langkah dilewati karena langkah sebelumnya gagal. */
  skipped?: boolean;
  ms: number;
  detail: string;
}

export interface DiagResult {
  ok: boolean;
  steps: DiagStep[];
  info?: NonNullable<RouterStatus["info"]>;
  /** Saran perbaikan untuk langkah yang gagal. */
  hint?: string;
}

const STEP_LABEL: Record<DiagStep["id"], string> = {
  address: "Alamat router (DNS & IP publik)",
  port: "Port API terbuka (TCP)",
  login: "Login API (username & password)",
  read: "Baca data router",
};

function tcpProbe(ip: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: ip, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("waktu habis"));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve();
    });
    socket.once("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(e.code === "ECONNREFUSED" ? "ditolak (port tertutup)" : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH" ? "host tidak terjangkau" : (e.message || "gagal")));
    });
  });
}

/** Menguji koneksi API langkah demi langkah supaya terlihat di mana yang bermasalah. */
export async function diagnoseRouter(input: { host: string; port: number; tls: boolean; username: string; password: string }): Promise<DiagResult> {
  const steps: DiagStep[] = [];
  const add = (id: DiagStep["id"], ok: boolean, ms: number, detail: string, skipped = false) => steps.push({ id, label: STEP_LABEL[id], ok, ms, detail, skipped });
  const skipRest = (from: DiagStep["id"][]) => from.forEach((id) => add(id, false, 0, "Dilewati", true));
  const result = (hint?: string, info?: DiagResult["info"]): DiagResult => ({ ok: steps.every((s) => s.ok), steps, hint, info });

  let t0 = Date.now();
  let ip = "";
  try {
    ip = await resolvePublicHost(input.host);
    add("address", true, Date.now() - t0, ip === input.host ? ip : `${input.host} → ${ip}`);
  } catch (e) {
    add("address", false, Date.now() - t0, e instanceof Error ? e.message : "Alamat tidak valid.");
    skipRest(["port", "login", "read"]);
    return result("Pakai IP publik atau domain yang bisa di-resolve. IP lokal (192.168.x.x, 10.x.x.x) tidak bisa dijangkau dari server ini.");
  }

  t0 = Date.now();
  try {
    await tcpProbe(ip, input.port, 5000);
    add("port", true, Date.now() - t0, `${ip}:${input.port} menerima koneksi`);
  } catch (e) {
    add("port", false, Date.now() - t0, `${ip}:${input.port} ${e instanceof Error ? e.message : "gagal"}`);
    skipRest(["login", "read"]);
    return result(
      `Aktifkan service ${input.tls ? "api-ssl" : "api"} di /ip service dan pastikan port ${input.port} benar. Izinkan IP server aplikasi ini di kolom address service itu, dan buka port di firewall (chain=input) atau port-forward bila router di belakang NAT.`,
    );
  }

  t0 = Date.now();
  let conn: Awaited<ReturnType<typeof openRouter>>;
  try {
    conn = await openRouter({ ip, host: input.host, port: input.port, tls: input.tls, username: input.username, password: input.password });
    add("login", true, Date.now() - t0, `Login sebagai ${input.username}${input.tls ? " (TLS)" : ""}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login gagal.";
    add("login", false, Date.now() - t0, message);
    skipRest(["read"]);
    return result(
      /username atau password salah/i.test(message)
        ? "Periksa username dan password. Pastikan user itu ada di /user dan tidak dibatasi address yang menolak IP server ini."
        : input.tls
          ? "Koneksi TLS gagal. Pastikan api-ssl aktif dengan sertifikat, atau matikan opsi TLS dan pakai port 8728."
          : "Router menutup koneksi. Jika memakai port api-ssl (8729), centang opsi TLS.",
    );
  }

  t0 = Date.now();
  try {
    const [identity] = await conn.talk(["/system/identity/print"], { timeoutMs: 6000 });
    const [res] = await conn.talk(["/system/resource/print"], { timeoutMs: 6000 });
    const info = {
      identity: identity?.name ?? "",
      version: res?.version ?? "",
      board: res?.["board-name"] ?? "",
      uptime: res?.uptime ?? "",
      cpuLoad: res?.["cpu-load"] ?? "",
    };
    add("read", true, Date.now() - t0, `${info.identity} · RouterOS ${info.version} · ${info.board} · up ${info.uptime}`);
    return result(undefined, info);
  } catch (e) {
    add("read", false, Date.now() - t0, e instanceof Error ? e.message : "Gagal membaca data.");
    return result("User router mungkin tidak punya hak read/api. Pakai group yang memiliki policy api dan read.");
  } finally {
    conn.close();
  }
}