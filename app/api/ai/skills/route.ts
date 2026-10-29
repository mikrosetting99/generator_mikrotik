import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { fetchSkill, parseSkillRef } from "@/lib/skills-source";

export const dynamic = "force-dynamic";

/** Mengambil SKILL.md dari link skills.sh / GitHub; skill disimpan di browser pengguna, bukan di server. */
export async function POST(request: Request) {
  const guard = await requireAiUser("skills", 30);
  if (isGuardResponse(guard)) return guard;
  const b = (await request.json().catch(() => null)) as { ref?: unknown } | null;
  try {
    const ref = parseSkillRef(String(b?.ref ?? ""));
    const skill = await fetchSkill(ref);
    return NextResponse.json({ skill });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil skill." }, { status: 400 });
  }
}