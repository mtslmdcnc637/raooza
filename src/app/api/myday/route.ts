// Raooza OS - My Day AI API Route
// Suggests 3-5 tasks for today based on user's tasks, habits, notes, events, and recent activity.

import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, openAICompatibleChat } from "@/lib/ai/providers";
import type { AIProvider } from "@/stores/settingsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Você é o assistente de planejamento do Raooza OS. Sua tarefa é sugerir de 3 a 5 tarefas prioritárias para o usuário fazer HOJE, com base no contexto fornecido.

RETORNE APENAS JSON VÁLIDO. Sem markdown. Sem code fences. Sem texto antes ou depois.

Formato:
{
  "summary": "1-2 frases resumindo o foco do dia",
  "suggestions": [
    {
      "title": "Tarefa curta e acionável (até 60 caracteres)",
      "reason": "Por que essa tarefa é prioritária hoje (1 frase curta)",
      "estimatedMinutes": 30,
      "taskId": "id-da-tarefa-existente-OU-null-para-nova-tarefa",
      "isNew": false
    }
  ]
}

REGRAS:
1. Priorize tarefas existentes (kanban) que tenham dueDate próxima ou em coluna "A Fazer".
2. Inclua hábitos pendentes de hoje (não checados ainda) como sugestões.
3. Inclua eventos próximos do calendário se relevantes (ex: "preparar para reunião X").
4. Se houver poucas tarefas existentes, sugira novas tarefas relacionadas ao contexto (notas recentes, projetos ativos).
5. Máximo 5 sugestões.
6. estimatedMinutes deve ser realista (15-120 min).
7. Se uma sugestão é uma tarefa existente, inclua taskId e isNew=false.
8. Se é uma nova tarefa sugerida, taskId=null e isNew=true.
9. Responda em português brasileiro.
10. A resposta deve começar com { e terminar com }. Nada mais.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const providerId = body.provider as AIProvider;
    const apiKey = (body.apiKey as string) ?? "";
    const model = (body.model as string) ?? "";
    const context = body.context;

    if (!providerId || !PROVIDERS[providerId]) {
      return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
    }

    const provider = PROVIDERS[providerId];
    if (providerId !== "glm" && !apiKey) {
      return NextResponse.json(
        { error: `API key necessária para ${provider.name}.` },
        { status: 400 },
      );
    }

    const userMessage = `Contexto do usuário para hoje (${new Date().toLocaleDateString("pt-BR")}):

Tarefas pendentes (kanban):
${(context.tasks ?? []).map((t: any) => `- [${t.id}] ${t.title}${t.dueDate ? ` (vence ${new Date(t.dueDate).toLocaleDateString("pt-BR")})` : ""}${t.description ? ` — ${t.description.slice(0, 80)}` : ""}`).join("\n") || "(nenhuma)"}

Hábitos de hoje (não checados ainda):
${(context.habits ?? []).map((h: any) => `- [${h.id}] ${h.title} (${h.cadence})`).join("\n") || "(nenhum)"}

Eventos de hoje/próximos:
${(context.events ?? []).map((e: any) => `- ${new Date(e.startAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} ${e.title}`).join("\n") || "(nenhum)"}

Notas atualizadas recentemente:
${(context.recentNotes ?? []).map((n: any) => `- ${n.title}: ${(n.content ?? "").slice(0, 100)}`).join("\n") || "(nenhuma)"}

Projetos ativos (por tag):
${(context.activeTags ?? []).map((t: any) => `- #${t.tag} (${t.count} itens)`).join("\n") || "(nenhum)"}

Com base nesse contexto, sugira de 3 a 5 tarefas para HOJE.`;

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: userMessage },
    ];

    let responseText = "";
    if (providerId === "glm" && !apiKey) {
      const ZAIMod = await import("z-ai-web-dev-sdk");
      const ZAI = (ZAIMod as any).default || (ZAIMod as any).ZAI || ZAIMod;
      const zai = await ZAI.create();
      const res = await zai.chat.completions.create({
        model: model || provider.defaultModel,
        messages,
        temperature: 0.4,
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

    // Parse JSON
    let parsed: any = null;
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

    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return NextResponse.json(
        { error: "IA não retornou JSON válido", raw: responseText.slice(0, 300) },
        { status: 422 },
      );
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("[/api/myday]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
