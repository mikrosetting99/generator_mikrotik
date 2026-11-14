/**
 * Collector Network Monitoring: proses terpisah dari web (PM2 app "generator-mikrotik-nm").
 * Memeriksa perangkat MikroTik yang jatuh tempo, menyimpan sampel, dan menjalankan aturan Analisa.
 * Dashboard hanya membaca hasil yang tersimpan.
 *
 *   npx tsx scripts/nm-collector.mts          # jalan terus
 *   npx tsx scripts/nm-collector.mts --once   # satu putaran lalu keluar (uji)
 *
 * Env (opsional):
 *   NM_COLLECTOR_ID      nama collector (bawaan: hostname)
 *   NM_CONCURRENCY       perangkat diperiksa bersamaan (bawaan 8)
 *   NM_TICK_SECONDS      jeda antar putaran (bawaan 10; tiap perangkat tetap mengikuti intervalnya)
 *   NM_RETENTION_DAYS    umur sampel (bawaan 7) — temuan pulih disimpan 90 hari
 *   NM_ALLOWED_PORTS     batasi port yang boleh dihubungi (bawaan kosong = semua port)
 *   NM_ALLOWED_NETWORKS  subnet privat yang boleh dihubungi, mis. tunnel VPN "10.88.0.0/16"
 */
import os from "node:os";
import { muatEnvLokal } from "./_env.mts";

muatEnvLokal();

const { runCycle } = await import("../lib/nm/collector");
const { prismaStore } = await import("../lib/nm/store-prisma");
const { productionPoll } = await import("../lib/nm/run");
const { APP_VERSION } = await import("../lib/changelog");
const { prisma } = await import("../lib/prisma");

const once = process.argv.includes("--once");
const collectorId = (process.env.NM_COLLECTOR_ID || os.hostname()).slice(0, 64);
const concurrency = Math.max(1, Math.min(64, Number(process.env.NM_CONCURRENCY) || 8));
const tickMs = Math.max(5, Number(process.env.NM_TICK_SECONDS) || 10) * 1000;
const retentionDays = Math.max(1, Number(process.env.NM_RETENTION_DAYS) || 7);
const startedAt = Date.now();

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);
let stopping = false;
let lastPrune = 0;

async function tick() {
  const r = await runCycle(
    { store: prismaStore, now: Date.now, poll: productionPoll, log },
    { collectorId, startedAt, concurrency, version: APP_VERSION },
  );
  if (r.polled || r.skipped) log(`putaran: ${r.polled} diperiksa, ${r.skipped} diambil worker lain, ${r.ms} ms`);
  if (Date.now() - lastPrune > 3600_000) {
    lastPrune = Date.now();
    await prismaStore.prune(Date.now() - retentionDays * 86400_000, Date.now() - 90 * 86400_000);
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log(`${sig}: berhenti setelah putaran ini`);
    stopping = true;
  });
}

log(`collector ${collectorId} mulai (paralel ${concurrency}, putaran tiap ${tickMs / 1000} detik)`);
do {
  const t0 = Date.now();
  try {
    await tick();
  } catch (e) {
    // Database sementara tidak bisa dihubungi: coba lagi di putaran berikutnya.
    log(`galat putaran: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (once || stopping) break;
  await new Promise((r) => setTimeout(r, Math.max(1000, tickMs - (Date.now() - t0))));
} while (!stopping);

await prisma.$disconnect();
log("collector berhenti");
