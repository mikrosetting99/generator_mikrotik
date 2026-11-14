import { execFile } from "node:child_process";
import net from "node:net";
import { RouterOsConnection, TlsVerifyError, type Row } from "@/lib/routeros-api";
import { parseUptime } from "@/lib/nm/traffic";

/**
 * Satu pemeriksaan MikroTik oleh collector, hanya perintah baca (print) lewat RouterOS API.
 * Perintah yang dipakai sama di RouterOS v6 dan v7:
 *   /system/identity/print, /system/resource/print,
 *   /interface/print (.proplist name,type,running,disabled,rx-byte,tx-byte),
 *   /ppp/active/print ?service=pppoe count-only, /ip/hotspot/active/print count-only.
 * Keterjangkauan: port API menjawab (termasuk ditolak/RST = host hidup), atau ICMP bila port diam.
 */

export interface PollTarget {
  ip: string;
  host: string;
  port: number;
  tls: boolean;
  fingerprint: string;
  username: string;
  password: string;
}

export interface PollInterface {
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  rxByte: number | null;
  txByte: number | null;
}

export interface PollResult {
  reachable: boolean;
  reachVia: "tcp" | "icmp" | null;
  apiOk: boolean;
  error: string;
  identity: string | null;
  version: string | null;
  board: string | null;
  uptimeSec: number | null;
  cpu: number | null;
  memPct: number | null;
  ppp: number | null;
  hotspot: number | null;
  /** Alasan bila sumber PPP/Hotspot tidak tersedia; null = tersedia. */
  sourceErrors: { ppp: string | null; hotspot: string | null };
  interfaces: PollInterface[];
}

export const READ_COMMANDS = ["/system/identity/print", "/system/resource/print", "/interface/print", "/ppp/active/print", "/ip/hotspot/active/print"] as const;

const numOrNull = (v: string | undefined) => {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** ICMP lewat perintah ping sistem (tanpa shell); false bila ping tidak tersedia atau gagal. */
export function icmpPing(ip: string, timeoutMs = 2000): Promise<boolean> {
  if (!net.isIP(ip)) return Promise.resolve(false);
  const win = process.platform === "win32";
  const args = win ? ["-n", "1", "-w", String(timeoutMs), ip] : ["-c", "1", "-W", String(Math.ceil(timeoutMs / 1000)), ip];
  if (net.isIPv6(ip) && !win) args.unshift("-6");
  return new Promise((resolve) => {
    execFile("ping", args, { timeout: timeoutMs + 1500, windowsHide: true }, (err, stdout) => {
      // Windows: "Destination host unreachable" tetap exit 0, jadi pastikan ada balasan TTL.
      resolve(!err && (!win || /TTL=/i.test(String(stdout))));
    });
  });
}

const empty = (): PollResult => ({
  reachable: false,
  reachVia: null,
  apiOk: false,
  error: "",
  identity: null,
  version: null,
  board: null,
  uptimeSec: null,
  cpu: null,
  memPct: null,
  ppp: null,
  hotspot: null,
  sourceErrors: { ppp: null, hotspot: null },
  interfaces: [],
});

/** Kode galat koneksi yang membuktikan host hidup (ia menjawab, walau menolak). */
const HOST_ANSWERED = new Set(["ECONNREFUSED", "ECONNRESET", "EPROTO"]);

export async function pollMikrotik(t: PollTarget, deps: { ping?: (ip: string) => Promise<boolean>; connectTimeoutMs?: number } = {}): Promise<PollResult> {
  const r = empty();
  const ping = deps.ping ?? icmpPing;
  let conn: RouterOsConnection;
  try {
    conn = await RouterOsConnection.connect(t, deps.connectTimeoutMs ?? 6000, t.tls ? { fingerprint: t.fingerprint } : undefined);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const msg = err.message || "Gagal tersambung.";
    if (e instanceof TlsVerifyError || (err.code && HOST_ANSWERED.has(err.code))) {
      r.reachable = true;
      r.reachVia = "tcp";
      r.error = msg;
      return r;
    }
    if (await ping(t.ip)) {
      r.reachable = true;
      r.reachVia = "icmp";
      r.error = `Port API ${t.port} tidak menjawab: ${msg}`;
      return r;
    }
    r.error = `Tidak terjangkau: ${msg}`;
    return r;
  }

  r.reachable = true;
  r.reachVia = "tcp";
  try {
    await conn.login(t.username, t.password);
    const quick = { timeoutMs: 8000 };
    const [identity] = await conn.talk(["/system/identity/print"], quick);
    const [res] = await conn.talk(["/system/resource/print"], quick);
    const ifaces: Row[] = await conn.talk(["/interface/print", "=.proplist=name,type,running,disabled,rx-byte,tx-byte"], { ...quick, maxRows: 300 });
    r.identity = identity?.name ?? null;
    r.version = res?.version ?? null;
    r.board = res?.["board-name"] ?? null;
    r.uptimeSec = parseUptime(res?.uptime);
    r.cpu = numOrNull(res?.["cpu-load"]);
    const total = numOrNull(res?.["total-memory"]);
    const free = numOrNull(res?.["free-memory"]);
    r.memPct = total && free !== null ? Math.round(((total - free) / total) * 1000) / 10 : null;
    r.interfaces = ifaces
      .filter((i) => i.name)
      .map((i) => ({ name: i.name, type: i.type ?? "", running: i.running === "true", disabled: i.disabled === "true", rxByte: numOrNull(i["rx-byte"]), txByte: numOrNull(i["tx-byte"]) }));

    const count = async (words: string[]): Promise<{ n: number | null; err: string | null }> => {
      try {
        const rows = await conn.talk([...words, "=count-only="], quick);
        const ret = rows.find((x) => x.ret !== undefined)?.ret;
        return ret === undefined ? { n: null, err: "Router tidak mengembalikan jumlah." } : { n: numOrNull(ret), err: null };
      } catch (e) {
        return { n: null, err: e instanceof Error ? e.message : "Perintah ditolak." };
      }
    };
    const ppp = await count(["/ppp/active/print", "?service=pppoe"]);
    r.ppp = ppp.n;
    r.sourceErrors.ppp = ppp.err && `PPPoE tidak tersedia: ${ppp.err}`;
    const hs = await count(["/ip/hotspot/active/print"]);
    r.hotspot = hs.n;
    r.sourceErrors.hotspot = hs.err && `Hotspot tidak tersedia: ${hs.err}`;
    r.apiOk = true;
  } catch (e) {
    r.apiOk = false;
    r.error = e instanceof Error ? e.message : "Gagal membaca router.";
  } finally {
    conn.close();
  }
  return r;
}
