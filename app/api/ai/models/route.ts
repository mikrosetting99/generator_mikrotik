import { NextResponse } from "next/server";
import { AI_PROVIDERS, listModels, type AiProviderId } from "@/lib/ai-providers";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";

/** Memuat semua model yang tersedia untuk API key pengguna pada penyedia terpilih. */
export async function POST(request: Request) {
  const guard = await requireAiUser("models", 30);
  if (isGuardResponse(guard)) return guard;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const provider = String(b?.provider ?? "") as AiProviderId;
  if (!AI_PROVIDERS.some((p) => p.id === provider)) return NextResponse.json({ error: "Penyedia AI tidak dikenal." }, { status: 400 });
  try {
    const models = await listModels(
      { provider, apiKey: String(b?.apiKey ?? "").slice(0, 500), baseUrl: String(b?.baseUrl ?? "").slice(0, 300) },
      AbortSignal.timeout(20_000),
    );
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memuat daftar model." }, { status: 502 });
  }
}