// Raooza OS - AI Intelligence API
// Crawls the web for AI news, clusters into themes via LLM.
// YouTube videos are fetched LAZILY via /api/intel/videos?theme=...
// to keep initial response under 10s (Vercel Hobby limit).

import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, openAICompatibleChat } from "@/lib/ai/providers";
import type { AIProvider } from "@/stores/settingsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// === Cache ===
let cachedIntel: any = null;
let cachedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// === Reduced queries (was 8, now 4 — much faster) ===
const SEARCH_QUERIES = [
  "AI news this week breakthroughs 2026",
  "new AI model release GPT Claude Gemini LLM",
  "AI tools agents automation 2026",
  "artificial intelligence latest development",
];

// === Helpers ===

interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date?: string;
}

async function webSearch(query: string, num = 5): Promise<SearchResult[]> {
  try {
    const ZAIMod: any = await import("z-ai-web-dev-sdk");
    const ZAI = ZAIMod.default || ZAIMod.ZAI || ZAIMod;
    const zai = await ZAI.create();
    const results = await zai.functions.invoke("web_search", { query, num });
    return (results ?? []).map((r: any) => ({
      url: r.url,
      name: r.name,
      snippet: r.snippet || "",
      host_name: r.host_name || "",
      date: r.date || "",
    }));
  } catch (e: any) {
    console.error("[intel] web_search failed:", e?.message);
    return [];
  }
}

function dedupeByURL(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = r.url.split("?")[0].split("#")[0].replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// === Main handler: web search + clustering ONLY (no YouTube) ===

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerId = body.provider as AIProvider;
    const apiKey = (body.apiKey as string) ?? "";
    const model = (body.model as string) ?? "";
    const forceRefresh = !!body.forceRefresh;

    if (!providerId || !PROVIDERS[providerId]) {
      return NextResponse.json(
        { error: "Provedor de IA não configurado. Vá em Configurações > IA." },
        { status: 400 },
      );
    }
    if (providerId !== "glm" && !apiKey) {
      return NextResponse.json(
        { error: `API key necessária para ${PROVIDERS[providerId].name}.` },
        { status: 400 },
      );
    }

    // Return cached if fresh
    if (!forceRefresh && cachedIntel && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ ...cachedIntel, cached: true });
    }

    // === Step 1: parallel web searches (4 queries, 5 results each = 20 max) ===
    const searchPromises = SEARCH_QUERIES.map((q) => webSearch(q, 5));
    const searchResults = (await Promise.all(searchPromises)).flat();
    const deduped = dedupeByURL(searchResults);

    if (deduped.length === 0) {
      return NextResponse.json(
        { error: "Nenhum resultado de busca. Tente novamente." },
        { status: 502 },
      );
    }

    // === Step 2: cluster into themes via LLM ===
    const provider = PROVIDERS[providerId];
    const itemsForLLM = deduped.slice(0, 30).map((r) => ({
      title: r.name,
      snippet: r.snippet.slice(0, 150),
      url: r.url,
      source: r.host_name,
    }));

    const clusterPrompt = `Você é um analista de IA. Abaixo estão ${itemsForLLM.length} resultados sobre IA. Agrupe em 4-6 temas.

RETORNE APENAS JSON VÁLIDO, sem markdown:
{"themes":[{"title":"nome","summary":"2 frases","keywords":["k1","k2"],"importance":"alta|media|baixa","sources":[{"title":"t","url":"u","source":"s"}]}]}

Regras: agrupe matérias relacionadas, 2-6 fontes por tema, keywords em português, não invente URLs.

Dados: ${JSON.stringify(itemsForLLM)}`;

    let clusterText = "";
    const messages = [
      { role: "system" as const, content: clusterPrompt },
      { role: "user" as const, content: "Agrupe." },
    ];

    if (providerId === "glm" && !apiKey) {
      const ZAIMod: any = await import("z-ai-web-dev-sdk");
      const ZAI = ZAIMod.default || ZAIMod.ZAI || ZAIMod;
      const zai = await ZAI.create();
      const res = await zai.chat.completions.create({
        model: model || provider.defaultModel,
        messages,
        temperature: 0.3,
      });
      clusterText = res.choices?.[0]?.message?.content ?? "";
    } else {
      clusterText = await openAICompatibleChat(
        provider.baseUrl,
        apiKey,
        model || provider.defaultModel,
        messages,
      );
    }

    let parsed: any = null;
    let s = clusterText.trim();
    if (s.startsWith("```")) {
      s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    }
    try { parsed = JSON.parse(s); } catch {
      const match = s.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
    }

    if (!parsed || !Array.isArray(parsed.themes)) {
      return NextResponse.json(
        { error: "IA não conseguiu agrupar. Tente novamente." },
        { status: 422 },
      );
    }

    // === NO YouTube search here — done lazily via GET /api/intel/videos ===
    const themesWithoutVideos = (parsed.themes as any[]).slice(0, 6).map((t) => ({
      ...t,
      videos: [], // will be fetched on demand
    }));

    const result = {
      themes: themesWithoutVideos,
      totalSources: deduped.length,
      fetchedAt: new Date().toISOString(),
    };

    cachedIntel = result;
    cachedAt = Date.now();

    return NextResponse.json({ ...result, cached: false });
  } catch (e: any) {
    console.error("[/api/intel]", e);
    return NextResponse.json({ error: e?.message ?? "Erro" }, { status: 500 });
  }
}

// === GET /api/intel/videos?keywords=... — lazy YouTube search per theme ===
export async function GET(req: NextRequest) {
  try {
    const keywords = req.nextUrl.searchParams.get("keywords");
    if (!keywords) {
      return NextResponse.json({ error: "keywords required" }, { status: 400 });
    }

    const query = `${keywords} português brasileiro`;
    const ytResults = await webSearch(`site:youtube.com ${query}`, 5);
    const videos = ytResults
      .map((r) => {
        const videoId = extractYouTubeId(r.url);
        if (!videoId) return null;
        return {
          videoId,
          title: r.name.replace(/\s*-\s*YouTube\s*$/i, "").trim() || r.name,
          url: r.url,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          source: r.host_name,
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    return NextResponse.json({ videos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
