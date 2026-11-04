import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { fetchSkill, parseSkillRef } from "@/lib/skills-source";

export const dynamic = "force-dynamic";

/** Batas skill yang dimuat ulang sekaligus; sama dengan batas skill aktif di /api/ai/chat. */
const MAX_RELOAD = 8;

/**
 * Mengambil SKILL.md dari link skills.sh / GitHub; skill disimpan di browser pengguna, bukan di server.
 *  - { ref }: satu skill baru (menu Skill).
 *  - { refs }: muat ulang skill aktif setiap kali chat dibuka; dihitung satu permintaan, hasil per skill.
 */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { ref?: unknown; refs?: unknown } | null;

  if (Array.isArray(b?.refs)) {
    const guard = await requireAiUser("skills-load", 120);
    if (isGuardResponse(guard)) return guard;
    const refs = b.refs.slice(0, MAX_RELOAD).map((r) => String(r ?? ""));
    const settled = await Promise.allSettled(refs.map((r) => fetchSkill(parseSkillRef(r))));
    return NextResponse.json({
      results: settled.map((s, i) =>
        s.status === "fulfilled"
          ? { ref: refs[i], skill: s.value }
          : { ref: refs[i], error: s.reason instanceof Error ? s.reason.message : "Gagal mengambil skill." },
      ),
    });
  }

  const guard = await requireAiUser("skills", 30);
  if (isGuardResponse(guard)) return guard;
  try {
    const ref = parseSkillRef(String(b?.ref ?? ""));
    const skill = await fetchSkill(ref);
    return NextResponse.json({ skill });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil skill." }, { status: 400 });
  }
}
