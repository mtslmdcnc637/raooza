// Raooza Backend - proxy for AI requests
// Runs on your VPS, accepts requests from the Vercel-hosted frontend.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();

const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || "openrouter";
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60");
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// Provider base URLs (OpenAI-compatible)
const PROVIDER_BASE_URLS = {
  glm: "https://api.z.ai/api/paas/v4",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
};

const PROVIDER_API_KEYS = {
  glm: process.env.ZAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
};

const PROVIDER_DEFAULT_MODELS = {
  glm: "glm-4.6",
  openrouter: "anthropic/claude-3.5-sonnet",
  deepseek: "deepseek-chat",
};

// In-memory rate limiter (per-IP, per-minute)
// For multi-instance production, swap with Redis.
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const timestamps = rateLimitMap.get(ip).filter((t) => now - t < windowMs);
  if (timestamps.length >= RATE_LIMIT_PER_MINUTE) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  next();
}

// Simple in-memory response cache (5min TTL for identical requests)
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}
function setCached(key, value) {
  responseCache.set(key, { ts: Date.now(), value });
  // Cap cache size
  if (responseCache.size > 500) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
}

// Logging
function log(level, ...args) {
  const levels = ["debug", "info", "warn", "error"];
  if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
    if (level === "error") console.error(prefix, ...args);
    else if (level === "warn") console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }
}

// Helper: call OpenAI-compatible chat completion
async function chatCompletion({ provider, apiKey, model, messages, temperature = 0.4, signal }) {
  const baseUrl = PROVIDER_BASE_URLS[provider];
  if (!baseUrl) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);

  const url = `${baseUrl}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://raooza.vercel.app";
    headers["X-Title"] = "Raooza OS";
  }

  const body = JSON.stringify({
    model: model || PROVIDER_DEFAULT_MODELS[provider],
    messages,
    temperature,
    stream: false,
  });

  const res = await fetch(url, { method: "POST", headers, body, signal });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Provider ${provider} returned ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// App
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  }),
);

// Request logging middleware
app.use((req, _res, next) => {
  log("info", `${req.method} ${req.path} from ${req.headers["x-forwarded-for"] || req.socket.remoteAddress}`);
  next();
});

// Health check (public — no sensitive info)
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "raooza-backend",
    version: "1.0.0",
    uptime: process.uptime(),
  });
});

// List available models from a provider (no API key required for OpenRouter)
app.get("/models/:provider", async (req, res) => {
  const { provider } = req.params;
  const baseUrl = PROVIDER_BASE_URLS[provider];
  if (!baseUrl) return res.status(400).json({ error: `Unknown provider: ${provider}` });
  try {
    const headers = {};
    const apiKey = PROVIDER_API_KEYS[provider];
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://raooza.vercel.app";
    }
    const r = await fetch(`${baseUrl}/models`, { headers });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: `Provider returned ${r.status}: ${txt.slice(0, 200)}` });
    }
    const data = await r.json();
    const models = (data.data || []).map((m) => m.id).sort();
    res.json({ models });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai — generic chat completion
// Body: { provider?, apiKey?, model?, messages, temperature? }
//
// API KEY PRIORITY:
//   1. apiKey from request body (user-supplied — always wins)
//   2. Server-side env var for the provider (fallback if user didn't supply)
//
// The backend NEVER stores the user's API key. It's only used in-memory
// to make the single request, then discarded.
app.post("/api/ai", rateLimit, async (req, res) => {
  try {
    const { provider: bodyProvider, apiKey: bodyApiKey, model, messages, temperature } = req.body;
    const provider = bodyProvider || DEFAULT_PROVIDER;
    const userApiKey = bodyApiKey && bodyApiKey.length > 0 ? bodyApiKey : null;
    const serverApiKey = PROVIDER_API_KEYS[provider];
    const apiKey = userApiKey || serverApiKey;
    const usingUserKey = !!userApiKey;

    if (!apiKey) {
      return res.status(400).json({
        error: `No API key for provider "${provider}". Set one in Configurações > IA.`,
      });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array" });
    }

    // Cache only when using server key (don't cache user-keyed requests — could leak between users)
    const cacheKey = usingUserKey
      ? null
      : JSON.stringify({ provider, model, messages: messages.slice(-4), temperature });
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        log("debug", "cache hit for /api/ai");
        return res.json({ content: cached, cached: true });
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const content = await chatCompletion({
        provider,
        apiKey,
        model,
        messages,
        temperature,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (cacheKey) setCached(cacheKey, content);
      res.json({ content });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    log("error", "/api/ai error:", e.message);
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Request timed out (90s)" });
    }
    res.status(500).json({ error: e.message });
  }
});

// POST /api/import-md — analyze markdown and return structured actions
app.post("/api/import-md", rateLimit, async (req, res) => {
  try {
    const { fileName, content, provider: bodyProvider, apiKey: bodyApiKey, model } = req.body;
    if (!fileName || !content) {
      return res.status(400).json({ error: "fileName and content are required" });
    }
    const provider = bodyProvider || DEFAULT_PROVIDER;
    const userApiKey = bodyApiKey && bodyApiKey.length > 0 ? bodyApiKey : null;
    const apiKey = userApiKey || PROVIDER_API_KEYS[provider];
    if (!apiKey) {
      return res.status(400).json({ error: `No API key for provider "${provider}". Set one in Configurações > IA.` });
    }

    const MAX_CONTENT_CHARS = 25000;
    const truncated = content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + "\n\n[... conteúdo truncado ...]"
      : content;

    const systemPrompt = `Você é um assistente que analisa um arquivo markdown (.md) e extrai a estrutura de projeto para configurar um workspace no Raooza OS.

