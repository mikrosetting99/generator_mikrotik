"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Plus, Terminal, Trash, Wand, X } from "@/components/icons";
import { Button, Field, Note, Select, TextInput } from "@/components/ui";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/ai-catalog";

/* ------------------------------------------------------------------ tipe */

interface AiSettings {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
}

interface RouterSettings {
  host: string;
  port: string;
  tls: boolean;
  username: string;
}

interface RouterInfo {
  identity: string;
  version: string;
  board: string;
  uptime: string;
  cpuLoad: string;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  source: string;
  enabled: boolean;
}

interface Msg {
  id: string;
  /** "result" = hasil perintah di router (dikirim ke AI sebagai pesan user); "system" = catatan, tidak dikirim ke AI. */
  role: "user" | "assistant" | "result" | "system";
  content: string;
  error?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Msg[];
}

interface ExecResult {
  line: string;
  ok: boolean;
  safety: string;
  output: string;
}

const AI_KEY = "ai-eng-ai-v1";
const ROUTER_KEY = "ai-eng-router-v1";
const SKILLS_KEY = "ai-eng-skills-v1";
const CONVS_KEY = "ai-eng-convs-v1";
const MAX_CONVS = 30;
const MAX_STORED_MESSAGES = 80;
const MAX_AUTO_STEPS = 4;
const SKILLS_CHAR_LIMIT = 90_000;

const DEFAULT_AI: AiSettings = { provider: "anthropic", model: AI_PROVIDERS[0].models[0], apiKey: "", baseUrl: "" };
const DEFAULT_ROUTER: RouterSettings = { host: "", port: "8728", tls: false, username: "" };

const STARTERS = [
  "Periksa konfigurasi firewall dan NAT router ini, lalu beri catatan keamanan.",
  "Kenapa koneksi internet lambat? Cek interface, queue, dan resource router.",
  "Buatkan setup load balance 2 ISP dengan failover untuk router ini.",
  "Tampilkan semua user hotspot yang sedang aktif.",
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...(fallback as object), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // penyimpanan diblokir atau penuh: data hanya berlaku selama halaman terbuka
  }
}

let counter = 0;
const newId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

/* ------------------------------------------------------- pemecah jawaban AI */

type Segment = { type: "text"; text: string } | { type: "code"; lang: string; code: string };

