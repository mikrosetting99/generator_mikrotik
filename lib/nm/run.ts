import { resolveAllowedTarget } from "@/lib/nm/allow";
import type { CollectorDevice } from "@/lib/nm/collector";
import { pollMikrotik, type PollResult } from "@/lib/nm/poller";
import { open } from "@/lib/vault";

/**
 * Poll produksi: kredensial dibuka di sini saja (di dalam proses collector) dan tidak pernah ikut
 * ke sampel, state, log, atau temuan.
 */
export async function productionPoll(d: CollectorDevice): Promise<PollResult> {
  const ip = await resolveAllowedTarget(d.host, d.apiPort);
  const password = open(d.passwordEnc);
  if (!password) throw new Error("Password perangkat tidak bisa dibuka (VPN_SECRET/NEXTAUTH_SECRET berubah?). Isi ulang di Pengaturan perangkat.");
  return pollMikrotik({ ip, host: d.host, port: d.apiPort, tls: d.tls, fingerprint: d.tlsFingerprint, username: d.username, password });
}
