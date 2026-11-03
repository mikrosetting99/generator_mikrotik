import { NextResponse } from "next/server";
import { AI_PROVIDERS, chatOnce, type AiProviderId } from "@/lib/ai-providers";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Menguji API key dan model: mengirim satu pesan pendek ke penyedia dan melaporkan hasil serta waktunya. */
export async function POST(request: Request) {
  const guard = await requireAiUser("test", 20);
  if (isGuardResponse(guard)) return guard;

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const provider = String(b?.provider ?? "") as AiProviderId;
  if (!AI_PROVIDERS.some((p) => p.id === provider)) return NextResponse.json({ error: "Penyedia AI tidak dikenal." }, { status: 400 });
  const model = String(b?.model ?? "").trim().slice(0, 120);
  const apiKey = String(b?.apiKey ?? "").trim().slice(0, 500);
  const baseUrl = String(b?.baseUrl ?? "").trim().slice(0, 300);

  const started = Date.now();
  try {
    const reply = await chatOnce(
      {
        provider,
        model,
        apiKey,
        baseUrl,
        system: "Ini hanya uji koneksi. Balas singkat dalam satu kalimat.",
        messages: [{ role: "user", content: "Balas dengan kata: OK" }],
        maxTokens: 256,
      },
      AbortSignal.timeout(40_000),
    );
    return NextResponse.json({ ok: true, ms: Date.now() - started, reply: reply.trim().slice(0, 120) });
  } catch (e) {
    return NextResponse.json({ ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : "Uji koneksi gagal." }, { status: 200 });
  }
}