RETORNE APENAS JSON VÁLIDO. Sem markdown. Sem code fences.

Formato:
{
  "projectName": "string",
  "projectDescription": "string curta",
  "tag": "slug sem espaços/acentos",
  "actions": [
    { "app": "wiki"|"kanban"|"notes"|"calendar", "action": "createPage"|"createTask"|"create"|"createEvent", "payload": { "title": "...", "tags": ["#tag#"], ... } }
  ]
}

Regras:
1. Sempre crie 1 wiki page com conteúdo COMPLETO do MD.
2. Máximo 10 tarefas kanban (extraídas de TODOs/checklists/roadmaps).
3. Máximo 5 notas (resumos das seções principais).
4. Eventos de calendário APENAS se houver datas explícitas.
5. Todas as tags em payloads: "#slug#" (com # no início e fim).
6. Tag slug limpo: sem espaços, acentos, símbolos.
7. Resposta deve começar com { e terminar com }.`;

    const userMessage = `Arquivo: ${fileName}\n\nConteúdo:\n\n${truncated}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min for import
    try {
      const responseText = await chatCompletion({
        provider,
        apiKey,
        model,
        messages,
        temperature: 0.2,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Parse JSON
      let parsed = null;
      let s = responseText.trim();
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

      if (!parsed || !Array.isArray(parsed.actions)) {
        return res.status(422).json({
          error: "IA não retornou JSON válido",
          raw: responseText.slice(0, 500),
        });
      }

      // Normalize tag
      const tag = (parsed.tag || fileName.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
        .replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      parsed.tag = tag;
      if (Array.isArray(parsed.actions)) {
        parsed.actions = parsed.actions.map((a) => {
          if (a.payload && Array.isArray(a.payload.tags)) {
            a.payload.tags = a.payload.tags.map((t) => {
              const clean = String(t || "").replace(/^#/, "").replace(/#$/, "");
              return clean === tag ? `#${tag}#` : t;
            });
          }
          return a;
        });
      }
      if (!parsed.projectName) parsed.projectName = fileName.replace(/\.md$/i, "");

      res.json(parsed);
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    log("error", "/api/import-md error:", e.message);
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Import timed out (180s)" });
    }
    res.status(500).json({ error: e.message });
  }
});

// POST /api/myday — generate daily suggestions
app.post("/api/myday", rateLimit, async (req, res) => {
  try {
    const { context, provider: bodyProvider, apiKey: bodyApiKey, model } = req.body;
    const provider = bodyProvider || DEFAULT_PROVIDER;
    const userApiKey = bodyApiKey && bodyApiKey.length > 0 ? bodyApiKey : null;
    const apiKey = userApiKey || PROVIDER_API_KEYS[provider];
    if (!apiKey) {
      return res.status(400).json({ error: `No API key for provider "${provider}". Set one in Configurações > IA.` });
    }

    const systemPrompt = `Você é o assistente de planejamento do Raooza OS. Sugira de 3 a 5 tarefas prioritárias para HOJE.

RETORNE APENAS JSON VÁLIDO:
{
  "summary": "1-2 frases resumindo o foco do dia",
  "suggestions": [
    { "title": "...", "reason": "...", "estimatedMinutes": 30, "taskId": "id ou null", "isNew": false }
  ]
}

Regras:
1. Priorize tarefas existentes com dueDate próxima.
2. Inclua hábitos pendentes de hoje.
3. Inclua eventos próximos relevantes.
4. Máximo 5 sugestões.
5. Responda em português brasileiro.`;

    const userMessage = `Contexto para hoje (${new Date().toLocaleDateString("pt-BR")}):

Tarefas pendentes (kanban):
${(context?.tasks ?? []).map((t) => `- [${t.id}] ${t.title}${t.dueDate ? ` (vence ${new Date(t.dueDate).toLocaleDateString("pt-BR")})` : ""}`).join("\n") || "(nenhuma)"}

Hábitos não checados hoje:
${(context?.habits ?? []).map((h) => `- [${h.id}] ${h.title} (${h.cadence})`).join("\n") || "(nenhum)"}

Eventos próximos:
${(context?.events ?? []).map((e) => `- ${new Date(e.startAt).toLocaleString("pt-BR")} ${e.title}`).join("\n") || "(nenhum)"}

Notas recentes:
${(context?.recentNotes ?? []).map((n) => `- ${n.title}: ${(n.content ?? "").slice(0, 100)}`).join("\n") || "(nenhuma)"}

Projetos ativos:
${(context?.activeTags ?? []).map((t) => `- #${t.tag} (${t.count} itens)`).join("\n") || "(nenhum)"}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const responseText = await chatCompletion({
        provider,
        apiKey,
        model,
        messages,
        temperature: 0.4,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let parsed = null;
      let s = responseText.trim();
      if (s.startsWith("```")) {
        s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      }
      try { parsed = JSON.parse(s); } catch {
        const match = s.match(/\{[\s\S]*\}/);
        if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
      }

      if (!parsed || !Array.isArray(parsed.suggestions)) {
        return res.status(422).json({
          error: "IA não retornou JSON válido",
          raw: responseText.slice(0, 300),
        });
      }

      res.json(parsed);
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    log("error", "/api/myday error:", e.message);
    if (e.name === "AbortError") return res.status(504).json({ error: "Timed out" });
    res.status(500).json({ error: e.message });
  }
});

// === AI INTEL — web search (DuckDuckGo, no API key needed) + LLM clustering ===

const INTEL_SEARCH_QUERIES = [
  "AI news this week breakthroughs 2026",
  "new AI model release GPT Claude Gemini LLM",
  "AI tools agents automation 2026",
  "artificial intelligence latest development",
];

let intelCache = null;
let intelCacheAt = 0;
const INTEL_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

// DuckDuckGo HTML search — free, no API key required
async function webSearch(query, num = 5) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
    const html = await res.text();

    // Parse results from DuckDuckGo HTML
    const results = [];
    const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < num) {
      let rawUrl = match[1];
      // DuckDuckGo wraps URLs in redirect: //duckduckgo.com/l/?uddg=ENCODED_URL
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        rawUrl = decodeURIComponent(uddgMatch[1]);
      }
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();
      let hostName = "";
      try { hostName = new URL(rawUrl).hostname; } catch {}

      if (title && rawUrl && rawUrl.startsWith("http")) {
        results.push({
          url: rawUrl,
          name: title,
          snippet: snippet,
          host_name: hostName,
          date: "",
        });
      }
    }

    // Fallback: try simpler regex if no results matched
    if (results.length === 0) {
      const simpleRegex = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      while ((match = simpleRegex.exec(html)) !== null && results.length < num) {
        let rawUrl = match[1];
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) rawUrl = decodeURIComponent(uddgMatch[1]);
        const title = match[2].replace(/<[^>]+>/g, "").trim();
        let hostName = "";
        try { hostName = new URL(rawUrl).hostname; } catch {}
        if (title && rawUrl.startsWith("http")) {
          results.push({ url: rawUrl, name: title, snippet: "", host_name: hostName, date: "" });
        }
      }
    }

    log("debug", `DuckDuckGo search "${query}" returned ${results.length} results`);
    return results;
  } catch (e) {
    log("error", "webSearch (DuckDuckGo) failed:", e.message);
    return [];
  }
}

