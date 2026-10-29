"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RouterMonitor, type MonitorTarget } from "@/components/ai-engineer/RouterMonitor";
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

/** Satu Mikrotik yang disimpan di browser. Password hanya ikut tersimpan bila savePass dicentang. */
interface RouterProfile {
  id: string;
  name: string;
  host: string;
  port: string;
  tls: boolean;
  username: string;
  savePass: boolean;
  pass?: string;
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
const ROUTER_KEY = "ai-eng-router-v1"; // format lama (satu router), dipindahkan ke ROUTERS_KEY
const ROUTERS_KEY = "ai-eng-routers-v2";
const ACTIVE_KEY = "ai-eng-active-router-v1";
const SKILLS_KEY = "ai-eng-skills-v1";
const CONVS_KEY = "ai-eng-convs-v1";
const MODELS_KEY = "ai-eng-models-v1";
const MAX_CONVS = 30;
const MAX_ROUTERS = 20;
const MAX_STORED_MESSAGES = 80;
const MAX_AUTO_STEPS = 4;
const SKILLS_CHAR_LIMIT = 90_000;

const DEFAULT_AI: AiSettings = { provider: "anthropic", model: AI_PROVIDERS[0].models[0], apiKey: "", baseUrl: "" };
const BLANK_ROUTER: RouterProfile = { id: "", name: "", host: "", port: "8728", tls: false, username: "", savePass: false };

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

const routerLabel = (r: RouterProfile) => r.name.trim() || r.host || "Router";

/* ---------------------------------------------------------------- komponen */

export function AiEngineer() {
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState<AiSettings>(DEFAULT_AI);
  const [models, setModels] = useState<Partial<Record<AiProviderId, string[]>>>({});
  const [modelsBusy, setModelsBusy] = useState(false);

  const [routers, setRouters] = useState<RouterProfile[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [infos, setInfos] = useState<Record<string, RouterInfo>>({});
  const [activeId, setActiveId] = useState("");
  const [editing, setEditing] = useState<RouterProfile | null>(null);
  const [connectingId, setConnectingId] = useState("");

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillRef, setSkillRef] = useState("");
  const [skillBusy, setSkillBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "warn" | "bad"; text: string } | null>(null);

  const [view, setView] = useState<"chat" | "monitor">("chat");
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
    try {
      const m = window.localStorage.getItem(MODELS_KEY);
      if (m) setModels(JSON.parse(m));
      const raw = window.localStorage.getItem(SKILLS_KEY);
      if (raw) setSkills(JSON.parse(raw));
      const c = window.localStorage.getItem(CONVS_KEY);
      if (c) setConvs(JSON.parse(c));

      let list: RouterProfile[] = [];
      const r2 = window.localStorage.getItem(ROUTERS_KEY);
      if (r2) list = JSON.parse(r2);
      else {
        // Pindahkan pengaturan satu-router versi lama menjadi router pertama.
        const old = window.localStorage.getItem(ROUTER_KEY);
        if (old) {
          const o = JSON.parse(old) as Partial<RouterProfile>;
          if (o.host) list = [{ ...BLANK_ROUTER, id: newId(), name: o.host, host: o.host, port: o.port ?? "8728", tls: Boolean(o.tls), username: o.username ?? "" }];
        }
      }
      setRouters(list);
      setPasswords(Object.fromEntries(list.filter((r) => r.savePass && r.pass).map((r) => [r.id, r.pass as string])));
      const act = window.localStorage.getItem(ACTIVE_KEY) ?? "";
      setActiveId(list.some((r) => r.id === act) ? act : (list[0]?.id ?? ""));
    } catch {
      // abaikan simpanan rusak
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(AI_KEY, ai);
  }, [ai, ready]);
  useEffect(() => {
    if (ready) save(MODELS_KEY, models);
  }, [models, ready]);
  useEffect(() => {
    // Password hanya disimpan untuk router yang dicentang "Simpan password".
    if (ready) save(ROUTERS_KEY, routers.map((r) => (r.savePass ? { ...r, pass: passwords[r.id] ?? r.pass ?? "" } : { ...r, pass: undefined })));
  }, [routers, passwords, ready]);
  useEffect(() => {
    if (ready) save(ACTIVE_KEY, activeId);
  }, [activeId, ready]);
  useEffect(() => {
    if (ready) save(SKILLS_KEY, skills);
  }, [skills, ready]);
  useEffect(() => {
    if (ready) save(CONVS_KEY, convs);
  }, [convs, ready]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, view]);

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
  const modelList = models[ai.provider]?.length ? (models[ai.provider] as string[]) : provider.models;
  const enabledSkills = skills.filter((s) => s.enabled);
  const skillChars = enabledSkills.reduce((n, s) => n + s.content.length, 0);

  const active = routers.find((r) => r.id === activeId) ?? null;
  const info = active ? (infos[active.id] ?? null) : null;
  const routerInfoText = info
    ? `nama=${routerLabel(active as RouterProfile)} identity=${info.identity} versi RouterOS=${info.version} board=${info.board} uptime=${info.uptime} cpu-load=${info.cpuLoad}%`
    : "";
  const connectedCount = routers.filter((r) => infos[r.id]).length;

  const note = useCallback((content: string, error = false) => setMessages((m) => [...m, { id: newId(), role: "system", content, error }]), []);

  /* ------------------------------------------------------------------ model */

  const loadModels = async () => {
    setFlash(null);
    setModelsBusy(true);
    try {
      const r = await post<{ models: string[] }>("/api/ai/models", { provider: ai.provider, apiKey: ai.apiKey, baseUrl: ai.baseUrl });
      if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat daftar model." });
      setModels((m) => ({ ...m, [ai.provider]: r.data.models }));
      setFlash({ tone: "info", text: `${r.data.models.length} model dimuat dari ${provider.label}.` });
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setModelsBusy(false);
    }
  };

  /* ------------------------------------------------------------------ router */

  const bodyFor = useCallback(
    (r: RouterProfile) => ({ host: r.host.trim(), port: Number(r.port) || 8728, tls: r.tls, username: r.username, password: passwords[r.id] ?? "" }),
    [passwords],
  );

  const saveRouter = () => {
    if (!editing) return;
    const e = { ...editing, host: editing.host.trim(), username: editing.username.trim(), name: editing.name.trim() };
    if (!e.host || !e.username) return setFlash({ tone: "bad", text: "Isi alamat router dan username dulu." });
    if (!e.id) {
      if (routers.length >= MAX_ROUTERS) return setFlash({ tone: "bad", text: `Maksimal ${MAX_ROUTERS} router.` });
      e.id = newId();
    }
    setFlash(null);
    setRouters((list) => (list.some((r) => r.id === e.id) ? list.map((r) => (r.id === e.id ? { ...e, pass: undefined } : r)) : [...list, { ...e, pass: undefined }]));
    // Password kosong saat mengubah = tetap memakai yang sudah ada.
    if (editing.pass) setPasswords((p) => ({ ...p, [e.id]: editing.pass as string }));
    if (!activeId) setActiveId(e.id);
    // Data koneksi berubah: sesi lama tidak berlaku lagi.
    setInfos((i) => {
      const { [e.id]: _drop, ...rest } = i;
      void _drop;
      return rest;
    });
    setEditing(null);
  };

  const removeRouter = (id: string) => {
    if (!window.confirm("Hapus router ini dari daftar?")) return;
    setRouters((list) => list.filter((r) => r.id !== id));
    setInfos((i) => {
      const { [id]: _drop, ...rest } = i;
      void _drop;
      return rest;
    });
    setPasswords((p) => {
      const { [id]: _drop, ...rest } = p;
      void _drop;
      return rest;
    });
    if (activeId === id) setActiveId(routers.find((r) => r.id !== id)?.id ?? "");
  };

  const connectRouter = async (r: RouterProfile) => {
    setFlash(null);
    if (passwords[r.id] === undefined || passwords[r.id] === "") {
      setEditing({ ...r, pass: "" });
      return setFlash({ tone: "warn", text: `Masukkan password untuk ${routerLabel(r)} lalu simpan.` });
    }
    setConnectingId(r.id);
    try {
      const res = await post<{ info: RouterInfo }>("/api/ai/router", { action: "connect", ...bodyFor(r) });
      if (!res.ok) return setFlash({ tone: "bad", text: `${routerLabel(r)}: ${res.data.error ?? "Gagal tersambung ke router."}` });
      setInfos((i) => ({ ...i, [r.id]: res.data.info }));
      if (!activeId) setActiveId(r.id);
      note(`Tersambung ke ${routerLabel(r)} · RouterOS ${res.data.info.version}`);
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setConnectingId("");
    }
  };

  const disconnectRouter = (r: RouterProfile) => {
    setInfos((i) => {
      const { [r.id]: _drop, ...rest } = i;
      void _drop;
      return rest;
    });
    note(`${routerLabel(r)} diputuskan.`);
  };

  /** Menjalankan daftar perintah di router aktif; hasilnya ditambahkan ke chat dan dikembalikan agar bisa dikirim ke AI. */
  const execCommands = async (commands: string[], opts: { confirmed: boolean }): Promise<Msg | null> => {
    if (!active || !info) {
      setFlash({ tone: "warn", text: "Sambungkan router dulu (Pengaturan > Router)." });
      return null;
    }
    const writes = commands.filter((l) => !isReadLine(l));
    const dangers = commands.filter(isDangerLine);
    if (writes.length && !opts.confirmed) {
      const ok = window.confirm(`Jalankan ${writes.length} perintah yang MENGUBAH konfigurasi di ${routerLabel(active)}?\n\n${writes.join("\n")}`);
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
        ...bodyFor(active),
        commands,
        confirmWrite: writes.length > 0,
        confirmDanger: dangers.length > 0,
      });
      if (!r.ok) return push(`Gagal menjalankan di ${routerLabel(active)}: ${r.data.error ?? "galat tidak diketahui"}`, true);
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
    setView("chat");
  };

  const openChat = (c: Conversation) => {
    if (busy) return;
    setConvId(c.id);
    setMessages(c.messages);
    setDone({});
    setFlash(null);
    setSidebar(false);
    setView("chat");
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
  const monitorTargets: MonitorTarget[] = routers.filter((r) => infos[r.id]).map((r) => ({ id: r.id, name: routerLabel(r), body: bodyFor(r) }));

  const block = "mb-4 rounded-[10px] border border-line bg-surface";
  const blockHead = "rounded-t-[10px] border-b border-line bg-raised px-4 py-2.5";

  const settings = (
    <>
      {flash && (
        <div className="mb-4">
          <Note tone={flash.tone}>{flash.text}</Note>
        </div>
      )}

      {/* ---------------------------------------------------------- koneksi AI */}
      <section className={block}>
        <h2 className={`${blockHead} text-[15px] font-semibold text-ink`}>Koneksi AI</h2>
        <div className="space-y-3 p-4">
          <Field label="Penyedia API">
            <Select
              value={ai.provider}
              placeholder=""
              onChange={(v) => {
                const p = AI_PROVIDERS.find((x) => x.id === v) ?? AI_PROVIDERS[0];
                setAi({ ...ai, provider: p.id, model: (models[p.id]?.[0] ?? p.models[0]) || "", baseUrl: p.id === "custom" ? ai.baseUrl : "" });
              }}
              options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
            />
          </Field>
          {ai.provider === "custom" && (
            <Field label="Base URL" hint="Harus https. Contoh: https://api.contoh.com/v1">
              <TextInput mono value={ai.baseUrl} onChange={(baseUrl) => setAi({ ...ai, baseUrl })} placeholder="https://api.contoh.com/v1" />
            </Field>
          )}
          <Field label="API key" hint={`Buat di ${provider.keyHint}`}>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput mono type={showKey ? "text" : "password"} value={ai.apiKey} onChange={(apiKey) => setAi({ ...ai, apiKey: apiKey.trim() })} placeholder="sk-…" />
              </div>
              <Button onClick={() => setShowKey((v) => !v)}>{showKey ? "Sembunyikan" : "Tampilkan"}</Button>
            </div>
          </Field>
          <Field
            label="Model"
            hint={
              models[ai.provider]?.length
                ? `${models[ai.provider]?.length} model tersedia dari ${provider.label}. Ketik untuk menyaring atau pilih dari daftar.`
                : "Saran bawaan. Tekan Muat semua model untuk melihat seluruh model yang bisa dipakai API key Anda."
            }
          >
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    list={modelListId}
                    value={ai.model}
                    onChange={(e) => setAi({ ...ai, model: e.target.value })}
                    spellCheck={false}
                    className="h-11 w-full rounded-none border-0 border-b border-line bg-transparent px-1 font-mono text-sm text-ink outline-none hover:border-brand/50 focus:border-brand focus:shadow-[0_1px_0_0_var(--color-brand)] sm:h-10"
                  />
                  <datalist id={modelListId}>
                    {modelList.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <Button onClick={loadModels} disabled={modelsBusy || (!ai.apiKey.trim() && ai.provider !== "openrouter")}>
                  {modelsBusy ? "Memuat…" : "Muat semua model"}
                </Button>
              </div>
            </>
          </Field>
          <p className="text-[11px] leading-relaxed text-faint">
            API key disimpan di browser ini saja. Server hanya meneruskannya ke penyedia AI saat Anda chat atau memuat daftar model dan tidak menyimpannya.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- router */}
      <section className={block}>
        <div className={`${blockHead} flex items-center justify-between gap-2`}>
          <h2 className="text-[15px] font-semibold text-ink">Router Mikrotik ({routers.length})</h2>
          {!editing && (
            <Button size="sm" onClick={() => setEditing({ ...BLANK_ROUTER, pass: "" })}>
              <Plus className="h-3.5 w-3.5" />
              Tambah router
            </Button>
          )}
        </div>
        <div className="space-y-3 p-4">
          {routers.length === 0 && !editing && (
            <p className="rounded-md border border-dashed border-line px-3 py-3 text-xs text-faint">Belum ada router. Tambahkan Mikrotik Anda (IP publik atau domain) lalu hubungkan. Bisa lebih dari satu.</p>
          )}

          {routers.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {routers.map((r) => {
                const i = infos[r.id];
                return (
                  <li key={r.id} className={`space-y-2 px-3 py-2.5 ${r.id === activeId ? "bg-brand/[0.06]" : ""}`}>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="active-router"
                        checked={r.id === activeId}
                        onChange={() => setActiveId(r.id)}
                        aria-label={`Jadikan ${routerLabel(r)} router aktif untuk chat`}
                        title="Router aktif untuk chat"
                        className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${i ? "bg-ok" : "bg-faint"}`} />
                          {routerLabel(r)}
                          {r.id === activeId && <span className="rounded-full bg-brand/15 px-1.5 text-[10px] font-semibold uppercase text-brand">aktif</span>}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted">
                          {r.username}@{r.host}:{r.port}
                          {r.tls ? " · TLS" : ""}
                        </p>
                        {i && (
                          <p className="truncate font-mono text-[11px] text-faint">
                            {i.identity} · RouterOS {i.version} · {i.board} · CPU {i.cpuLoad}%
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {i ? (
                        <Button size="sm" onClick={() => disconnectRouter(r)}>
                          Putuskan
                        </Button>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => connectRouter(r)} disabled={connectingId === r.id}>
                          <Terminal className="h-3.5 w-3.5" />
                          {connectingId === r.id ? "Menyambung…" : "Hubungkan"}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setEditing({ ...r, pass: passwords[r.id] ?? "" })} disabled={Boolean(i)} title={i ? "Putuskan dulu untuk mengubah" : "Ubah"}>
                        Ubah
                      </Button>
                      <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${routerLabel(r)}`} title="Hapus" onClick={() => removeRouter(r.id)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {editing && (
            <div className="space-y-3 rounded-md border border-brand/40 bg-brand/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-brand">{editing.id ? "Ubah router" : "Router baru"}</p>
              <Field label="Nama">
                <TextInput value={editing.name} onChange={(name) => setEditing({ ...editing, name })} placeholder="mis. Kantor Pusat" />
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                <Field label="IP publik / domain">
                  <TextInput mono value={editing.host} onChange={(host) => setEditing({ ...editing, host: host.replace(/\s+/g, "") })} placeholder="103.1.2.3 atau router.contoh.com" />
                </Field>
                <Field label="Port API">
                  <TextInput mono value={editing.port} onChange={(port) => setEditing({ ...editing, port: port.replace(/\D/g, "") })} placeholder="8728" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={editing.tls}
                  onChange={(e) => setEditing({ ...editing, tls: e.target.checked, port: e.target.checked && editing.port === "8728" ? "8729" : !e.target.checked && editing.port === "8729" ? "8728" : editing.port })}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                Pakai TLS (api-ssl, biasanya port 8729)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Username">
                  <TextInput mono value={editing.username} onChange={(username) => setEditing({ ...editing, username: username.trim() })} placeholder="ai-engineer" />
                </Field>
                <Field label="Password">
                  <TextInput mono type="password" value={editing.pass ?? ""} onChange={(pass) => setEditing({ ...editing, pass })} placeholder="••••••" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={editing.savePass} onChange={(e) => setEditing({ ...editing, savePass: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand)]" />
                Simpan password di browser ini (tidak disarankan di komputer bersama)
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={saveRouter}>
                  Simpan
                </Button>
                <Button onClick={() => setEditing(null)}>Batal</Button>
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-faint">
            Aktifkan <b>/ip service api</b> (atau api-ssl) dan batasi alamat yang diizinkan. Disarankan membuat user khusus di router dengan hak seperlunya. Router bertanda
            <b> aktif</b> menjadi sasaran perintah dari chat; semua router yang tersambung dipantau di tab Monitoring. Password tidak disimpan kecuali Anda mencentangnya.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- skill */}
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
            <div key={c.id} className={`group flex items-center border-b border-line ${c.id === convId && view === "chat" ? "bg-brand/10" : "hover:bg-brand/[0.05]"}`}>
              <button type="button" onClick={() => openChat(c)} className={`min-w-0 flex-1 px-4 py-2.5 text-left ${c.id === convId && view === "chat" ? "font-medium text-brand" : "text-ink"}`}>
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

          <div role="tablist" aria-label="Tampilan" className="inline-flex overflow-hidden rounded-md border border-line text-xs font-medium">
            {(
              [
                ["chat", "Chat"],
                ["monitor", `Monitoring${connectedCount ? ` (${connectedCount})` : ""}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`min-h-8 px-3 transition-colors ${view === id ? "bg-brand text-brand-ink" : "bg-surface text-muted hover:bg-raised hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "chat" && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
              <Wand className="h-4 w-4 shrink-0 text-brand" />
              <span className="max-w-[26vw] truncate">{messages.length ? convTitle(messages) : "AI Mikrotik Engineer"}</span>
            </span>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setDrawer(true)} className={`${chip} ${aiReady ? "border-brand/30 bg-brand/10 text-brand" : "border-warn/40 bg-warn/10 text-warn"}`}>
              {aiReady ? `${provider.label.split(" (")[0]} · ${ai.model}` : "Isi API key"}
            </button>
            {routers.length > 0 ? (
              <label className={`${chip} ${info ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-raised text-muted"}`} title="Router aktif untuk chat">
                <span className={`h-1.5 w-1.5 rounded-full ${info ? "bg-ok" : "bg-faint"}`} />
                <select
                  value={activeId}
                  onChange={(e) => setActiveId(e.target.value)}
                  aria-label="Router aktif"
                  className="max-w-[160px] cursor-pointer bg-transparent text-xs font-medium outline-none"
                >
                  {routers.map((r) => (
                    <option key={r.id} value={r.id} className="text-ink">
                      {routerLabel(r)}
                      {infos[r.id] ? " ●" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button type="button" onClick={() => setDrawer(true)} className={`${chip} border-line bg-raised text-muted`}>
                <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                Tambah router
              </button>
            )}
            {enabledSkills.length > 0 && <span className={`${chip} border-line bg-raised text-muted`}>{enabledSkills.length} skill</span>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {view === "chat" && (
              <label className="flex items-center gap-1.5 text-xs text-muted" title="Perintah print dijalankan otomatis dan hasilnya langsung dianalisis AI">
                <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                <span className="hidden sm:inline">Jalankan otomatis perintah baca</span>
                <span className="sm:hidden">Auto baca</span>
              </label>
            )}
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

        {view === "monitor" ? (
          <RouterMonitor targets={monitorTargets} />
        ) : (
          <>
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <div className="flex w-full max-w-[980px] flex-1 flex-col gap-2.5">
                {messages.length === 0 && (
                  <div className="space-y-4 py-8">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Wand className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="text-[17px] font-semibold text-ink">Tanya apa saja soal Mikrotik</h3>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                        Minta AI menjelaskan, menyusun script, atau memeriksa router. Perintah yang mengubah konfigurasi baru dijalankan setelah Anda menyetujuinya.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                      <div key={m.id} className={`max-w-[90%] self-start whitespace-pre-wrap rounded-full px-3 py-1 text-[13px] ${m.error ? "bg-bad/10 text-bad" : "bg-raised text-muted"}`}>
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
                                    title={info ? `Jalankan di ${active ? routerLabel(active) : "router"}` : "Sambungkan router dulu"}
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
                className="flex max-w-[980px] items-end gap-2"
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
          </>
        )}
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
