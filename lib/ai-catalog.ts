/** Daftar penyedia AI (aman dipakai di browser dan server). */

export type AiProviderId = "anthropic" | "openai" | "gemini" | "openrouter" | "deepseek" | "groq" | "custom";

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  kind: "anthropic" | "openai";
  baseUrl: string;
  models: string[];
  /** Petunjuk tempat membuat API key. */
  keyHint: string;
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
    keyHint: "console.anthropic.com → API keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
    keyHint: "platform.openai.com → API keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    keyHint: "aistudio.google.com → Get API key",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["anthropic/claude-sonnet-4.5", "openai/gpt-4o", "google/gemini-2.0-flash-001", "deepseek/deepseek-chat"],
    keyHint: "openrouter.ai → Keys",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "platform.deepseek.com → API keys",
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyHint: "console.groq.com → API Keys",
  },
  {
    id: "custom",
    label: "Lainnya (OpenAI-compatible)",
    kind: "openai",
    baseUrl: "",
    models: [],
    keyHint: "API key dari penyedia Anda; isi Base URL, mis. https://host/v1",
  },
];
