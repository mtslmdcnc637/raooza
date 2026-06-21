// Raooza OS - Markdown Import API Route
// Analyzes a markdown file using AI and returns a structured action batch.

import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, openAICompatibleChat } from "@/lib/ai/providers";
import type { AIProvider } from "@/stores/settingsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

const MAX_CONTENT_CHARS = 25000; // trimmed to fit context safely

const IMPORT_PROMPT = `Você é um assistente que analisa um arquivo markdown (.md) e extrai a estrutura de projeto para configurar um workspace no Raooza OS.

RETORNE APENAS JSON VÁLIDO. Sem markdown. Sem code fences. Sem texto antes ou depois. Sem comentários. A resposta inteira deve ser parseable por JSON.parse().

Formato EXATO:

{
  "projectName": "string (do H1 ou nome do arquivo, sem extensão)",
  "projectDescription": "string curta 1-2 frases",
  "tag": "slug sem espaços/acentos/símbolos",
  "actions": [
    {
      "app": "wiki" | "kanban" | "notes" | "calendar",
      "action": "createPage" | "createTask" | "create" | "createEvent",
      "payload": { "title": "...", "content": "...", "tags": ["#tag#"], ... }
    }
  ]
}

Mapeamento de app → action:
- wiki → "createPage" (sempre crie EXATAMENTE 1 página com o conteúdo completo do MD)
- kanban → "createTask" (extraia de TODOs, checklists - [ ], seções "Próximos Passos", "Roadmap", "Backlog" — máx 10)
- notes → "create" (resumos das seções principais — máx 5, com color "#fbbf24")
- calendar → "createEvent" (APENAS se houver datas explícitas, com startAt ISO 8601, allDay true, color "#0078D4")

Payloads:
- wiki.createPage: { title, content, tags: ["#tag#"] }
- kanban.createTask: { title, description?, tags: ["#tag#"], dueDate? }
- notes.create: { title, content, color: "#fbbf24", tags: ["#tag#"] }
- calendar.createEvent: { title, startAt, allDay: true, color: "#0078D4" }

REGRAS:
1. Tag deve ser slug limpo: sem espaços, sem acentos, sem #. Ex: "Mrcine" → "mrcine", "Meu Projeto" → "meuprojeto".
2. Todas as tags em payloads devem ser "#slug#" (com # no início e fim).
3. Sempre crie 1 wiki page com conteúdo COMPLETO do MD (pode truncar se enorme, mas preservar estrutura).
4. Máximo 10 tarefas kanban, 5 notas, 10 eventos.
5. Não invente dados — só extraia do MD.
6. Se MD for vazio/curto, crie só a wiki page.
7. Não inclua "schedule" nos actions.
8. Converta referências internas do MD em [[wiki links]] quando fizer sentido.
9. IMPORTANTE: resposta deve começar com { e terminar com }. Nada mais.`;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const fileName = body.fileName as string;
    const content = body.content as string;
    const providerId = body.provider as AIProvider;
    const apiKey = (body.apiKey as string) ?? "";
    const model = (body.model as string) ?? "";

    if (!fileName || !content) {
      return NextResponse.json({ error: "fileName e content são obrigatórios" }, { status: 400 });
    }
    if (!providerId || !PROVIDERS[providerId]) {
      return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
    }

    const provider = PROVIDERS[providerId];

    if (providerId !== "glm" && !apiKey) {
      return NextResponse.json(
        { error: `API key necessária para ${provider.name}. Configure em Configurações > IA.` },
        { status: 400 },
      );
    }

    // Truncate content to fit context window
    const truncated = content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + "\n\n[... conteúdo truncado ...]"
      : content;

    const userMessage = `Arquivo: ${fileName}\n\nConteúdo do markdown:\n\n${truncated}`;

    const messages = [
      { role: "system" as const, content: IMPORT_PROMPT },
      { role: "user" as const, content: userMessage },
    ];

    // Call AI with retry (max 2 attempts)
    let responseText = "";
    let lastError: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (providerId === "glm" && !apiKey) {
          const ZAIMod = await import("z-ai-web-dev-sdk");
          const ZAI = (ZAIMod as any).default || (ZAIMod as any).ZAI || ZAIMod;
          const zai = await ZAI.create();
          const res = await zai.chat.completions.create({
            model: model || provider.defaultModel,
            messages,
            temperature: 0.2,
          });
          responseText = res.choices?.[0]?.message?.content ?? "";
        } else {
          responseText = await openAICompatibleChat(
            provider.baseUrl,
            apiKey,
            model || provider.defaultModel,
            messages,
          );
        }

        // Try to parse — if it works, we're done
        const parsed = tryParseJSON(responseText);
        if (parsed && Array.isArray(parsed.actions)) {
          return NextResponse.json(normalizeResponse(parsed, fileName));
        }
        lastError = new Error("IA não retornou JSON válido");
        // On second attempt failure, fall through to error
      } catch (e: any) {
        lastError = e;
        // Wait a bit before retry
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // All attempts failed — return informative error
    console.error("[/api/import-md] All attempts failed", {
      error: lastError?.message,
      duration: Date.now() - startTime,
      responsePreview: responseText.slice(0, 300),
    });

    return NextResponse.json(
      {
        error: "A IA demorou muito ou retornou resposta inválida. Tente novamente, ou reduza o tamanho do arquivo.",
        details: lastError?.message ?? "Unknown error",
      },
      { status: 504 },
    );
  } catch (e: any) {
    console.error("[/api/import-md] Fatal", e);
    return NextResponse.json(
      { error: e?.message ?? "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

function tryParseJSON(text: string): any | null {
  if (!text) return null;
  let s = text.trim();

  // Strip markdown code fences
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  }

  // Try direct parse
  try {
    return JSON.parse(s);
  } catch {}

  // Try to extract first { ... } block (greedy)
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = s.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
    // Try to fix common issues: trailing commas
    try {
      const fixed = candidate.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(fixed);
    } catch {}
  }

  return null;
}

function normalizeResponse(parsed: any, fileName: string) {
  const tag = (parsed.tag ?? slugify(fileName)).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  parsed.tag = tag;
  if (!Array.isArray(parsed.actions)) parsed.actions = [];
  parsed.actions = parsed.actions.map((a: any) => {
    if (a.payload && Array.isArray(a.payload.tags)) {
      a.payload.tags = a.payload.tags.map((t: string) => {
        const clean = String(t || "").replace(/^#/, "").replace(/#$/, "");
        return clean === tag ? `#${tag}#` : t;
      });
    }
    return a;
  });
  if (!parsed.projectName) {
    parsed.projectName = fileName.replace(/\.md$/i, "");
  }
  return parsed;
}

function slugify(s: string): string {
  return s
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 30);
}
