import net from "node:net";
import { prisma } from "@/lib/prisma";
import { resolvePublicHost } from "@/lib/net-guard";
import { openRouter, type RouterTarget } from "@/lib/routeros-api";
import { sshConnect, sshInfo, sshCheckInfo } from "@/lib/routeros-ssh";
import { open, seal } from "@/lib/vault";

export const MAX_AI_ROUTERS = 20;

/** Bentuk yang dikirim ke browser: tanpa password. */
export interface RouterPublic {
  id: string;
  name: string;
  host: string;
  /** Port API; 0 = API tidak dipakai. */
  port: number;
  /** Port SSH; 0 = SSH tidak dipakai. */
  sshPort: number;
  tls: boolean;
  username: string;
  /** Jalur bawaan bila API dan SSH sama-sama aktif. */
  protocol: "api" | "ssh";
}

export interface RouterInput {
  name: string;
  host: string;
  protocol: "api" | "ssh";
  port: number;
  sshPort: number;
  tls: boolean;
  username: string;
  /** Kosong saat mengubah = pertahankan password lama. */
  password: string;
}

export type Via = "api" | "ssh";

const HOST_OK = /^[A-Za-z0-9]([A-Za-z0-9.:-]*[A-Za-z0-9])?$/;

export function parseRouterInput(body: unknown): { ok: true; data: RouterInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const host = String(b.host ?? "").trim().slice(0, 253);
  const username = String(b.username ?? "").trim().slice(0, 100);
  // 0 = jalur itu tidak dipakai; port API yang tidak dikirim berarti 8728 (isian lama).
  const port = b.port === undefined ? 8728 : Math.round(Number(b.port)) || 0;
  const sshPort = Math.round(Number(b.sshPort)) || 0;
  if (!host || !HOST_OK.test(host)) return { ok: false, error: "Alamat router (IP publik atau domain) tidak valid." };
  if (!username) return { ok: false, error: "Username router belum diisi." };
  if (port < 0 || port > 65535 || sshPort < 0 || sshPort > 65535) return { ok: false, error: "Port harus 1–65535." };
  if (port === 0 && sshPort === 0) return { ok: false, error: "Aktifkan minimal satu jalur: API atau SSH." };
  const wanted: Via = b.protocol === "ssh" ? "ssh" : "api";
  const protocol: Via = wanted === "ssh" ? (sshPort > 0 ? "ssh" : "api") : port > 0 ? "api" : "ssh";
  return {
    ok: true,
    data: {
      name: String(b.name ?? "").trim().slice(0, 80) || host,
      host,
      protocol,
      port,
      sshPort,
      tls: port > 0 && Boolean(b.tls),
      username,
      password: String(b.password ?? "").slice(0, 200),
    },
  };
}

type RouterRow = { id: string; name: string; host: string; port: number; sshPort: number; tls: boolean; username: string; protocol: string };

export const toPublic = (r: RouterRow): RouterPublic => ({
  id: r.id,
  name: r.name,
  host: r.host,
  port: r.port,
  sshPort: r.sshPort,
  tls: r.tls,
  username: r.username,
  protocol: r.protocol === "ssh" ? "ssh" : "api",
});

export const sealPassword = seal;

/**
 * Jalur yang dipakai untuk satu permintaan. Bila `requested` diisi (pilihan pengguna) dan jalur itu
 * tidak aktif di router ini, galat; bila kosong, jalur bawaan router (atau satu-satunya yang aktif).
 */
export function resolveVia(row: Pick<RouterRow, "port" | "sshPort" | "protocol">, requested?: unknown): Via {
  if (requested === "api" || requested === "ssh") {
    const ok = requested === "api" ? row.port > 0 : row.sshPort > 0;
    if (!ok) throw new Error(`Koneksi ${requested === "api" ? "API" : "SSH"} tidak diaktifkan untuk Mikrotik ini.`);
    return requested;
  }
  if (row.protocol === "ssh" && row.sshPort > 0) return "ssh";
  if (row.port > 0) return "api";
  return "ssh";
}

/** Router milik pengguna ini sebagai target koneksi (DNS diselesaikan dan dicek publik). */
export async function loadTarget(userId: string, id: string, via?: unknown): Promise<{ profile: RouterPublic; target: RouterTarget; via: Via }> {
  const row = await prisma.aiRouter.findFirst({ where: { id, userId } });
  if (!row) throw new Error("Router tidak ditemukan.");
  const use = resolveVia(row, via);
  const ip = await resolvePublicHost(row.host);
  return {
    profile: toPublic(row),
    via: use,
    target: { ip, host: row.host, port: use === "ssh" ? row.sshPort : row.port, tls: use === "api" && row.tls, username: row.username, password: open(row.passwordEnc), protocol: use },
  };
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
    if (target.protocol === "ssh") {
      const info = await sshCheckInfo(target);
      return { ...base, state: "online", message: "Tersambung", latencyMs: Date.now() - started, info };
    }
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
  port: "Port terbuka (TCP)",
  login: "Login (username & password)",
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

/** Test koneksi SSH: alamat, port, login, lalu baca data. */
async function diagnoseSsh(input: { host: string; port: number; username: string; password: string }): Promise<DiagResult> {
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
      `Aktifkan service ssh di /ip service dan pastikan port ${input.port} benar. Izinkan IP server aplikasi ini di kolom address service itu, dan buka port di firewall (chain=input) atau port-forward bila router di belakang NAT.`,
    );
  }

  t0 = Date.now();
  let client: Awaited<ReturnType<typeof sshConnect>>;
  try {
    client = await sshConnect({ ip, host: input.host, port: input.port, tls: false, username: input.username, password: input.password, protocol: "ssh" });
    add("login", true, Date.now() - t0, `Login SSH sebagai ${input.username}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login gagal.";
    add("login", false, Date.now() - t0, message);
    skipRest(["read"]);
    return result(
      /username atau password salah/i.test(message)
        ? "Periksa username dan password. Pastikan user itu ada di /user, grup-nya punya policy ssh, dan address-nya tidak menolak IP server ini."
        : "SSH tersambung tetapi sesi gagal dibuka. Pastikan service ssh aktif dan RouterOS tidak terlalu lama.",
    );
  }

  t0 = Date.now();
  try {
    const info = await sshInfo(client);
    add("read", true, Date.now() - t0, `${info.identity} · RouterOS ${info.version} · ${info.board} · up ${info.uptime}`);
    return result(undefined, info);
  } catch (e) {
    add("read", false, Date.now() - t0, e instanceof Error ? e.message : "Gagal membaca data.");
    return result("User router mungkin tidak punya hak read atau ssh. Pakai grup yang memiliki policy ssh, read, dan test.");
  } finally {
    client.end();
  }
}

/** Menguji koneksi API langkah demi langkah supaya terlihat di mana yang bermasalah. */
export async function diagnoseRouter(input: { host: string; port: number; tls: boolean; username: string; password: string; protocol?: "api" | "ssh" }): Promise<DiagResult> {
  if (input.protocol === "ssh") return diagnoseSsh(input);
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