// Raooza OS - AI Intelligence API
// Crawls the web for AI news, clusters into themes via LLM, finds YouTube videos in Portuguese.
//
// Caching: results cached for 6 hours in module memory (per server instance).
// On Vercel serverless, this resets per cold start — acceptable.

import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, openAICompatibleChat } from "@/lib/ai/providers";
import type { AIProvider } from "@/stores/settingsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180; // 3 minutes — heavy work

// === Cache ===
let cachedIntel: any = null;
let cachedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// === Search queries to run in parallel ===
const SEARCH_QUERIES = [
  "AI news this week breakthroughs",
  "artificial intelligence latest release",
  "LLM new model GPT Claude Gemini",
  "machine learning research paper",
  "AI tools agents automation",
  "OpenAI Anthropic Google DeepMind news",
  "generative AI video image model",
  "AI regulation policy news",
];

// === Helpers ===

interface SearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date?: string;
}

async function webSearch(query: string, num = 10): Promise<SearchResult[]> {
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
    console.error("[intel] web_search failed for:", query, e?.message);
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

// === Main handler ===

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerId = (body.provider as AIProvider) || "glm";
    const apiKey = (body.apiKey as string) ?? "";
    const model = (body.model as string) ?? "";
    const forceRefresh = !!body.forceRefresh;

    // Return cached if fresh
    if (!forceRefresh && cachedIntel && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cachedIntel,
        cached: true,
      });
    }

    // === Step 1: parallel web searches ===
    const searchPromises = SEARCH_QUERIES.map((q) => webSearch(q, 8));
    const searchResults = (await Promise.all(searchPromises)).flat();
    const deduped = dedupeByURL(searchResults);

    if (deduped.length === 0) {
      return NextResponse.json(
        { error: "Nenhum resultado de busca encontrado. Tente novamente mais tarde." },
        { status: 502 },
      );
    }

    // === Step 2: cluster into themes via LLM ===
    const provider = PROVIDERS[providerId];
    if (providerId !== "glm" && !apiKey) {
      return NextResponse.json(
        { error: `API key necessária para ${provider.name}. Configure em Configurações > IA.` },
        { status: 400 },
      );
    }

    const itemsForLLM = deduped.slice(0, 60).map((r) => ({
      title: r.name,
      snippet: r.snippet.slice(0, 200),
      url: r.url,
      source: r.host_name,
    }));

    const clusterPrompt = `Você é um analista de inteligência em IA. Abaixo estão ${itemsForLLM.length} resultados de busca sobre IA coletados de múltiplas fontes. Agrupe-os em 4 a 7 TEMAS principais.

RETORNE APENAS JSON VÁLIDO, sem markdown, sem code fences:

{
  "themes": [
    {
      "title": "Nome curto do tema (até 60 chars)",
      "summary": "Resumo de 2-3 frases explicando o tema e por que importa",
      "keywords": ["palavra1", "palavra2", "palavra3"],
      "importance": "alta|media|baixa",
      "sources": [
        { "title": "título da matéria", "url": "url original", "source": "dominio.com" }
      ]
    }
  ]
}

Regras:
1. Agrupe matérias relacionadas no mesmo tema.
2. Cada tema deve ter 2-8 matérias.
3. Use keywords em português quando possível (para buscar vídeos no YouTube BR).
4. importance = "alta" para releases de modelos, descobertas importantes, mudanças regulatórias.
5. Não invente URLs — só use as que estão nos dados.
6. Responda em português brasileiro.

Dados coletados:
${JSON.stringify(itemsForLLM, null, 2)}`;

    let clusterResponseText = "";
    const messages = [
      { role: "system" as const, content: clusterPrompt },
      { role: "user" as const, content: "Agrupe os resultados em temas." },
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
      clusterResponseText = res.choices?.[0]?.message?.content ?? "";
    } else {
      clusterResponseText = await openAICompatibleChat(
        provider.baseUrl,
        apiKey,
        model || provider.defaultModel,
        messages,
      );
    }

    // Parse JSON
    let parsed: any = null;
    let s = clusterResponseText.trim();
    if (s.startsWith("```")) {
      s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    }
    try {
      parsed = JSON.parse(s);
    } catch {
      const match = s.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }

    if (!parsed || !Array.isArray(parsed.themes)) {
      return NextResponse.json(
        { error: "IA não conseguiu agrupar os temas. Tente novamente.", raw: clusterResponseText.slice(0, 300) },
        { status: 422 },
      );
    }

    // === Step 3: for each theme, search YouTube for Portuguese videos ===
    const themesWithVideos = await Promise.all(
      (parsed.themes as any[]).slice(0, 7).map(async (theme) => {
        const query = `${theme.keywords?.slice(0, 3).join(" ") || theme.title} português brasileiro`;
        const ytResults = await webSearch(`site:youtube.com ${query}`, 6);
        const videos = ytResults
          .map((r) => {
            const videoId = extractYouTubeId(r.url);
            if (!videoId) return null;
            return {
              videoId,
              title: r.name.replace(/^.*?- YouTube$/, "").trim() || r.name,
              url: r.url,
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              source: r.host_name,
            };
          })
          .filter(Boolean)
          .slice(0, 5);
        return { ...theme, videos };
      }),
    );

    const result = {
      themes: themesWithVideos,
      totalSources: deduped.length,
      fetchedAt: new Date().toISOString(),
    };

    // Cache
    cachedIntel = result;
    cachedAt = Date.now();

    return NextResponse.json({ ...result, cached: false });
  } catch (e: any) {
    console.error("[/api/intel]", e);
    return NextResponse.json({ error: e?.message ?? "Erro interno" }, { status: 500 });
  }
}

// Also support GET for easy health-checking
export async function GET() {
  return NextResponse.json({
    ok: true,
    cached: !!cachedIntel,
    cacheAge: cachedAt ? Date.now() - cachedAt : null,
    cacheTtl: CACHE_TTL_MS,
  });
}
