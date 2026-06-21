// Raooza OS - AI Providers configuration (CLIENT-SAFE - no SDK imports)

import type { AIProvider } from "@/stores/settingsStore";

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  defaultModel: string;
  models: string[];
  apiKeyUrl: string;
  // OpenAI-compatible base URL for user-provided keys (empty for SDK-only)
  baseUrl: string;
}

// If Vercel frontend should talk to a VPS backend instead of Next.js API routes,
// set NEXT_PUBLIC_BACKEND_URL in your Vercel env vars.
// Example: NEXT_PUBLIC_BACKEND_URL=https://raooza-api.seudominio.com
export const BACKEND_URL = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) || "";
export const USE_BACKEND = BACKEND_URL.length > 0;

// OpenAI-compatible chat completion fetch (works for OpenRouter, DeepSeek, and Z.ai with custom key)
export async function openAICompatibleChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: any[],
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      stream: false,
    }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Provider error ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Build the API endpoint URL. If BACKEND_URL is set, use it. Otherwise use local Next.js route.
export function apiUrl(path: string): string {
  if (USE_BACKEND) {
    return `${BACKEND_URL}${path}`;
  }
  return path;
}

export const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  glm: {
    id: "glm",
    name: "GLM (Z.ai)",
    description: "Modelos GLM-4.6 da Z.ai via z-ai-web-dev-sdk",
    defaultModel: "glm-4.6",
    models: ["glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4-plus"],
    apiKeyUrl: "https://z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    description: "Acesso a Claude, GPT, Llama, Gemini e mais",
    defaultModel: "anthropic/claude-3.5-sonnet",
    models: [
      "anthropic/claude-3.5-sonnet",
      "anthropic/claude-3.7-sonnet",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-flash-1.5",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat",
    ],
    apiKeyUrl: "https://openrouter.ai/keys",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    description: "Modelos DeepSeek (Chat e Reasoner)",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    baseUrl: "https://api.deepseek.com/v1",
  },
};

export function getProvider(id: AIProvider): ProviderConfig {
  return PROVIDERS[id];
}
