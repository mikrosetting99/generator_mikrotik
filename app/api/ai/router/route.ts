import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { loadTarget } from "@/lib/ai-routers";
import { formatRows, monitorSnapshot, openRouter, prepareCommand, runPrepared, type RouterTarget } from "@/lib/routeros-api";
import { sshCheckInfo, sshConnect, sshFailed, sshLineError, sshPrepare, sshRun, sshSafety } from "@/lib/routeros-ssh";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_COMMANDS = 25;

interface CommandResult {
  line: string;
  ok: boolean;
  safety: string;
  output: string;
}

/** Jalankan perintah CLI lewat SSH dengan aturan persetujuan yang sama seperti API. */
async function execViaSsh(t: RouterTarget, lines: string[], confirmWrite: boolean, confirmDanger: boolean) {
  for (const line of lines) {
    const err = sshLineError(line);
    if (err) return NextResponse.json({ error: `Perintah tidak diizinkan lewat SSH: ${line} (${err})` }, { status: 400 });
  }
  const safeties = lines.map(sshSafety);
  const blocked = lines.find((_, i) => safeties[i] === "blocked");
  if (blocked) return NextResponse.json({ error: `Perintah diblokir demi keamanan: ${blocked}` }, { status: 403 });
  if (safeties.some((s) => s === "write" || s === "danger") && !confirmWrite) {
    return NextResponse.json({ error: "Perintah yang mengubah konfigurasi harus disetujui pengguna." }, { status: 400 });
  }
  if (safeties.includes("danger") && !confirmDanger) {
    return NextResponse.json({ error: "Perintah berisiko (reboot, user, service, paket) butuh persetujuan khusus." }, { status: 400 });
  }

  let client;
  try {
    client = await sshConnect(t);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal tersambung." }, { status: 502 });
  }
  const results: CommandResult[] = [];
  try {
    for (let i = 0; i < lines.length; i++) {
      try {
        const r = await sshRun(client, sshPrepare(lines[i]));
        const failed = sshFailed(r.output, r.code);
        const cap = /(^|\s|\/)export(\s|$)/.test(lines[i]) ? 40_000 : 12_000;
        let output = r.output.length > cap ? `${r.output.slice(0, cap)}\n… (dipotong)` : r.output;
        if (r.timedOut) output += `${output ? "\n" : ""}(dihentikan: melewati batas waktu)`;
        results.push({ line: lines[i], ok: !failed && !(r.timedOut && !r.output), safety: safeties[i], output: output || "OK" });
        if (failed) break;
      } catch (e) {
        results.push({ line: lines[i], ok: false, safety: safeties[i], output: e instanceof Error ? e.message : "Gagal." });
        break;
      }
    }
  } finally {
    client.end();
  }
  return NextResponse.json({ results });
}

/**
 * Sambung ke router lewat API (IP publik atau domain).
 *  - action "connect": uji login dan ambil identitas/versi.
 *  - action "exec": jalankan daftar perintah berurutan (berhenti di galat pertama). Perintah baca
 *    (print) boleh langsung; perubahan wajib confirmWrite dari pengguna.
 * Router dipilih lewat routerId (milik pengguna); password diambil dari penyimpanan terenkripsi di server.
 */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  const action = b.action === "exec" ? "exec" : b.action === "monitor" ? "monitor" : "connect";
  // Monitoring dipanggil berkala dari browser, jadi batasnya jauh lebih longgar.
  const guard = await requireAiUser(action, action === "exec" ? 120 : action === "monitor" ? 1500 : 40);
  if (isGuardResponse(guard)) return guard;

  let t: RouterTarget;
  try {
    t = (await loadTarget(guard.userId, String(b.routerId ?? ""), b.via)).target;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Alamat router tidak valid." }, { status: 400 });
  }

  const viaSsh = t.protocol === "ssh";

  if (action === "monitor") {
    if (viaSsh) return NextResponse.json({ error: "Grafik trafik hanya tersedia untuk koneksi API." }, { status: 400 });
    try {
      const conn = await openRouter(t);
      try {
        return NextResponse.json({ snapshot: await monitorSnapshot(conn) });
      } finally {
        conn.close();
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal membaca router." }, { status: 502 });
    }
  }

  if (action === "connect") {
    if (viaSsh) {
      try {
        return NextResponse.json({ info: await sshCheckInfo(t) });
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal tersambung." }, { status: 502 });
      }
    }
    try {
      const conn = await openRouter(t);
      try {
        const [identity] = await conn.talk(["/system/identity/print"]);
        const [res] = await conn.talk(["/system/resource/print"]);
        return NextResponse.json({
          info: {
            identity: identity?.name ?? "",
            version: res?.version ?? "",
            board: res?.["board-name"] ?? "",
            uptime: res?.uptime ?? "",
            cpuLoad: res?.["cpu-load"] ?? "",
          },
        });
      } finally {
        conn.close();
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal tersambung." }, { status: 502 });
    }
  }

  const lines = (Array.isArray(b.commands) ? b.commands : [])
    .map((x) => String(x).trim())
    .filter((x) => x && !x.startsWith("#"))
    .slice(0, MAX_COMMANDS);
  if (!lines.length) return NextResponse.json({ error: "Tidak ada perintah." }, { status: 400 });

  if (viaSsh) return execViaSsh(t, lines, b.confirmWrite === true, b.confirmDanger === true);

  const prepared = lines.map(prepareCommand);
  const blocked = prepared.find((p) => p.safety === "blocked");
  if (blocked) return NextResponse.json({ error: `Perintah diblokir demi keamanan: ${blocked.line}` }, { status: 403 });
  const needsConfirm = prepared.some((p) => p.safety === "write" || p.safety === "danger");
  if (needsConfirm && b.confirmWrite !== true) {
    return NextResponse.json({ error: "Perintah yang mengubah konfigurasi harus disetujui pengguna." }, { status: 400 });
  }
  if (prepared.some((p) => p.safety === "danger") && b.confirmDanger !== true) {
    return NextResponse.json({ error: "Perintah berisiko (reboot, user, service, paket) butuh persetujuan khusus." }, { status: 400 });
  }

  const results: CommandResult[] = [];
  let conn;
  try {
    conn = await openRouter(t);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal tersambung." }, { status: 502 });
  }
  try {
    for (const p of prepared) {
      try {
        const rows = await runPrepared(conn, p);
        results.push({ line: p.line, ok: true, safety: p.safety, output: p.safety === "read" || rows.length ? formatRows(rows) : "OK" });
      } catch (e) {
        results.push({ line: p.line, ok: false, safety: p.safety, output: e instanceof Error ? e.message : "Gagal." });
        break;
      }
    }
  } finally {
    conn.close();
  }
  return NextResponse.json({ results });
}