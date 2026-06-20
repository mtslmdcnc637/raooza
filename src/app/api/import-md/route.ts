// Raooza OS - Markdown Import API Route
// Analyzes a markdown file using AI and returns a structured action batch

import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, openAICompatibleChat } from "@/lib/ai/providers";
import type { AIProvider } from "@/stores/settingsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_CHARS = 30000; // ~30k chars to fit context window

const IMPORT_PROMPT = `Você está analisando um arquivo markdown (.md) para configurar um workspace de projeto no Raooza OS.

Com base no conteúdo do markdown, extraia a estrutura do projeto e retorne um JSON com as ações necessárias para configurar o ambiente.

Formato de resposta (JSON PURO, sem markdown, sem code fences):

{
  "projectName": "Nome do projeto (do primeiro H1 ou do nome do arquivo)",
  "projectDescription": "1-2 frases descrevendo o projeto",
  "tag": "slug-do-projeto (sem espaços, sem acentos, sem #)",
  "actions": [
    // 1 wiki page com o conteúdo completo do MD (preservando markdown e convertendo referências internas em [[links]])
    {
      "app": "wiki",
      "action": "createPage",
      "payload": {
        "title": "Nome do projeto",
        "content": "conteúdo completo do MD, com [[links]] onde fizer sentido",
        "tags": ["#tag-do-projeto#"]
      }
    },
    // Tarefas kanban extraídas de: TODOs, checklists (- [ ]), seções "Próximos Passos", "Roadmap", "Backlog"
    {
      "app": "kanban",
      "action": "createTask",
      "payload": {
        "title": "título curto da tarefa",
        "description": "detalhe se houver",
        "tags": ["#tag-do-projeto#"],
        "dueDate": "ISO 8601 se houver data mencionada, senão omitir"
      }
    },
    // Notas inteligentes com resumos das seções principais (máx 5 notas)
    {
      "app": "notes",
      "action": "create",
      "payload": {
        "title": "Título da seção",
        "content": "Resumo da seção em markdown",
        "color": "#fbbf24",
        "tags": ["#tag-do-projeto#"]
      }
    },
    // Eventos de calendário se houver datas explícitas (reuniões, prazos, releases)
    {
      "app": "calendar",
      "action": "createEvent",
      "payload": {
        "title": "Nome do evento",
        "startAt": "ISO 8601",
        "allDay": true,
        "color": "#0078D4"
      }
    }
  ]
}

REGRAS:
1. Sempre responda em português brasileiro.
2. Sempre inclua a tag do projeto em TODOS os payloads que aceitam tags (notes, kanban, wiki).
3. SEMPRE crie exatamente 1 wiki page com o conteúdo completo do MD.
4. Extraia no MÁXIMO 10 tarefas kanban (as mais importantes).
5. Extraia no MÁXIMO 5 notas (apenas seções significativas, não crie notas triviais).
6. Crie eventos de calendário APENAS se houver datas explícitas no MD (ex: "reunião dia 15/07", "release em 2026-08-01").
7. Converta referências internas do MD para [[links wiki]] quando fizer sentido.
8. A tag deve ser um slug limpo: sem espaços, sem acentos, sem caracteres especiais.
9. NÃO invente informações — apenas extraia do que está no MD.
10. Se o MD for muito curto ou vazio, crie apenas a wiki page com o conteúdo disponível.
11. Retorne SOMENTE o JSON, sem texto adicional, sem markdown, sem \`\`\`json.

Importante: no campo "tags", use o formato ["#tag-do-projeto#"] (com # no início e fim). Exemplo: se a tag for "mrcine", use ["#mrcine#"].`;

export async function POST(req: NextRequest) {
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

    // Truncate content if too long
    const truncated = content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + "\n\n[... conteúdo truncado ...]"
      : content;

    const userMessage = `Arquivo: ${fileName}\n\nConteúdo:\n\n${truncated}`;

    const messages = [
      { role: "system" as const, content: IMPORT_PROMPT },
      { role: "user" as const, content: userMessage },
    ];

    let responseText: string;

    if (providerId === "glm" && !apiKey) {
      try {
        const ZAIMod = await import("z-ai-web-dev-sdk");
        const ZAI = (ZAIMod as any).default || (ZAIMod as any).ZAI || ZAIMod;
        const zai = await ZAI.create();
        const res = await zai.chat.completions.create({
          model: model || provider.defaultModel,
          messages,
          temperature: 0.2,
        });
        responseText = res.choices?.[0]?.message?.content ?? "";
      } catch (e: any) {
        return NextResponse.json(
          { error: `GLM SDK erro: ${e?.message ?? String(e)}. Configure uma API key própria em Configurações > IA.` },
          { status: 500 },
        );
      }
    } else {
      responseText = await openAICompatibleChat(
        provider.baseUrl,
        apiKey,
        model || provider.defaultModel,
        messages,
      );
    }

    // Try to parse JSON from response
    let parsed: any = null;
    let cleaned = responseText.trim();
    // Strip markdown code fences
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract first { ... }
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {}
      }
    }

    if (!parsed || !parsed.actions || !Array.isArray(parsed.actions)) {
      return NextResponse.json(
        { error: "IA não retornou um JSON válido. Tente novamente.", raw: responseText.slice(0, 500) },
        { status: 422 },
      );
    }

    // Normalize tag format: ensure # prefix and # suffix
    const tag = (parsed.tag ?? slugify(fileName)).replace(/#/g, "");
    parsed.tag = tag;
    parsed.actions = parsed.actions.map((a: any) => {
      if (a.payload && Array.isArray(a.payload.tags)) {
        a.payload.tags = a.payload.tags.map((t: string) => {
          const clean = (t || "").replace(/^#/, "").replace(/#$/, "");
          return clean === tag ? `#${tag}#` : t;
        });
      }
      return a;
    });

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("[/api/import-md]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

function slugify(s: string): string {
  return s
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 30);
}
