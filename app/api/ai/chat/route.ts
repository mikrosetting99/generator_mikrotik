import { NextResponse } from "next/server";
import { AI_PROVIDERS, buildSystemPrompt, chatOnce, type AiProviderId, type ChatMessage } from "@/lib/ai-providers";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_SKILLS = 8;
const MAX_SKILLS_CHARS = 90_000;

/** Satu putaran percakapan: API key milik pengguna dikirim per permintaan dan tidak disimpan di server. */
export async function POST(request: Request) {
  const guard = await requireAiUser("chat", 60);
  if (isGuardResponse(guard)) return guard;

  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });

  const provider = String(b.provider ?? "") as AiProviderId;
  if (!AI_PROVIDERS.some((p) => p.id === provider)) return NextResponse.json({ error: "Penyedia AI tidak dikenal." }, { status: 400 });
  const model = String(b.model ?? "").trim().slice(0, 120);
  const apiKey = String(b.apiKey ?? "").trim().slice(0, 500);
  const baseUrl = String(b.baseUrl ?? "").trim().slice(0, 300);

  const messages: ChatMessage[] = (Array.isArray(b.messages) ? b.messages : [])
    .slice(-MAX_MESSAGES)
    .map((m: unknown) => {
      const r = m as Record<string, unknown>;
      return { role: r?.role === "assistant" ? ("assistant" as const) : ("user" as const), content: String(r?.content ?? "").slice(0, MAX_MESSAGE_CHARS) };
    })
    .filter((m) => m.content.trim());
  // Percakapan harus diawali pesan user dan berakhir dengan pesan user.
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Tulis pesan dulu." }, { status: 400 });
  }

  let skillChars = 0;
  const skills = (Array.isArray(b.skills) ? b.skills : [])
    .slice(0, MAX_SKILLS)
    .map((s: unknown) => {
      const r = s as Record<string, unknown>;
      return { name: String(r?.name ?? "skill").slice(0, 80), content: String(r?.content ?? "") };
    })
    .filter((s) => {
      skillChars += s.content.length;
      return s.content.trim() && skillChars <= MAX_SKILLS_CHARS;
    });

  const system = buildSystemPrompt({ routerInfo: String(b.routerInfo ?? "").slice(0, 2000), skills });

  try {
    const text = await chatOnce({ provider, model, apiKey, baseUrl, system, messages }, AbortSignal.timeout(110_000));
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal menghubungi AI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}