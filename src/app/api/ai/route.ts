// Raooza OS - AI Chat API Route (SERVER-ONLY)

import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, openAICompatibleChat } from "@/lib/ai/providers";
import type { AIProvider } from "@/stores/settingsStore";
import { APP_MANIFESTS, SYSTEM_ACTIONS } from "@/lib/os/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Você é o assistente do Raooza, um sistema operacional web inspirado no Windows 11.
Você pode operar o sistema através de ações JSON.

Quando o usuário pedir algo que envolve manipular notas, tarefas, timer, configurações, hábitos, calendário, wiki, etc.,
responda SEMPRE com um objeto JSON válido no seguinte formato (e nada mais, sem markdown, sem code fences):

{
  "explanation": "Explicação curta do que você vai fazer",
  "actions": [
    {
      "app": "notes | kanban | pomodoro | editor | settings | calendar | habits | timetracker | wiki | system",
      "action": "nome da ação",
      "payload": { ... },
      "schedule": { "type": "now" }
    }
  ]
}

Para agendar para o futuro use: "schedule": { "type": "once", "at": "2026-06-22T14:00:00Z" }

Ações disponíveis:

${APP_MANIFESTS.map((app) => {
  if (!app.actions || app.actions.length === 0) return null;
  return `### App: ${app.id} (${app.name})
${app.actions
  .map(
    (a) =>
      `- action: "${a.action}" — ${a.description}\n  payload: ${JSON.stringify(a.payloadSchema)}`,
  )
  .join("\n")}`;
})
  .filter(Boolean)
  .join("\n\n")}

${SYSTEM_ACTIONS.map((a) => `- action: "${a.action}" (system) — ${a.description}\n  payload: ${JSON.stringify(a.payloadSchema)}`).join("\n")}

Regras:
1. Sempre responda em português brasileiro.
2. Se a ação envolve criar/agendar algo futuro, use schedule.type="once" e at em ISO 8601.
3. Não invente ações — use somente as do schema acima.
4. Se o usuário só faz uma pergunta conceitual (sem pedir para fazer algo), responda normalmente em texto, sem JSON.
5. Quando criar nota e o usuário não disser a cor, use "#fbbf24".
6. Quando criar tarefa kanban e não disser a coluna, omita columnId (vai para a primeira).
7. Seja conciso na explicação.
8. Não use código markdown (sem \`\`\`json). Retorne JSON puro quando for agir.
9. Para o daily review, basta uma action system.dailyReview.
10. Para criar evento de calendário, sempre inclua startAt em ISO 8601 (ex: 2026-06-22T14:00:00Z).
11. Para marcar hábito hoje, use habits.checkin com apenas habitId.
12. Para iniciar timer, use timetracker.start. Para parar, timetracker.stop.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const providerId = body.provider as AIProvider;
    const apiKey = (body.apiKey as string) ?? "";
    const model = (body.model as string) ?? "";
    const messages = body.messages as any[];

    if (!providerId || !PROVIDERS[providerId]) {
      return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
    }

    const provider = PROVIDERS[providerId];

    // For GLM, allow empty API key (uses SDK env)
    if (providerId !== "glm" && !apiKey) {
      return NextResponse.json(
        { error: `API key necessária para ${provider.name}. Configure em Configurações > IA.` },
        { status: 400 },
      );
    }

    const finalMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    let content: string;

    if (providerId === "glm" && !apiKey) {
      // Use z-ai-web-dev-sdk (server-side only)
      try {
        const ZAIMod = await import("z-ai-web-dev-sdk");
        const ZAI = (ZAIMod as any).default || (ZAIMod as any).ZAI || ZAIMod;
        const zai = await ZAI.create();
        const res = await zai.chat.completions.create({
          model: model || provider.defaultModel,
          messages: finalMessages,
          temperature: 0.4,
        });
        content = res.choices?.[0]?.message?.content ?? "";
      } catch (e: any) {
        return NextResponse.json(
          { error: `GLM SDK erro: ${e?.message ?? String(e)}. Configure uma API key própria em Configurações > IA.` },
          { status: 500 },
        );
      }
    } else {
      // OpenAI-compatible endpoint
      content = await openAICompatibleChat(
        provider.baseUrl,
        apiKey,
        model || provider.defaultModel,
        finalMessages,
      );
    }

    return NextResponse.json({ content });
  } catch (e: any) {
    console.error("[/api/ai]", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
