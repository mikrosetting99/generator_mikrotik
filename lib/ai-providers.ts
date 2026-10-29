import { AI_PROVIDERS, type AiProviderId, type AiProviderInfo } from "@/lib/ai-catalog";
import { resolvePublicHost } from "@/lib/net-guard";

export { AI_PROVIDERS, type AiProviderId, type AiProviderInfo };

/**
 * Penyedia AI yang bisa dipilih. Ada dua bentuk API: Anthropic (native) dan "OpenAI-compatible"
 * yang dipakai OpenAI, Google Gemini, OpenRouter, DeepSeek, Groq, dan server sendiri.
 * Alamat dasar penyedia bawaan ditetapkan di server, hanya "custom" yang boleh memakai alamat
 * dari pengguna (wajib https dan publik).
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  /** Hanya untuk provider "custom". */
  baseUrl?: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

/** Menghapus API key dari teks galat sebelum dikirim ke pengguna. */
function scrub(text: string, key: string): string {
  return key ? text.split(key).join("***") : text;
}

function errorText(raw: string, key: string): string {
  let msg = raw;
  try {
    const j = JSON.parse(raw);
    msg = j?.error?.message ?? j?.message ?? j?.error ?? raw;
    if (typeof msg !== "string") msg = JSON.stringify(msg);
  } catch {
    // bukan JSON, pakai apa adanya
  }
  return scrub(msg, key).slice(0, 400);
}

export async function resolveBaseUrl(p: AiProviderInfo, custom?: string): Promise<string> {
  if (p.id !== "custom") return p.baseUrl;
  const raw = (custom ?? "").trim().replace(/\/+$/, "");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Base URL tidak valid. Contoh: https://api.contoh.com/v1");
  }
  if (u.protocol !== "https:") throw new Error("Base URL harus diawali https://.");
  await resolvePublicHost(u.hostname);
  return raw;
}

/** Mengirim percakapan ke penyedia AI dan mengembalikan teks jawabannya. */
export async function chatOnce(req: ChatRequest, signal?: AbortSignal): Promise<string> {
  const info = AI_PROVIDERS.find((p) => p.id === req.provider);
  if (!info) throw new Error("Penyedia AI tidak dikenal.");
  if (!req.apiKey.trim()) throw new Error("API key belum diisi.");
  if (!req.model.trim()) throw new Error("Nama model belum diisi.");
  const base = await resolveBaseUrl(info, req.baseUrl);
  const key = req.apiKey.trim();
  const maxTokens = Math.min(Math.max(req.maxTokens ?? 4096, 256), 8192);

  let res: Response;
  if (info.kind === "anthropic") {
    res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: req.model, max_tokens: maxTokens, system: req.system, messages: req.messages }),
      signal,
    });
  } else {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: req.model,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
      signal,
    });
  }

  const raw = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? " (cek API key)" : res.status === 404 ? " (cek nama model atau Base URL)" : res.status === 429 ? " (batas pemakaian/kuota)" : "";
    throw new Error(`${info.label} menjawab ${res.status}${hint}: ${errorText(raw, key)}`);
  }
  let data: {
    content?: Array<{ type?: string; text?: string }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`${info.label} mengirim jawaban yang tidak bisa dibaca.`);
  }
  const text: string =
    info.kind === "anthropic"
      ? (Array.isArray(data?.content) ? data.content : [])
          .filter((b) => b?.type === "text")
          .map((b) => b.text ?? "")
          .join("")
      : (data?.choices?.[0]?.message?.content ?? "");  if (!text.trim()) throw new Error("AI tidak memberi jawaban teks.");
  return text;
}

/* ------------------------------------------------------------- prompt sistem */

export const BASE_SYSTEM_PROMPT = `Kamu adalah "AI Mikrotik Engineer": insinyur jaringan senior yang ahli MikroTik RouterOS 6 dan 7 (firewall, NAT, mangle, routing, load balance, hotspot, PPPoE, DHCP, VPN, queue/bandwidth, wireless, dan troubleshooting).
Jawab dalam bahasa Indonesia yang ringkas, praktis, dan akurat. Jangan mengarang parameter; bila ragu, katakan dan sarankan cara memeriksanya.

Aturan perintah:
- Bila perintah perlu dijalankan di router, tulis di dalam blok kode berpagar \`\`\`routeros, satu perintah per baris, diawali "/" (contoh: /ip firewall nat print). Penjelasan ditulis di luar blok.
- Perintah dijalankan lewat API RouterOS, jadi: jangan pakai perintah scripting (:foreach, :if, :put, :local), jangan pakai "export", dan jangan pakai nomor urut (mis. "set 3"). Untuk memilih item pakai [find name=...] atau [find comment=...]; filter hanya kondisi sederhana (nama=nilai).
- Perintah baca (print) boleh dijalankan lebih dulu untuk memeriksa kondisi sebelum mengubah apa pun. Tunggu hasilnya sebelum menyimpulkan.
- Perintah yang mengubah konfigurasi harus dijelaskan dampaknya, dan pengguna menyetujuinya sebelum dijalankan. Hindari perubahan yang bisa memutus akses ke router (mis. firewall input drop, mematikan service api, mengubah IP/WAN yang sedang dipakai) tanpa memberi peringatan jelas.
- Jangan pernah meminta atau menampilkan password router atau API key.
- Bila pengguna memberi hasil eksekusi (diawali "[Hasil eksekusi]"), analisis hasil itu dan lanjutkan.`;

/** Menyusun prompt sistem dari prompt dasar, informasi router, dan skill aktif. */
export function buildSystemPrompt(opts: { routerInfo?: string; skills?: Array<{ name: string; content: string }> }): string {
  const parts = [BASE_SYSTEM_PROMPT];
  if (opts.routerInfo?.trim()) parts.push(`Router yang sedang tersambung:\n${opts.routerInfo.trim()}`);
  else parts.push("Belum ada router yang tersambung; kamu hanya bisa menjawab dan menyusun perintah, bukan menjalankannya.");
  for (const s of opts.skills ?? []) {
    parts.push(`<skill name="${s.name.replace(/[<>"]/g, "")}">\n${s.content}\n</skill>`);
  }
  return parts.join("\n\n");
}