function dedupeByURL(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const key = r.url.split("?")[0].split("#")[0].replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function extractYouTubeId(url) {
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

// POST /api/intel — web search + LLM clustering (NO YouTube — done lazily via GET)
app.post("/api/intel", rateLimit, async (req, res) => {
  try {
    const { provider: bodyProvider, apiKey: bodyApiKey, model, forceRefresh } = req.body;
    const provider = bodyProvider || DEFAULT_PROVIDER;
    const userApiKey = bodyApiKey && bodyApiKey.length > 0 ? bodyApiKey : null;
    const serverApiKey = PROVIDER_API_KEYS[provider];
    const finalApiKey = userApiKey || serverApiKey;

    if (!finalApiKey) {
      return res.status(400).json({ error: `No API key for provider "${provider}". Configure em Configurações > IA.` });
    }

    // Cache
    if (!forceRefresh && intelCache && Date.now() - intelCacheAt < INTEL_CACHE_TTL) {
      return res.json({ ...intelCache, cached: true });
    }

    // Step 1: parallel web searches
    const searchPromises = INTEL_SEARCH_QUERIES.map((q) => webSearch(q, 5));
    const searchResults = (await Promise.all(searchPromises)).flat();
    const deduped = dedupeByURL(searchResults);

    if (deduped.length === 0) {
      return res.status(502).json({ error: "Nenhum resultado de busca." });
    }

    // Step 2: cluster via LLM
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

    const messages = [
      { role: "system", content: clusterPrompt },
      { role: "user", content: "Agrupe." },
    ];

    const clusterText = await chatCompletion({
      provider,
      apiKey: finalApiKey,
      model,
      messages,
      temperature: 0.3,
    });

    let parsed = null;
    let s = clusterText.trim();
    if (s.startsWith("```")) {
      s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    }
    try { parsed = JSON.parse(s); } catch {
      const match = s.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
    }

    if (!parsed || !Array.isArray(parsed.themes)) {
      return res.status(422).json({ error: "IA não conseguiu agrupar." });
    }

    const themes = parsed.themes.slice(0, 6).map((t) => ({ ...t, videos: [] }));
    const result = {
      themes,
      totalSources: deduped.length,
      fetchedAt: new Date().toISOString(),
    };

    intelCache = result;
    intelCacheAt = Date.now();

    res.json({ ...result, cached: false });
  } catch (e) {
    log("error", "/api/intel error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/intel/videos?keywords=... — lazy YouTube search per theme
app.get("/api/intel/videos", rateLimit, async (req, res) => {
  try {
    const { keywords } = req.query;
    if (!keywords) {
      return res.status(400).json({ error: "keywords required" });
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
    res.json({ videos });
  } catch (e) {
    log("error", "/api/intel/videos error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  log("error", "Unhandled:", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  log("info", `Raooza backend listening on port ${PORT}`);
  log("info", `Default provider: ${DEFAULT_PROVIDER}`);
  log("info", `Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  log("info", `Rate limit: ${RATE_LIMIT_PER_MINUTE} req/min per IP`);
  log("info", `API key priority: user-supplied (request body) → server env var`);
});