function splitSegments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /```([A-Za-z0-9_+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({ type: "code", lang: m[1].toLowerCase(), code: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

const ROS_LANGS = new Set(["", "routeros", "rsc", "mikrotik", "ros", "shell", "bash", "sh", "text", "console"]);

/** Baris perintah RouterOS dari sebuah blok kode; kosong bila bukan blok perintah. */
function extractCommands(lang: string, code: string): string[] {
  if (!ROS_LANGS.has(lang)) return [];
  const joined = code.replace(/\\\r?\n\s*/g, " ");
  const lines = joined
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (!lines.length || !lines.every((l) => l.startsWith("/"))) return [];
  return lines;
}

const isReadLine = (l: string) => /(^|\s)print(\s|$)/.test(l) || /^\/(ping|tool\s+traceroute|tool\/traceroute)\b/.test(l);
const isDangerLine = (l: string) => /^\/(system\s+(reboot|shutdown|package|routerboard)|system\/(reboot|shutdown|package|routerboard)|user\b|ip\s+service|ip\/service)/.test(l);

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-brand/10 px-1 py-px font-mono text-[0.85em] text-brand">
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const convTitle = (messages: Msg[]) => {
  const first = messages.find((m) => m.role === "user")?.content.trim().replace(/\s+/g, " ") ?? "";
  return first ? (first.length > 48 ? `${first.slice(0, 48)}…` : first) : "Percakapan baru";
};

const timeLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

/* ---------------------------------------------------------------- komponen */

export function AiEngineer() {
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState<AiSettings>(DEFAULT_AI);
  const [router, setRouter] = useState<RouterSettings>(DEFAULT_ROUTER);
  const [routerPass, setRouterPass] = useState("");
  const [info, setInfo] = useState<RouterInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillRef, setSkillRef] = useState("");
  const [skillBusy, setSkillBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "warn" | "bad"; text: string } | null>(null);

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState(() => newId());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRead, setAutoRead] = useState(true);
  const [done, setDone] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    setAi(load(AI_KEY, DEFAULT_AI));
    setRouter(load(ROUTER_KEY, DEFAULT_ROUTER));
    try {
      const raw = window.localStorage.getItem(SKILLS_KEY);
      if (raw) setSkills(JSON.parse(raw));
      const c = window.localStorage.getItem(CONVS_KEY);
      if (c) setConvs(JSON.parse(c));
    } catch {
      // abaikan simpanan rusak
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(AI_KEY, ai);
  }, [ai, ready]);
  useEffect(() => {
    if (ready) save(ROUTER_KEY, router);
  }, [router, ready]);
  useEffect(() => {
    if (ready) save(SKILLS_KEY, skills);
  }, [skills, ready]);
  useEffect(() => {
    if (ready) save(CONVS_KEY, convs);
  }, [convs, ready]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Percakapan aktif ikut tersimpan di riwayat setiap ada pesan baru.
  useEffect(() => {
    if (!ready || messages.length === 0) return;
    setConvs((list) => {
      const rest = list.filter((c) => c.id !== convId);
      const conv: Conversation = { id: convId, title: convTitle(messages), updatedAt: Date.now(), messages: messages.slice(-MAX_STORED_MESSAGES) };
      return [conv, ...rest].slice(0, MAX_CONVS);
    });
  }, [messages, convId, ready]);

  const provider = AI_PROVIDERS.find((p) => p.id === ai.provider) ?? AI_PROVIDERS[0];
  const enabledSkills = skills.filter((s) => s.enabled);
  const skillChars = enabledSkills.reduce((n, s) => n + s.content.length, 0);
  const routerInfoText = info
    ? `identity=${info.identity} versi RouterOS=${info.version} board=${info.board} uptime=${info.uptime} cpu-load=${info.cpuLoad}%`
    : "";

  const note = useCallback((content: string, error = false) => setMessages((m) => [...m, { id: newId(), role: "system", content, error }]), []);

  /* ------------------------------------------------------------------ router */

  const routerBody = useCallback(
    () => ({ host: router.host.trim(), port: Number(router.port) || 8728, tls: router.tls, username: router.username, password: routerPass }),
    [router, routerPass],
  );

  const connect = async () => {
    setFlash(null);
    if (!router.host.trim() || !router.username.trim()) return setFlash({ tone: "bad", text: "Isi alamat router dan username dulu." });
    setConnecting(true);
    try {
      const r = await post<{ info: RouterInfo }>("/api/ai/router", { action: "connect", ...routerBody() });
      if (!r.ok) {
        setInfo(null);
        return setFlash({ tone: "bad", text: r.data.error ?? "Gagal tersambung ke router." });
      }
      setInfo(r.data.info);
      note(`Tersambung ke ${r.data.info.identity || router.host} · RouterOS ${r.data.info.version}`);
      setDrawer(false);
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setInfo(null);
    setRouterPass("");
    note("Router diputuskan.");
  };

  /** Menjalankan daftar perintah di router; hasilnya ditambahkan ke chat dan dikembalikan agar bisa dikirim ke AI. */
  const execCommands = async (commands: string[], opts: { confirmed: boolean }): Promise<Msg | null> => {
    if (!info) {
      setFlash({ tone: "warn", text: "Sambungkan router dulu (Pengaturan > Router)." });
      return null;
    }
    const writes = commands.filter((l) => !isReadLine(l));
    const dangers = commands.filter(isDangerLine);
    if (writes.length && !opts.confirmed) {
      const ok = window.confirm(`Jalankan ${writes.length} perintah yang MENGUBAH konfigurasi di ${info.identity || router.host}?\n\n${writes.join("\n")}`);
      if (!ok) return null;
    }
    if (dangers.length) {
      const ok = window.confirm(`PERINGATAN: perintah berikut berisiko (bisa memutus akses atau mengubah akun/layanan router):\n\n${dangers.join("\n")}\n\nTetap jalankan?`);
      if (!ok) return null;
    }
    const push = (content: string, error: boolean): Msg => {
      const msg: Msg = { id: newId(), role: "result", content, error };
      setMessages((m) => [...m, msg]);
      return msg;
    };
    try {
      const r = await post<{ results: ExecResult[] }>("/api/ai/router", {
        action: "exec",
        ...routerBody(),
        commands,
        confirmWrite: writes.length > 0,
        confirmDanger: dangers.length > 0,
      });
      if (!r.ok) return push(`Gagal menjalankan: ${r.data.error ?? "galat tidak diketahui"}`, true);
      const text = r.data.results.map((x) => `${x.ok ? "✔" : "✘"} ${x.line}\n${x.output}`).join("\n\n");
      return push(text, r.data.results.some((x) => !x.ok));
    } catch {
      return push("Gagal menghubungi server.", true);
    }
  };

  /* -------------------------------------------------------------------- chat */

  /** Satu putaran ke AI dengan seluruh riwayat; bila AI menyarankan perintah baca, jalankan otomatis (maks beberapa kali). */
  const converse = async (history: Msg[], step = 0): Promise<void> => {
    if (!ai.apiKey.trim()) {
      setFlash({ tone: "bad", text: "Isi API key AI dulu (Pengaturan > Koneksi AI)." });
      setDrawer(true);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const payload = history
        .filter((m) => m.role !== "system" && !(m.error && m.role === "assistant"))
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.role === "result" ? `[Hasil eksekusi]\n${m.content}` : m.content }));
      const r = await post<{ text: string }>(
        "/api/ai/chat",
        {
          provider: ai.provider,
          model: ai.model,
          apiKey: ai.apiKey,
          baseUrl: ai.baseUrl,
          routerInfo: routerInfoText,
          skills: enabledSkills.map((s) => ({ name: s.name, content: s.content })),
          messages: payload,
        },
        controller.signal,
      );
      if (!r.ok) {
        setMessages((m) => [...m, { id: newId(), role: "assistant", content: r.data.error ?? "Gagal menghubungi AI.", error: true }]);
        return;
      }
      const reply: Msg = { id: newId(), role: "assistant", content: r.data.text };
      const next = [...history, reply];
      setMessages((m) => [...m, reply]);

      // Perintah baca (print) langsung dijalankan bila diizinkan, lalu hasilnya dianalisis AI.
      if (autoRead && info && step < MAX_AUTO_STEPS) {
        const cmds = splitSegments(r.data.text).flatMap((s) => (s.type === "code" ? extractCommands(s.lang, s.code) : []));
        if (cmds.length && cmds.every(isReadLine)) {
          const resultMsg = await execCommands(cmds, { confirmed: true });
          if (resultMsg) await converse([...next, resultMsg], step + 1);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((m) => [...m, { id: newId(), role: "assistant", content: "Gagal menghubungi server.", error: true }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || busy) return;
    setFlash(null);
    setDraft("");
    const history: Msg[] = [...messagesRef.current, { id: newId(), role: "user", content }];
    setMessages(history);
    await converse(history);
  };

  const runBlock = async (key: string, commands: string[]) => {
    if (busy) return;
    setBusy(true);
    const before = messagesRef.current;
    const resultMsg = await execCommands(commands, { confirmed: false });
    setBusy(false);
    if (!resultMsg) return;
    setDone((d) => ({ ...d, [key]: "Sudah dijalankan" }));
    // Hasil dikirim ke AI supaya ia bisa menganalisis dan melanjutkan.
    await converse([...before, resultMsg]);
  };

  const stop = () => abortRef.current?.abort();

  const newChat = () => {
    if (busy) return;
    setConvId(newId());
    setMessages([]);
    setDone({});
    setFlash(null);
    setSidebar(false);
  };

  const openChat = (c: Conversation) => {
    if (busy) return;
    setConvId(c.id);
    setMessages(c.messages);
    setDone({});
    setFlash(null);
    setSidebar(false);
  };

  const deleteChat = (id: string) => {
    if (busy) return;
    setConvs((list) => list.filter((c) => c.id !== id));
    if (id === convId) {
      setConvId(newId());
      setMessages([]);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setFlash({ tone: "bad", text: "Clipboard diblokir browser — salin manual." });
    }
  };

  /* ------------------------------------------------------------------ skill */

  const addSkill = async () => {
    const ref = skillRef.trim();
    if (!ref) return;
    setSkillBusy(true);
    setFlash(null);
    try {
      const r = await post<{ skill: Omit<Skill, "enabled"> }>("/api/ai/skills", { ref });
      if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal mengambil skill." });
      const s = r.data.skill;
      setSkills((list) => [...list.filter((x) => x.id !== s.id), { ...s, enabled: true }]);
      setSkillRef("");
      setFlash({ tone: "info", text: `Skill "${s.name}" ditambahkan (${s.content.length.toLocaleString("id-ID")} karakter).` });
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setSkillBusy(false);
    }
  };

  /* --------------------------------------------------------------- tampilan */

  const aiReady = Boolean(ai.apiKey.trim() && ai.model.trim());
  const modelListId = useMemo(() => `models-${ai.provider}`, [ai.provider]);
  const draftRows = Math.min(6, Math.max(1, draft.split("\n").length));

  const block = "mb-4 rounded-[10px] border border-line bg-surface";
  const blockHead = "rounded-t-[10px] border-b border-line bg-raised px-4 py-2.5";

  const settings = (
    <>
      {flash && (
        <div className="mb-4">
          <Note tone={flash.tone}>{flash.text}</Note>
        </div>
      )}

      <section className={block}>
        <h2 className={`${blockHead} text-[15px] font-semibold text-ink`}>Koneksi AI</h2>
        <div className="space-y-3 p-4">
          <Field label="Penyedia API">
            <Select
              value={ai.provider}
              placeholder=""
              onChange={(v) => {
                const p = AI_PROVIDERS.find((x) => x.id === v) ?? AI_PROVIDERS[0];
                setAi({ ...ai, provider: p.id, model: p.models[0] ?? "", baseUrl: p.id === "custom" ? ai.baseUrl : "" });
              }}
              options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
            />
          </Field>
          {ai.provider === "custom" && (
            <Field label="Base URL" hint="Harus https. Contoh: https://api.contoh.com/v1">
              <TextInput mono value={ai.baseUrl} onChange={(baseUrl) => setAi({ ...ai, baseUrl })} placeholder="https://api.contoh.com/v1" />
            </Field>
          )}
          <Field label="Model" hint={provider.models.length ? "Pilih dari saran atau ketik nama model lain." : "Ketik nama model."}>
            <>
              <input
                list={modelListId}
                value={ai.model}
                onChange={(e) => setAi({ ...ai, model: e.target.value })}
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-brand sm:h-10"
              />
              <datalist id={modelListId}>
                {provider.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </>
          </Field>
          <Field label="API key" hint={`Buat di ${provider.keyHint}`}>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput mono type={showKey ? "text" : "password"} value={ai.apiKey} onChange={(apiKey) => setAi({ ...ai, apiKey: apiKey.trim() })} placeholder="sk-…" />
              </div>
              <Button onClick={() => setShowKey((v) => !v)}>{showKey ? "Sembunyikan" : "Tampilkan"}</Button>
            </div>
          </Field>
          <p className="text-[11px] leading-relaxed text-faint">
            API key disimpan di browser ini saja. Server hanya meneruskannya ke penyedia AI saat Anda chat dan tidak menyimpannya.
          </p>
        </div>
      </section>

      <section className={block}>
        <h2 className={`${blockHead} text-[15px] font-semibold text-ink`}>Router (API)</h2>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
            <Field label="IP publik / domain">
              <TextInput mono value={router.host} onChange={(host) => setRouter({ ...router, host: host.replace(/\s+/g, "") })} placeholder="103.1.2.3 atau router.contoh.com" disabled={Boolean(info)} />
            </Field>
            <Field label="Port API">
              <TextInput mono value={router.port} onChange={(port) => setRouter({ ...router, port: port.replace(/\D/g, "") })} placeholder="8728" disabled={Boolean(info)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={router.tls}
              disabled={Boolean(info)}
              onChange={(e) => setRouter({ ...router, tls: e.target.checked, port: e.target.checked && router.port === "8728" ? "8729" : !e.target.checked && router.port === "8729" ? "8728" : router.port })}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Pakai TLS (api-ssl, biasanya port 8729)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Username">
              <TextInput mono value={router.username} onChange={(username) => setRouter({ ...router, username: username.trim() })} placeholder="ai-engineer" disabled={Boolean(info)} />
            </Field>
            <Field label="Password">
              <TextInput mono type="password" value={routerPass} onChange={setRouterPass} placeholder="••••••" disabled={Boolean(info)} />
            </Field>
          </div>
          {info ? (
            <div className="space-y-2 rounded-md border border-ok/40 bg-ok/10 p-3 text-xs">
              <p className="font-semibold text-ink">Tersambung · {info.identity || router.host}</p>
              <p className="font-mono text-muted">
                RouterOS {info.version} · {info.board} · CPU {info.cpuLoad}% · up {info.uptime}
              </p>
              <Button size="sm" onClick={disconnect}>
                Putuskan
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={connect} disabled={connecting}>
              <Terminal className="h-4 w-4" />
              {connecting ? "Menyambung…" : "Hubungkan"}
            </Button>
          )}
          <p className="text-[11px] leading-relaxed text-faint">
            Aktifkan <b>/ip service api</b> (atau api-ssl) dan batasi alamat yang diizinkan. Disarankan membuat user khusus di router dengan hak seperlunya.
            Password hanya dipakai selama sesi ini dan tidak disimpan; tiap perintah dijalankan lewat server aplikasi.
          </p>
        </div>
      </section>

      <section className={block}>
        <h2 className={`${blockHead} text-[15px] font-semibold text-ink`}>Skill (skills.sh)</h2>
        <div className="space-y-3 p-4">
          <Field label="Link atau perintah skill" hint="Contoh: https://skills.sh/pemilik/repo/skill · pemilik/repo --skill nama · npx skills add pemilik/repo --skill nama">
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput mono value={skillRef} onChange={setSkillRef} placeholder="https://skills.sh/…" />
              </div>
              <Button onClick={addSkill} disabled={skillBusy || !skillRef.trim()}>
                <Plus className="h-4 w-4" />
                {skillBusy ? "Mengambil…" : "Tambah"}
              </Button>
            </div>
          </Field>
          {skills.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-3 py-3 text-xs text-faint">Belum ada skill. Skill aktif ikut dikirim ke AI sebagai panduan tambahan.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {skills.map((s) => (
                <li key={s.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => setSkills((list) => list.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)))}
                    aria-label={`Aktifkan skill ${s.name}`}
                    className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                    {s.description && <p className="line-clamp-2 text-xs text-muted">{s.description}</p>}
                    <a href={s.source} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand hover:underline">
                      {s.id} · {s.content.length.toLocaleString("id-ID")} karakter
                    </a>
                  </div>
                  <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus skill ${s.name}`} title="Hapus" onClick={() => setSkills((list) => list.filter((x) => x.id !== s.id))}>
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {skillChars > SKILLS_CHAR_LIMIT && (
            <Note tone="warn">Skill aktif ({skillChars.toLocaleString("id-ID")} karakter) melebihi batas {SKILLS_CHAR_LIMIT.toLocaleString("id-ID")}; sebagian tidak ikut terkirim. Nonaktifkan yang tidak perlu.</Note>
          )}
        </div>
      </section>
    </>
  );

  const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";

  const sidebarEl = (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-raised">
      <div className="grid gap-2 border-b border-line p-3">
        <Button variant="primary" onClick={newChat} disabled={busy}>
          <Plus className="h-4 w-4" />
          Percakapan baru
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Riwayat percakapan">
        {convs.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-faint">Riwayat percakapan akan muncul di sini.</p>
        ) : (
          convs.map((c) => (
            <div key={c.id} className={`group flex items-center border-b border-line ${c.id === convId ? "bg-brand/10" : "hover:bg-brand/[0.05]"}`}>
              <button type="button" onClick={() => openChat(c)} className={`min-w-0 flex-1 px-4 py-2.5 text-left ${c.id === convId ? "font-medium text-brand" : "text-ink"}`}>
                <span className="block truncate text-sm">{c.title}</span>
                <span className="block text-[11px] font-normal text-faint">{timeLabel(c.updatedAt)}</span>
              </button>
              <button
                type="button"
                onClick={() => deleteChat(c.id)}
                aria-label={`Hapus percakapan ${c.title}`}
                title="Hapus"
                className="mr-2 rounded-md p-1.5 text-faint opacity-0 transition-opacity hover:bg-bad/10 hover:text-bad focus:opacity-100 group-hover:opacity-100 max-xl:opacity-100"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </nav>
      <div className="border-t border-line p-3">
        <Button onClick={() => setDrawer(true)} className="w-full">
          Pengaturan
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="relative grid h-[calc(100dvh-48px)] min-h-[480px] xl:grid-cols-[270px_minmax(0,1fr)]">
      {/* ----------------------------------------------------- riwayat (kiri) */}
      <div className="hidden min-h-0 xl:block">{sidebarEl}</div>
      {sidebar && (
        <div className="absolute inset-0 z-30 xl:hidden">
          <button type="button" aria-label="Tutup riwayat" className="absolute inset-0 bg-black/40" onClick={() => setSidebar(false)} />
          <div className="relative h-full w-[290px] max-w-[85vw] shadow-xl">{sidebarEl}</div>
        </div>
      )}

      {/* ------------------------------------------------------------ chat */}
      <section className="flex min-h-0 min-w-0 flex-col bg-surface">
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSidebar(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-muted hover:text-ink xl:hidden"
          >
            Riwayat
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          </button>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Wand className="h-4 w-4 text-brand" />
            <span className="max-w-[40vw] truncate">{messages.length ? convTitle(messages) : "AI Mikrotik Engineer"}</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setDrawer(true)} className={`${chip} ${aiReady ? "border-brand/30 bg-brand/10 text-brand" : "border-warn/40 bg-warn/10 text-warn"}`}>
              {aiReady ? `${provider.label.split(" (")[0]} · ${ai.model}` : "Isi API key"}
            </button>
            <button type="button" onClick={() => setDrawer(true)} className={`${chip} ${info ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-raised text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${info ? "bg-ok" : "bg-faint"}`} />
              {info ? info.identity || router.host : "Router belum tersambung"}
            </button>
            {enabledSkills.length > 0 && <span className={`${chip} border-line bg-raised text-muted`}>{enabledSkills.length} skill</span>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted" title="Perintah print dijalankan otomatis dan hasilnya langsung dianalisis AI">
              <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
              <span className="hidden sm:inline">Jalankan otomatis perintah baca</span>
              <span className="sm:hidden">Auto baca</span>
            </label>
            <Button size="sm" onClick={() => setDrawer(true)} className="xl:hidden">
              Pengaturan
            </Button>
          </div>
        </header>

        {flash && !drawer && (
          <div className="border-b border-line px-4 py-2">
            <Note tone={flash.tone}>{flash.text}</Note>
          </div>
        )}

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-2.5">
            {messages.length === 0 && (
              <div className="m-auto w-full space-y-4 py-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Wand className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">Tanya apa saja soal Mikrotik</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
                    Minta AI menjelaskan, menyusun script, atau memeriksa router. Perintah yang mengubah konfigurasi baru dijalankan setelah Anda menyetujuinya.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraft(s)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === "system") {
                return (
                  <div key={m.id} className={`max-w-[90%] self-center whitespace-pre-wrap rounded-full px-3 py-1 text-center text-[13px] ${m.error ? "bg-bad/10 text-bad" : "bg-raised text-muted"}`}>
                    {m.content}
                  </div>
                );
              }
              if (m.role === "user") {
                return (
                  <div key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-xl rounded-br-[4px] bg-brand px-3.5 py-2.5 leading-relaxed text-brand-ink">
                    {m.content}
                  </div>
                );
              }
              if (m.role === "result") {
                const count = m.content.split("\n").filter((l) => l.startsWith("✔") || l.startsWith("✘")).length;
                return (
                  <details key={m.id} open={m.error} className="max-w-[760px] self-start text-[13px] text-muted">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                      <Terminal className={`h-3.5 w-3.5 ${m.error ? "text-bad" : "text-brand"}`} />
                      <span className={m.error ? "text-bad" : ""}>
                        {m.error ? "Perintah gagal" : "Hasil di router"}
                        {count > 0 ? ` · ${count} perintah` : ""}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </summary>
                    <pre className="mt-1.5 max-h-64 max-w-[min(760px,85vw)] overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-raised p-2 font-mono text-[12px] leading-relaxed text-ink">
                      {m.content}
                    </pre>
                  </details>
                );
              }
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] self-start break-words rounded-xl rounded-bl-[4px] border px-3.5 py-2.5 leading-relaxed ${m.error ? "border-bad/30 bg-bad/10 text-bad" : "border-line bg-raised text-ink"}`}
                >
                  {splitSegments(m.content).map((seg, i) => {
                    if (seg.type === "text") {
                      return seg.text.trim() ? (
                        <p key={i} className="whitespace-pre-wrap [&:not(:first-child)]:mt-2">
                          <Inline text={seg.text.trim()} />
                        </p>
                      ) : null;
                    }
                    const cmds = extractCommands(seg.lang, seg.code);
                    const key = `${m.id}:${i}`;
                    const writes = cmds.filter((l) => !isReadLine(l)).length;
                    return (
                      <div key={i} className="my-2 overflow-hidden rounded-md bg-[#1f2933] text-[#e5e7eb]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
                          <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-[#9aa5b1]">{seg.lang || "kode"}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {cmds.length > 0 && (
                              <button
                                type="button"
                                disabled={busy || !info || Boolean(done[key])}
                                onClick={() => runBlock(key, cmds)}
                                title={info ? "Jalankan di router" : "Sambungkan router dulu"}
                                className={`inline-flex min-h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${writes ? "bg-brand text-brand-ink" : "bg-white/10 text-white hover:bg-white/20"}`}
                              >
                                <Terminal className="h-3.5 w-3.5" />
                                {done[key] ?? (writes ? `Jalankan (${writes} perubahan)` : "Jalankan")}
                              </button>
                            )}
                            <button type="button" onClick={() => copy(key, seg.code)} className="inline-flex min-h-7 items-center gap-1 rounded-md bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20">
                              {copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copied === key ? "Tersalin" : "Salin"}
                            </button>
                          </div>
                        </div>
                        <pre className="max-h-80 overflow-auto px-3 py-2.5 font-mono text-[12.5px] leading-relaxed">{seg.code}</pre>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-center gap-2 self-start text-xs text-muted">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
                </span>
                AI sedang bekerja…
                <button type="button" onClick={stop} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">
                  <X className="h-3 w-3" />
                  Hentikan
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line bg-surface px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mx-auto flex max-w-[860px] items-end gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={draftRows}
              placeholder="Tanya atau beri instruksi… (Enter kirim, Shift+Enter baris baru)"
              className="max-h-[180px] min-h-[42px] flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <Button variant="primary" type="submit" disabled={busy || !draft.trim()}>
              Kirim
            </Button>
          </form>
        </div>
      </section>

      {/* ------------------------------------------- pengaturan (panel kanan) */}
      {drawer && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Pengaturan AI Mikrotik Engineer">
          <button type="button" aria-label="Tutup pengaturan" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[620px] max-w-full flex-col bg-canvas shadow-2xl">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Wand className="h-4 w-4 text-brand" />
                Pengaturan
              </h2>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Tutup" className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{settings}</div>
            <div className="flex justify-end border-t border-line bg-surface px-4 py-3">
              <Button variant="primary" onClick={() => setDrawer(false)}>
                Selesai
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
