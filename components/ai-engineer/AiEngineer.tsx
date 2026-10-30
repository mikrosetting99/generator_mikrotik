"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DiagResult } from "@/lib/ai-routers";
import { ConnTest, type DiagState } from "@/components/ai-engineer/ConnTest";
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

/** Satu Mikrotik yang disimpan di server (password terenkripsi, tidak pernah dikirim balik). */
interface RouterProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  username: string;
}

/** Bentuk isian form router; password kosong saat mengubah = tetap memakai yang lama. */
interface RouterForm {
  id: string;
  name: string;
  host: string;
  port: string;
  tls: boolean;
  username: string;
  password: string;
}

type RouterState = "online" | "offline" | "auth" | "timeout" | "blocked" | "checking";

interface RouterStatus {
  id: string;
  state: RouterState;
  message: string;
  latencyMs: number;
  checkedAt: number;
  info?: RouterInfo;
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
  /** Router pemilik percakapan; "" = belum ada router. Tiap Mikrotik punya riwayat chat sendiri. */
  routerId?: string;
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
const ROUTERS_KEY = "ai-eng-routers-v2"; // format lama (di browser): diimpor ke server sekali lalu dihapus
const STATUS_EVERY_MS = 60_000;
const ACTIVE_KEY = "ai-eng-active-router-v1";
const SKILLS_KEY = "ai-eng-skills-v1";
const CONVS_KEY = "ai-eng-convs-v1";
const MODELS_KEY = "ai-eng-models-v1";
const MAX_CONVS = 30;
const VIEW_LABEL = { chat: "Chat", monitor: "Monitoring", routers: "Mikrotik", ai: "Koneksi AI", skills: "Skill" } as const;
const MAX_STORED_MESSAGES = 80;
const MAX_AUTO_STEPS = 4;
const SKILLS_CHAR_LIMIT = 90_000;

const DEFAULT_AI: AiSettings = { provider: "anthropic", model: AI_PROVIDERS[0].models[0], apiKey: "", baseUrl: "" };
const BLANK_ROUTER: RouterForm = { id: "", name: "", host: "", port: "8728", tls: false, username: "", password: "" };

const FULL_CHECK =
  "Lakukan pemeriksaan lengkap router ini: identity dan versi, resource (CPU, memori, disk), interface dan trafik, IP address dan route, DHCP, firewall dan NAT, serta log error terbaru. Lalu ringkas masalah yang ditemukan dan beri rekomendasi.";

const STARTERS = [
  FULL_CHECK,
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

/** Pesan galat berbahasa Indonesia untuk kode HTTP, dipakai bila server tidak memberi pesan sendiri. */
function httpMessage(status: number): string {
  if (status === 401) return "Sesi login berakhir. Muat ulang halaman, login kembali, lalu kirim lagi.";
  if (status === 429) return "Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar lalu coba lagi.";
  if (status === 502 || status === 503 || status === 504) return `Server memutus permintaan karena terlalu lama (HTTP ${status}). Coba lagi sebentar lagi.`;
  return `Gagal memproses permintaan (HTTP ${status}). Silakan coba lagi.`;
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !data.error) data.error = httpMessage(res.status);
  return { ok: res.ok, status: res.status, data };
}

/* ------------------------------------------------------------- rencana perubahan */

type Risk = "low" | "medium" | "high";

/** Tingkat risiko sebuah rencana perubahan: tinggi bila bisa memutus akses atau menghapus/menonaktifkan hal penting. */
function planRisk(cmds: string[]): Risk {
  const high =
    cmds.some(isDangerLine) ||
    cmds.some((l) => /\b(remove|disable)\b/.test(l) && /^\/(ip\s+firewall|interface|ip\s+address|ip\/address|ip\s+route|routing|ip\s+dhcp-server)/.test(l)) ||
    cmds.some((l) => /chain=input/.test(l) && /action=(drop|reject)/.test(l));
  if (high) return "high";
  if (cmds.some((l) => /(^|\s)(set|remove|disable|enable|move|unset)(\s|$)/.test(l))) return "medium";
  return "low";
}

const RISK_LABEL: Record<Risk, string> = { low: "rendah", medium: "sedang", high: "tinggi" };
const RISK_BORDER: Record<Risk, string> = { low: "border-l-accent", medium: "border-l-warn", high: "border-l-bad" };

const backupName = () => {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `ai-engineer-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
};

interface PlanState {
  status: "applying" | "done" | "failed" | "rejected";
  backup?: string;
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

const routerLabel = (r: { name: string; host: string }) => r.name.trim() || r.host || "Router";

/** Teks dan warna lencana status koneksi sebuah router. */
function statusBadge(st: { state: RouterState } | null | undefined): { label: string; cls: string; dot: string } {
  switch (st?.state) {
    case "online":
      return { label: "Tersambung", cls: "bg-ok/15 text-ok", dot: "bg-ok" };
    case "offline":
      return { label: "Offline", cls: "bg-bad/15 text-bad", dot: "bg-bad" };
    case "timeout":
      return { label: "Tidak merespons", cls: "bg-bad/15 text-bad", dot: "bg-bad" };
    case "auth":
      return { label: "Login gagal", cls: "bg-warn/15 text-warn", dot: "bg-warn" };
    case "blocked":
      return { label: "Alamat ditolak", cls: "bg-warn/15 text-warn", dot: "bg-warn" };
    case "checking":
      return { label: "Memeriksa…", cls: "bg-raised text-muted", dot: "animate-pulse bg-faint" };
    default:
      return { label: "Belum diperiksa", cls: "bg-raised text-muted", dot: "bg-faint" };
  }
}

/* ---------------------------------------------------------------- komponen */

export function AiEngineer() {
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState<AiSettings>(DEFAULT_AI);
  const [models, setModels] = useState<Partial<Record<AiProviderId, string[]>>>({});
  const [modelsBusy, setModelsBusy] = useState(false);

  const [routers, setRouters] = useState<RouterProfile[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RouterStatus>>({});
  const [activeId, setActiveId] = useState("");
  const [editing, setEditing] = useState<RouterForm | null>(null);
  const [routerBusy, setRouterBusy] = useState(false);
  const [diag, setDiag] = useState<Record<string, DiagState>>({});
  const [checking, setChecking] = useState(false);
  const routersRef = useRef<RouterProfile[]>([]);
  routersRef.current = routers;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillRef, setSkillRef] = useState("");
  const [skillBusy, setSkillBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "warn" | "bad"; text: string } | null>(null);

  const [view, setView] = useState<"chat" | "monitor" | "routers" | "ai" | "skills">("chat");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState(() => newId());
  const [convRouter, setConvRouter] = useState("");
  const [navSlot, setNavSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setNavSlot(document.getElementById("ai-nav-slot")), []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRead, setAutoRead] = useState(true);
  const [done, setDone] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [plans, setPlans] = useState<Record<string, PlanState>>({});
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [autoBackup, setAutoBackup] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; tone: "info" | "warn" | "bad" | "ok"; text: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;

  /** Pemberitahuan singkat di pojok kanan bawah; hilang sendiri (galat lebih lama). */
  const toast = useCallback((text: string, tone: "info" | "warn" | "bad" | "ok" = "info") => {
    const id = newId();
    setToasts((t) => [...t, { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 8000 : 4500);
  }, []);

  useEffect(() => {
    setAi(load(AI_KEY, DEFAULT_AI));
    try {
      const m = window.localStorage.getItem(MODELS_KEY);
      if (m) setModels(JSON.parse(m));
      const raw = window.localStorage.getItem(SKILLS_KEY);
      if (raw) setSkills(JSON.parse(raw));
      const c = window.localStorage.getItem(CONVS_KEY);
      if (c) setConvs(JSON.parse(c));

      setActiveId(window.localStorage.getItem(ACTIVE_KEY) ?? "");
    } catch {
      // abaikan simpanan rusak
    }
    setReady(true);
    void initRouters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready) save(AI_KEY, ai);
  }, [ai, ready]);
  useEffect(() => {
    if (ready) save(MODELS_KEY, models);
  }, [models, ready]);
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
      const conv: Conversation = { id: convId, routerId: convRouter, title: convTitle(messages), updatedAt: Date.now(), messages: messages.slice(-MAX_STORED_MESSAGES) };
      return [conv, ...rest].slice(0, MAX_CONVS * 4);
    });
  }, [messages, convId, convRouter, ready]);
  // Chat kosong selalu milik router yang sedang dipilih.
  useEffect(() => {
    if (messages.length === 0) setConvRouter(activeId);
  }, [messages.length, activeId]);

  const provider = AI_PROVIDERS.find((p) => p.id === ai.provider) ?? AI_PROVIDERS[0];
  const modelList = models[ai.provider]?.length ? (models[ai.provider] as string[]) : provider.models;
  const enabledSkills = skills.filter((s) => s.enabled);
  const skillChars = enabledSkills.reduce((n, s) => n + s.content.length, 0);

  const active = routers.find((r) => r.id === activeId) ?? null;
  const activeStatus = active ? statuses[active.id] : undefined;
  const info = activeStatus?.state === "online" ? (activeStatus.info ?? null) : null;
  const routerInfoText = info
    ? `nama=${routerLabel(active as RouterProfile)} identity=${info.identity} versi RouterOS=${info.version} board=${info.board} uptime=${info.uptime} cpu-load=${info.cpuLoad}%`
    : "";
  const onlineRouters = routers.filter((r) => statuses[r.id]?.state === "online");
  const connectedCount = onlineRouters.length;


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

  const bodyFor = useCallback((r: RouterProfile) => ({ routerId: r.id }), []);

  /** Memeriksa tersambung atau tidaknya router (kosong = semua) dan memperbarui lencana statusnya. */
  const checkStatuses = useCallback(async (ids?: string[]) => {
    const targets = ids ?? routersRef.current.map((r) => r.id);
    if (targets.length === 0) return;
    setChecking(true);
    setStatuses((s) => {
      const next = { ...s };
      for (const id of targets) next[id] = { ...(s[id] ?? { id, message: "", latencyMs: 0, checkedAt: 0 }), state: s[id]?.state === "online" ? "online" : "checking" };
      return next;
    });
    try {
      const r = await post<{ statuses: RouterStatus[] }>("/api/ai/routers/status", { ids: targets });
      if (r.ok && r.data.statuses) setStatuses((s) => ({ ...s, ...Object.fromEntries(r.data.statuses.map((x) => [x.id, x])) }));
    } catch {
      // jaringan putus: status lama dipertahankan
    } finally {
      setChecking(false);
    }
  }, []);

  /** Memuat daftar router dari server (dan mengimpor router lama dari browser sekali saja), lalu memeriksa statusnya. */
  const initRouters = async () => {
    try {
      let res = await fetch("/api/ai/routers", { cache: "no-store" });
      let list: RouterProfile[] = res.ok ? ((await res.json()) as { routers: RouterProfile[] }).routers : [];
      const old = window.localStorage.getItem(ROUTERS_KEY);
      if (old && list.length === 0) {
        try {
          const legacy = JSON.parse(old) as Array<{ name?: string; host?: string; port?: string; tls?: boolean; username?: string; pass?: string }>;
          for (const o of legacy.filter((x) => x.host && x.username && x.pass)) {
            await post("/api/ai/routers", { name: o.name, host: o.host, port: o.port, tls: o.tls, username: o.username, password: o.pass });
          }
          res = await fetch("/api/ai/routers", { cache: "no-store" });
          list = res.ok ? ((await res.json()) as { routers: RouterProfile[] }).routers : [];
        } catch {
          // impor gagal: abaikan
        }
      }
      if (old) window.localStorage.removeItem(ROUTERS_KEY);
      setRouters(list);
      routersRef.current = list;
      const act = window.localStorage.getItem(ACTIVE_KEY) ?? "";
      const chosen = list.some((r) => r.id === act) ? act : (list[0]?.id ?? "");
      setActiveId(chosen);
      // Riwayat lama (sebelum chat dipisah per router) dipindahkan ke router yang aktif.
      setConvs((cs) => cs.map((c) => (c.routerId === undefined ? { ...c, routerId: chosen } : c)));
      void checkStatuses(list.map((r) => r.id));
    } catch {
      // server tidak terjangkau
    }
  };

  // Status diperiksa ulang berkala selama halaman terbuka.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void checkStatuses();
    }, STATUS_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [ready, checkStatuses]);

  const formBody = (f: RouterForm) => ({ name: f.name, host: f.host, port: Number(f.port) || 8728, tls: f.tls, username: f.username, password: f.password });

  const saveRouter = async () => {
    if (!editing) return;
    setFlash(null);
    setRouterBusy(true);
    try {
      const r = editing.id
        ? await fetch(`/api/ai/routers/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formBody(editing)) })
        : await fetch("/api/ai/routers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formBody(editing)) });
      const data = (await r.json().catch(() => ({}))) as { router?: RouterProfile; error?: string };
      if (!r.ok || !data.router) return setFlash({ tone: "bad", text: data.error ?? "Gagal menyimpan router." });
      const saved = data.router;
      setRouters((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]));
      routersRef.current = routersRef.current.some((x) => x.id === saved.id) ? routersRef.current.map((x) => (x.id === saved.id ? saved : x)) : [...routersRef.current, saved];
      if (!activeId) setActiveId(saved.id);
      setEditing(null);
      clearDiag("form");
      setFlash({ tone: "info", text: `${saved.name} disimpan. Memeriksa koneksi…` });
      void checkStatuses([saved.id]);
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setRouterBusy(false);
    }
  };

  const clearDiag = (key: string) =>
    setDiag((d) => {
      const { [key]: _drop, ...rest } = d;
      void _drop;
      return rest;
    });

  /** Test koneksi API langkah demi langkah ("form" = isian form, selain itu = id router tersimpan). */
  const runDiag = async (key: string) => {
    let body: Record<string, unknown>;
    if (key === "form") {
      if (!editing) return;
      body = { test: formBody(editing), id: editing.id || undefined, diagnose: true };
    } else body = { id: key, diagnose: true };
    setDiag((d) => ({ ...d, [key]: { busy: true } }));
    try {
      const r = await post<{ diagnosis: DiagResult }>("/api/ai/routers/status", body);
      setDiag((d) => ({ ...d, [key]: r.ok && r.data.diagnosis ? { busy: false, result: r.data.diagnosis } : { busy: false, error: r.data.error ?? httpMessage(r.status) } }));
    } catch {
      setDiag((d) => ({ ...d, [key]: { busy: false, error: "Gagal menghubungi server." } }));
    }
  };
  const removeRouter = async (r: RouterProfile) => {
    if (!window.confirm(`Hapus ${routerLabel(r)} dari daftar?`)) return;
    await fetch(`/api/ai/routers/${r.id}`, { method: "DELETE" }).catch(() => undefined);
    setRouters((list) => list.filter((x) => x.id !== r.id));
    setStatuses((s) => {
      const { [r.id]: _drop, ...rest } = s;
      void _drop;
      return rest;
    });
    setConvs((cs) => cs.filter((c) => c.routerId !== r.id));
    if (activeId === r.id) selectRouter(routers.find((x) => x.id !== r.id)?.id ?? "", true);
  };
  /** Menjalankan daftar perintah di router aktif; hasilnya ditambahkan ke chat dan dikembalikan agar bisa dikirim ke AI. */
  const execCommands = async (commands: string[], opts: { confirmed: boolean; approved?: boolean }): Promise<Msg | null> => {
    if (!active || !info) {
      setFlash({ tone: "warn", text: "Sambungkan router dulu di tab Mikrotik." });
      return null;
    }
    if (convRouter !== active.id) {
      setFlash({ tone: "bad", text: "Chat ini milik Mikrotik lain. Satu chat hanya boleh menjalankan perintah di satu Mikrotik." });
      return null;
    }
    const writes = commands.filter((l) => !isReadLine(l));
    const dangers = commands.filter(isDangerLine);
    if (writes.length && !opts.confirmed && !opts.approved) {
      const ok = window.confirm(`Jalankan ${writes.length} perintah yang MENGUBAH konfigurasi di ${routerLabel(active)}?\n\n${writes.join("\n")}`);
      if (!ok) return null;
    }
    if (dangers.length && !opts.approved) {
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
      setFlash({ tone: "bad", text: "Isi API key AI dulu di tab Koneksi AI." });
      setView("ai");
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

  /** Setujui rencana: buat backup di router (bila dipilih), terapkan perubahan, lalu kirim hasilnya ke AI. */
  const applyPlan = async (key: string, commands: string[]) => {
    if (busy || !active) return;
    const name = autoBackup ? backupName() : "";
    setPlans((p) => ({ ...p, [key]: { status: "applying", backup: name || undefined } }));
    setBusy(true);
    const before = messagesRef.current;
    const list = name ? [`/system backup save name=${name}`, ...commands] : commands;
    const resultMsg = await execCommands(list, { confirmed: true, approved: true });
    setBusy(false);
    if (!resultMsg) {
      setPlans((p) => ({ ...p, [key]: { status: "failed", backup: name || undefined } }));
      return;
    }
    setPlans((p) => ({ ...p, [key]: { status: resultMsg.error ? "failed" : "done", backup: name || undefined } }));
    if (resultMsg.error) toast("Perubahan tidak seluruhnya diterapkan. Lihat hasil di router.", "bad");
    else toast(name ? `Perubahan diterapkan. Backup: ${name}.backup` : "Perubahan diterapkan.", "ok");
    await converse([...before, resultMsg]);
  };

  const rejectPlan = (key: string) => {
    setPlans((p) => ({ ...p, [key]: { status: "rejected" } }));
    toast("Rencana ditolak. Tidak ada perubahan yang diterapkan.", "info");
  };

  const stop = () => abortRef.current?.abort();

  /** Memilih router untuk chat: tiap router punya riwayat sendiri, jadi chat ikut berganti. */
  const selectRouter = (id: string, force = false) => {
    if (id === activeId) return;
    if (busy && !force) {
      toast("Tunggu AI selesai sebelum berganti router.", "warn");
      return;
    }
    setActiveId(id);
    const last = convs.find((c) => (c.routerId ?? "") === id && c.messages.length > 0);
    setConvId(last?.id ?? newId());
    setConvRouter(id);
    setMessages(last?.messages ?? []);
    setDone({});
    setPlans({});
    setFlash(null);
  };

  const newChat = () => {
    if (busy) return;
    setConvRouter(activeId);
    setConvId(newId());
    setMessages([]);
    setDone({});
    setFlash(null);
    setSidebar(false);
    setView("chat");
  };

  const openChat = (c: Conversation) => {
    if (busy) return;
    setConvRouter(c.routerId ?? "");
    if ((c.routerId ?? "") !== activeId) setActiveId(c.routerId ?? "");
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
      toast("Script disalin.", "ok");
    } catch {
      toast("Gagal menyalin. Pilih teks lalu salin manual.", "warn");
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
  const draftRows = Math.min(6, Math.max(1, draft.split("\n").length));
  const monitorTargets: MonitorTarget[] = onlineRouters.map((r) => ({ id: r.id, name: routerLabel(r), body: bodyFor(r) }));

  const block = "mb-4 rounded-[10px] border border-line bg-surface";
  const blockHead = "rounded-t-[10px] border-b border-line bg-raised px-4 py-2.5";

  const aiSection = (
      <section className={block}>
        <h2 className={`${blockHead} text-[15px] font-semibold text-ink`}>Koneksi AI</h2>
        <div className="space-y-3 p-4">
          <Field label="Penyedia API">
            <div role="radiogroup" aria-label="Penyedia API" className="grid gap-1.5 sm:grid-cols-2">
              {AI_PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${ai.provider === p.id ? "border-brand bg-brand/10 font-medium text-brand" : "border-line bg-surface text-ink hover:bg-raised"}`}
                >
                  <input
                    type="radio"
                    name="ai-provider"
                    checked={ai.provider === p.id}
                    onChange={() => setAi({ ...ai, provider: p.id, model: (models[p.id]?.[0] ?? p.models[0]) || "", baseUrl: p.id === "custom" ? ai.baseUrl : "" })}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>          {ai.provider === "custom" && (
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
                ? `${models[ai.provider]?.length} model tersedia dari ${provider.label}.`
                : "Saran bawaan. Tekan Muat semua model untuk melihat seluruh model yang bisa dipakai API key Anda."
            }
          >
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={modelList.includes(ai.model) ? ai.model : "__custom"}
                    placeholder=""
                    onChange={(v) => setAi({ ...ai, model: v === "__custom" ? "" : v })}
                    options={[...modelList.map((m) => ({ value: m, label: m })), { value: "__custom", label: "Lainnya (ketik nama model sendiri)" }]}
                  />
                </div>
                <Button onClick={loadModels} disabled={modelsBusy || (!ai.apiKey.trim() && ai.provider !== "openrouter")}>
                  {modelsBusy ? "Memuat…" : "Muat semua model"}
                </Button>
              </div>
              {!modelList.includes(ai.model) && (
                <TextInput mono value={ai.model} onChange={(model) => setAi({ ...ai, model: model.trim() })} placeholder="nama model, mis. gpt-4o-mini" />
              )}
            </div>
          </Field>          <p className="text-[11px] leading-relaxed text-faint">
            API key disimpan di browser ini saja. Server hanya meneruskannya ke penyedia AI saat Anda chat atau memuat daftar model dan tidak menyimpannya.
          </p>
        </div>
      </section>
  );

  const routersSection = (
      <section className={block}>
        <div className={`${blockHead} flex items-center justify-between gap-2`}>
          <h2 className="text-[15px] font-semibold text-ink">Router Mikrotik ({routers.length})</h2>
          <div className="flex gap-2">
            {routers.length > 0 && (
              <Button size="sm" onClick={() => checkStatuses()} disabled={checking}>
                {checking ? "Memeriksa…" : "Periksa semua"}
              </Button>
            )}
            {!editing && (
              <Button size="sm" variant="primary" onClick={() => { setEditing({ ...BLANK_ROUTER }); clearDiag("form"); }}>
                <Plus className="h-3.5 w-3.5" />
                Tambah Mikrotik
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-3 p-4">
          {routers.length === 0 && !editing && (
            <p className="rounded-md border border-dashed border-line px-3 py-3 text-xs text-faint">
              Belum ada Mikrotik. Tambahkan IP publik atau domain-nya; router disimpan di akun Anda dan statusnya (tersambung atau tidak) diperiksa otomatis tiap menit.
            </p>
          )}

          {editing && (
            <div className="space-y-3 rounded-md border border-brand/40 bg-brand/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.09em] text-brand">{editing.id ? "Ubah Mikrotik" : "Mikrotik baru"}</p>
              <Field label="Nama">
                <TextInput value={editing.name} onChange={(name) => setEditing({ ...editing, name })} placeholder="mis. Kantor Pusat" />
              </Field>
              <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                <Field label="IP publik / domain" required>
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
                <Field label="Username" required>
                  <TextInput mono value={editing.username} onChange={(username) => setEditing({ ...editing, username: username.trim() })} placeholder="ai-engineer" />
                </Field>
                <Field label="Password" required={!editing.id} hint={editing.id ? "Kosongkan untuk tetap memakai password lama." : undefined}>
                  <TextInput mono type="password" value={editing.password} onChange={(password) => setEditing({ ...editing, password })} placeholder="••••••" />
                </Field>
              </div>
              {diag.form && <ConnTest state={diag.form} />}
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={saveRouter} disabled={routerBusy}>
                  {routerBusy ? "Memproses…" : "Simpan"}
                </Button>
                <Button onClick={() => runDiag("form")} disabled={routerBusy || diag.form?.busy}>
                  Test koneksi API
                </Button>
                <Button onClick={() => { setEditing(null); clearDiag("form"); }}>Batal</Button>
              </div>
            </div>
          )}

          {routers.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
              {routers.map((r) => {
                const st = statuses[r.id];
                const badge = statusBadge(st);
                return (
                  <li key={r.id} className={`space-y-2 px-3 py-2.5 ${r.id === activeId ? "bg-brand/[0.06]" : ""}`}>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="active-router"
                        checked={r.id === activeId}
                        onChange={() => selectRouter(r.id)}
                        aria-label={`Jadikan ${routerLabel(r)} router aktif untuk chat`}
                        title="Router aktif untuk chat"
                        className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                          <span className="truncate">{routerLabel(r)}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold ${badge.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                            {st?.state === "online" && st.latencyMs > 0 ? ` · ${st.latencyMs} ms` : ""}
                          </span>
                          {r.id === activeId && <span className="rounded-full bg-brand/15 px-1.5 text-[10px] font-semibold uppercase text-brand">aktif</span>}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted">
                          {r.username}@{r.host}:{r.port}
                          {r.tls ? " · TLS" : ""}
                        </p>
                        {st?.state === "online" && st.info && (
                          <p className="truncate font-mono text-[11px] text-faint">
                            {st.info.identity} · RouterOS {st.info.version} · {st.info.board} · CPU {st.info.cpuLoad}%
                          </p>
                        )}
                        {st && st.state !== "online" && st.state !== "checking" && <p className="text-[11px] text-bad">{st.message}</p>}
                        {st && st.checkedAt > 0 && <p className="text-[10px] text-faint">Diperiksa {new Date(st.checkedAt).toLocaleTimeString("id-ID")}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" onClick={() => checkStatuses([r.id])} disabled={st?.state === "checking"}>
                        Periksa
                      </Button>
                      <Button size="sm" onClick={() => runDiag(r.id)} disabled={diag[r.id]?.busy}>
                        Test koneksi API
                      </Button>
                      <Button size="sm" onClick={() => { setEditing({ id: r.id, name: r.name, host: r.host, port: String(r.port), tls: r.tls, username: r.username, password: "" }); clearDiag("form"); }}>
                        Ubah
                      </Button>
                      <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${routerLabel(r)}`} title="Hapus" onClick={() => removeRouter(r)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {diag[r.id] && <ConnTest state={diag[r.id]} />}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] leading-relaxed text-faint">
            Aktifkan <b>/ip service api</b> (atau api-ssl) dan izinkan IP server aplikasi ini. Disarankan membuat user khusus di router dengan hak seperlunya. Password disimpan
            terenkripsi di server dan tidak pernah dikirim kembali ke browser. Router bertanda <b>aktif</b> menjadi sasaran perintah dari chat; semua router yang online
            dipantau di menu Monitoring.
          </p>
        </div>
      </section>
  );

  const skillsSection = (
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
  );


  const routerConvs = convs.filter((c) => (c.routerId ?? "") === activeId).slice(0, MAX_CONVS);

  const sidebarEl = (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-raised">
      <div className="grid gap-2 border-b border-line p-3">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.09em] text-muted" title="Tiap Mikrotik punya riwayat chat sendiri">
          {active ? routerLabel(active) : "Tanpa router"}
        </p>
        <Button variant="primary" onClick={newChat} disabled={busy}>
          <Plus className="h-4 w-4" />
          Percakapan baru
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Riwayat percakapan">
        {routerConvs.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-faint">{active ? `Belum ada percakapan untuk ${routerLabel(active)}.` : "Riwayat percakapan akan muncul di sini."}</p>
        ) : (
          routerConvs.map((c) => (
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
    </aside>
  );

  const navItems = [
    ["chat", "Chat"],
    ["monitor", `Monitoring${connectedCount ? ` (${connectedCount})` : ""}`],
    ["routers", `Mikrotik (${routers.length})`],
    ["ai", "Koneksi AI"],
    ["skills", `Skill${skills.length ? ` (${skills.length})` : ""}`],
  ] as const;
  // Menu aplikasi ditaruh di bilah atas (seperti menu bagian di Odoo).
  const navbar =
    navSlot &&
    createPortal(
      navItems.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-current={view === id ? "page" : undefined}
          onClick={() => setView(id)}
          className={`h-[46px] shrink-0 px-3 text-sm transition-colors ${view === id ? "bg-black/15 font-medium text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
        >
          {label}
        </button>
      )),
      navSlot,
    );
  return (
    <div className={`relative grid h-[calc(100dvh-46px)] min-h-[480px] ${view === "chat" ? "xl:grid-cols-[270px_minmax(0,1fr)]" : ""}`}>
      {navbar}
      {/* ----------------------------------------------------- riwayat (kiri) */}
      {view === "chat" && <div className="hidden min-h-0 xl:block">{sidebarEl}</div>}
      {view === "chat" && sidebar && (
        <div className="absolute inset-0 z-30 xl:hidden">
          <button type="button" aria-label="Tutup riwayat" className="absolute inset-0 bg-black/40" onClick={() => setSidebar(false)} />
          <div className="relative h-full w-[290px] max-w-[85vw] shadow-xl">{sidebarEl}</div>
        </div>
      )}

      {/* ------------------------------------------------------------ chat */}
      <section className="flex min-h-0 min-w-0 flex-col bg-surface">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2">
          {view === "chat" && (
            <button
              type="button"
              onClick={() => setSidebar(true)}
              className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2.5 text-xs text-muted hover:text-ink xl:hidden"
            >
              Riwayat
              <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
            </button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setView("routers");
              setEditing({ ...BLANK_ROUTER });
              clearDiag("form");
            }}
          >
            Tambah Mikrotik
          </Button>
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-muted">{VIEW_LABEL[view]}</span>
            {routers.length > 0 && (view === "chat" || view === "monitor") && view === "chat" && (
              <>
                <span className="text-faint">/</span>
                <label className="flex items-center gap-1.5" title={`Satu chat untuk satu Mikrotik · ${statusBadge(activeStatus).label}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusBadge(activeStatus).dot}`} />
                  <select
                    value={activeId}
                    onChange={(e) => selectRouter(e.target.value)}
                    aria-label="Mikrotik untuk chat ini"
                    className="max-w-[200px] cursor-pointer truncate bg-transparent font-medium text-ink outline-none"
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.id} className="text-ink">
                        {routerLabel(r)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          {view === "chat" && (
            <label className="ml-auto flex items-center gap-1.5 text-xs text-muted" title="Perintah print dijalankan otomatis dan hasilnya langsung dianalisis AI">
              <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
              <span>Baca otomatis</span>
            </label>
          )}
        </header>

        {flash && (
          <div className="border-b border-line px-4 py-2">
            <Note tone={flash.tone}>{flash.text}</Note>
          </div>
        )}

        {view === "routers" || view === "ai" || view === "skills" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
            <div className="mx-auto w-full max-w-[860px]">{view === "routers" ? routersSection : view === "ai" ? aiSection : skillsSection}</div>
          </div>
        ) : view === "monitor" ? (
          <RouterMonitor
            targets={monitorTargets}
            statusList={routers.map((r) => ({ id: r.id, name: routerLabel(r), host: r.host, state: statuses[r.id]?.state ?? "checking", message: statuses[r.id]?.message ?? "", latencyMs: statuses[r.id]?.latencyMs ?? 0, checkedAt: statuses[r.id]?.checkedAt ?? 0 }))}
            onCheck={() => checkStatuses()}
            checking={checking}
          />
        ) : (
          <>
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-2.5">
                {messages.length === 0 && (
                  <div className="space-y-4 px-2 py-12 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Wand className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="text-[17px] font-semibold text-ink">{active ? `Chat dengan ${routerLabel(active)}` : "Tanya apa saja soal Mikrotik"}</h3>
                      <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-muted">
                        Minta AI menjelaskan, menyusun script, atau memeriksa router. Perintah yang mengubah konfigurasi baru dijalankan setelah Anda menyetujuinya.
                      </p>
                    </div>
                    {!aiReady && (
                      <p className="text-sm text-warn">
                        API key AI belum diisi.{" "}
                        <button type="button" onClick={() => setView("ai")} className="font-medium underline">
                          Buka Koneksi AI
                        </button>
                      </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void send(s)}
                          className="rounded-full border border-line bg-surface px-3 py-1.5 text-center text-xs text-muted transition-colors hover:border-brand/50 hover:text-brand"
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
                      className={`max-w-[85%] self-start break-words rounded-xl rounded-bl-[4px] border px-3.5 py-2.5 leading-relaxed ${m.error ? "border-bad/30 bg-bad/10 text-bad" : "border-line bg-canvas text-ink"}`}
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
                        if (writes > 0) {
                          const risk = planRisk(cmds);
                          const st = plans[key];
                          return (
                            <div key={i} className={`my-2 rounded-md border border-l-4 border-line bg-surface p-3 text-ink ${RISK_BORDER[risk]}`}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">Rencana perubahan</span>
                                <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${risk === "high" ? "bg-bad/15 text-bad" : risk === "medium" ? "bg-warn/15 text-warn" : "bg-accent/15 text-accent"}`}>
                                  risiko {RISK_LABEL[risk]}
                                </span>
                                <span className="text-xs text-muted">
                                  {cmds.length} perintah{active ? ` · ${routerLabel(active)}` : ""}
                                </span>
                              </div>
                              <pre className="my-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[#1f2933] px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-[#e5e7eb]">{seg.code}</pre>
                              {!st ? (
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 text-xs text-muted">
                                    <input type="checkbox" checked={autoBackup} onChange={(e) => setAutoBackup(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                                    Buat backup otomatis di router sebelum menerapkan
                                  </label>
                                  {risk === "high" && (
                                    <label className="flex items-start gap-2 text-xs text-bad">
                                      <input type="checkbox" checked={Boolean(ack[key])} onChange={(e) => setAck((a) => ({ ...a, [key]: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                                      Saya mengerti perubahan ini berisiko memutus akses atau menghapus konfigurasi.
                                    </label>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    <Button variant="primary" size="sm" disabled={busy || !info || (risk === "high" && !ack[key])} onClick={() => applyPlan(key, cmds)}>
                                      Setujui &amp; terapkan
                                    </Button>
                                    <Button size="sm" onClick={() => rejectPlan(key)} disabled={busy}>
                                      Tolak
                                    </Button>
                                    <Button size="sm" onClick={() => copy(key, seg.code)}>
                                      {copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                      Salin
                                    </Button>
                                  </div>
                                  {!info && <p className="text-xs text-warn">Sambungkan router dulu untuk menerapkan rencana ini.</p>}
                                </div>
                              ) : (
                                <p className={`text-[13px] ${st.status === "failed" ? "text-bad" : st.status === "rejected" ? "text-muted" : "text-ink"}`}>
                                  {st.status === "applying" && (
                                    <>
                                      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent align-[-2px]" />
                                      Membuat backup &amp; menerapkan perubahan…
                                    </>
                                  )}
                                  {st.status === "done" && `Diterapkan${st.backup ? ` · backup ${st.backup}.backup` : ""}.`}
                                  {st.status === "failed" && "Gagal diterapkan. Lihat hasil di router di bawah."}
                                  {st.status === "rejected" && "Ditolak. Tidak ada perubahan yang diterapkan."}
                                </p>
                              )}
                            </div>
                          );
                        }
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
                    {info ? "AI sedang memeriksa router… (pemeriksaan lengkap bisa 1–2 menit)" : "AI sedang bekerja…"}
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
          </>
        )}
      </section>

      {/* ------------------------------------------------------------- toast */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex flex-col gap-2 max-sm:left-3 max-sm:right-3" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "bad" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-md border bg-surface px-3 py-2.5 text-sm text-ink shadow-lg ${t.tone === "bad" ? "border-bad/40" : t.tone === "ok" ? "border-ok/40" : t.tone === "warn" ? "border-warn/40" : "border-line"}`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.tone === "bad" ? "bg-bad" : t.tone === "ok" ? "bg-ok" : t.tone === "warn" ? "bg-warn" : "bg-brand"}`} />
            <span className="min-w-0 break-words">{t.text}</span>
            <button type="button" aria-label="Tutup" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-1 text-faint hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
