/**
 * Menulis ulang CHANGELOG.md dari lib/changelog.ts (satu-satunya sumber data).
 * Jalankan lewat: npm run changelog:generate
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHANGE_TYPE_LABEL, CHANGELOG } from "../lib/changelog";

const lines: string[] = [
  "# Changelog",
  "",
  "Semua perubahan penting pada proyek ini dicatat di file ini.",
  "",
  "Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/),",
  "dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id/).",
  "",
  "> File ini dibuat otomatis dari `lib/changelog.ts` — jangan edit langsung di",
  "> sini, edit sumbernya lalu jalankan `npm run changelog:generate`.",
  "",
];

for (const release of CHANGELOG) {
  lines.push(`## [${release.version}] - ${release.date}`, "");
  if (release.title) lines.push(`_${release.title}_`, "");
  for (const group of release.changes) {
    lines.push(`### ${CHANGE_TYPE_LABEL[group.type]}`, "");
    for (const item of group.items) lines.push(`- ${item}`);
    lines.push("");
  }
}

const outPath = resolve(__dirname, "../CHANGELOG.md");
writeFileSync(outPath, lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n", "utf-8");
console.log(`CHANGELOG.md ditulis ulang (${CHANGELOG.length} rilis).`);
