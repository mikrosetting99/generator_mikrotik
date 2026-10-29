/**
 * Mengambil skill dari skills.sh. Satu skill adalah berkas SKILL.md di repositori GitHub
 * (https://skills.sh/<pemilik>/<repo>/<skill>, atau perintah `npx skills add <pemilik>/<repo> --skill <skill>`).
 * Hanya github.com / raw.githubusercontent.com / api.github.com yang diakses dari server.
 */

export interface SkillRef {
  owner: string;
  repo: string;
  skill: string;
  branch?: string;
  /** Jalur langsung ke SKILL.md (dari URL GitHub). */
  path?: string;
}

export interface FetchedSkill {
  /** "pemilik/repo/skill" — kunci unik di daftar skill pengguna. */
  id: string;
  name: string;
  description: string;
  content: string;
  source: string;
}

export const MAX_SKILL_BYTES = 60_000;

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** Memahami berbagai cara menulis skill: URL skills.sh, URL GitHub, "pemilik/repo", atau perintah npx. */
export function parseSkillRef(input: string): SkillRef {
  let s = input.trim();
  if (!s) throw new Error("Isi link skills.sh atau pemilik/repo.");
  if (s.length > 400) throw new Error("Teks terlalu panjang.");

  // npx skills add owner/repo --skill nama   (juga "skills add …")
  const skillFlag = s.match(/--skill[=\s]+([^\s]+)/);
  const cmd = s.match(/^(?:npx\s+)?skills(?:@\S+)?\s+add\s+(\S+)/i);
  if (cmd) {
    s = cmd[1];
  }
  const flagSkill = skillFlag?.[1]?.replace(/^["']|["']$/g, "") ?? "";

  let owner = "";
  let repo = "";
  let skill = "";
  let branch: string | undefined;
  let path: string | undefined;

  if (/^https?:\/\//i.test(s)) {
    let u: URL;
    try {
      u = new URL(s);
    } catch {
      throw new Error("Link tidak valid.");
    }
    const host = u.hostname.replace(/^www\./, "");
    const seg = u.pathname.split("/").filter(Boolean);
    if (host === "skills.sh") {
      [owner, repo, skill] = [seg[0] ?? "", seg[1] ?? "", seg[2] ?? ""];
    } else if (host === "github.com") {
      [owner, repo] = [seg[0] ?? "", (seg[1] ?? "").replace(/\.git$/, "")];
      if (seg[2] === "tree" || seg[2] === "blob") {
        branch = seg[3];
        const rest = seg.slice(4);
        if (rest.length) {
          if (/skill\.md$/i.test(rest[rest.length - 1])) {
            path = rest.join("/");
            skill = rest[rest.length - 2] ?? "";
          } else {
            path = `${rest.join("/")}/SKILL.md`;
            skill = rest[rest.length - 1];
          }
        }
      }
    } else {
      throw new Error("Hanya link skills.sh atau github.com yang didukung.");
    }
  } else {
    const seg = s.split("/").filter(Boolean);
    [owner, repo, skill] = [seg[0] ?? "", (seg[1] ?? "").replace(/\.git$/, ""), seg[2] ?? ""];
  }
  if (flagSkill) skill = flagSkill;
  if (!SLUG.test(owner) || !SLUG.test(repo)) throw new Error("Format harus pemilik/repo, mis. vercel-labs/agent-skills.");
  if (skill && !SLUG.test(skill)) throw new Error("Nama skill tidak valid.");
  if (branch && !/^[A-Za-z0-9._/-]{1,100}$/.test(branch)) throw new Error("Nama branch tidak valid.");
  return { owner, repo, skill, branch, path };
}

async function getText(url: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(url, { signal, headers: { "user-agent": "generator-mikrotik", accept: "text/plain, application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub menjawab ${res.status}.`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_SKILL_BYTES * 2) throw new Error("Berkas skill terlalu besar.");
  return res.text();
}

/** Membaca "name" dan "description" dari frontmatter YAML sederhana di awal SKILL.md. */
export function parseFrontmatter(md: string): { name: string; description: string; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { name: "", description: "", body: md };
  const pick = (key: string) => {
    const line = m[1].match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
    return line ? line[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  return { name: pick("name"), description: pick("description"), body: m[2] };
}

/** Mengunduh SKILL.md untuk sebuah referensi. Melempar galat berbahasa Indonesia bila tidak ketemu. */
export async function fetchSkill(ref: SkillRef): Promise<FetchedSkill> {
  const signal = AbortSignal.timeout(12_000);
  const branches = ref.branch ? [ref.branch] : ["main", "master"];
  const raw = (b: string, p: string) => `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${b}/${p}`;

  const candidates: string[] = [];
  if (ref.path) candidates.push(ref.path);
  else if (ref.skill) {
    for (const base of ["skills", "", ".claude/skills", ".agents/skills", "skill"]) {
      candidates.push(`${base ? `${base}/` : ""}${ref.skill}/SKILL.md`);
    }
  } else candidates.push("SKILL.md");

  let content: string | null = null;
  let usedPath = "";
  outer: for (const b of branches) {
    for (const p of candidates) {
      content = await getText(raw(b, p), signal);
      if (content !== null) {
        usedPath = p;
        break outer;
      }
    }
  }

  // Cadangan: telusuri pohon repositori mencari <skill>/SKILL.md di folder mana pun.
  if (content === null && ref.skill) {
    for (const b of branches) {
      const tree = await getText(`https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${b}?recursive=1`, signal);
      if (!tree) continue;
      let list: Array<{ path: string; type: string }> = [];
      try {
        list = JSON.parse(tree).tree ?? [];
      } catch {
        continue;
      }
      const hit = list.find((n) => n.type === "blob" && n.path.toLowerCase().endsWith(`/${ref.skill.toLowerCase()}/skill.md`));
      if (hit) {
        content = await getText(raw(b, hit.path), signal);
        usedPath = hit.path;
        if (content !== null) break;
      }
    }
  }

  if (content === null) {
    throw new Error(`SKILL.md tidak ditemukan di ${ref.owner}/${ref.repo}${ref.skill ? ` untuk skill "${ref.skill}"` : ""}. Cek link atau nama skill-nya.`);
  }
  if (content.length > MAX_SKILL_BYTES) content = `${content.slice(0, MAX_SKILL_BYTES)}\n\n[dipotong: skill terlalu panjang]`;
  const fm = parseFrontmatter(content);
  const name = fm.name || ref.skill || ref.repo;
  return {
    id: [ref.owner, ref.repo, ref.skill || "root"].join("/"),
    name,
    description: fm.description,
    content: fm.body.trim(),
    source: `https://github.com/${ref.owner}/${ref.repo}/blob/${branches[0]}/${usedPath}`,
  };
}
