// Raooza OS - App Registry
// Each app registers here. The AI uses this to know what actions are possible.

import type { AppManifest } from "./types";

// We import manifests lazily to avoid SSR issues.
// Apps are registered with metadata only (no JSX here; icons are set in components).

export const APP_MANIFESTS: AppManifest[] = [
  {
    id: "notes",
    name: "Notas",
    description: "Notas inteligentes com sticky notes no desktop",
    icon: null as any,
    defaultSize: { width: 900, height: 640 },
    minSize: { width: 480, height: 360 },
    resizable: true,
    pinnable: true,
    hasStickyMode: true,
    category: "productivity",
    actions: [
      {
        action: "create",
        description: "Cria uma nova nota",
        payloadSchema: {
          title: { type: "string", description: "Título da nota", required: true },
          content: { type: "string", description: "Conteúdo markdown" },
          color: { type: "string", description: "Cor hex", enum: ["#fbbf24", "#34d399", "#60a5fa", "#f87171", "#a78bfa", "#f9fafb"] },
          pinned: { type: "boolean", description: "Fixar no desktop" },
          tags: { type: "array", description: "Lista de tags" },
        },
      },
      {
        action: "update",
        description: "Atualiza uma nota existente",
        payloadSchema: {
          id: { type: "string", required: true, description: "ID da nota" },
          title: { type: "string" },
          content: { type: "string" },
          pinned: { type: "boolean" },
        },
      },
      {
        action: "delete",
        description: "Apaga uma nota",
        payloadSchema: { id: { type: "string", required: true } },
      },
      {
        action: "pin",
        description: "Fixa/desafixa nota no desktop",
        payloadSchema: { id: { type: "string", required: true }, pinned: { type: "boolean", required: true } },
      },
      {
        action: "list",
        description: "Lista todas as notas",
        payloadSchema: {},
      },
    ],
  },
  {
    id: "kanban",
    name: "Kanban",
    description: "Quadro de tarefas com drag & drop",
    icon: null as any,
    defaultSize: { width: 1000, height: 680 },
    minSize: { width: 600, height: 400 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "createTask",
        description: "Cria uma tarefa em uma coluna do quadro",
        payloadSchema: {
          boardId: { type: "string", description: "ID do board (opcional, usa o default se omitido)" },
          columnId: { type: "string", description: "ID da coluna (opcional, usa a primeira se omitido)" },
          title: { type: "string", required: true },
          description: { type: "string" },
          tags: { type: "array" },
          dueDate: { type: "string", description: "ISO 8601" },
        },
      },
      {
        action: "moveTask",
        description: "Move uma tarefa para outra coluna",
        payloadSchema: {
          taskId: { type: "string", required: true },
          columnId: { type: "string", required: true },
        },
      },
      {
        action: "updateTask",
        description: "Atualiza uma tarefa",
        payloadSchema: {
          taskId: { type: "string", required: true },
          title: { type: "string" },
          description: { type: "string" },
          dueDate: { type: "string" },
        },
      },
      {
        action: "deleteTask",
        description: "Apaga uma tarefa",
        payloadSchema: { taskId: { type: "string", required: true } },
      },
      {
        action: "createColumn",
        description: "Cria uma nova coluna no board",
        payloadSchema: {
          boardId: { type: "string" },
          title: { type: "string", required: true },
          color: { type: "string" },
        },
      },
      {
        action: "list",
        description: "Lista boards, colunas e tarefas",
        payloadSchema: {},
      },
    ],
  },
  {
    id: "pomodoro",
    name: "Pomodoro",
    description: "Timer de foco com ciclos e estatísticas",
    icon: null as any,
    defaultSize: { width: 460, height: 640 },
    minSize: { width: 380, height: 480 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "start",
        description: "Inicia um ciclo de pomodoro",
        payloadSchema: {
          type: { type: "string", enum: ["focus", "short-break", "long-break"], description: "Tipo (default: focus)" },
          durationMin: { type: "number", description: "Duração em minutos (opcional)" },
          taskId: { type: "string", description: "ID de tarefa kanban vinculada" },
        },
      },
      {
        action: "stop",
        description: "Para o ciclo atual",
        payloadSchema: {},
      },
      {
        action: "stats",
        description: "Mostra estatísticas de foco",
        payloadSchema: {},
      },
    ],
  },
  {
    id: "editor",
    name: "Editor",
    description: "Editor estilo Notion com blocos e IA",
    icon: null as any,
    defaultSize: { width: 1000, height: 720 },
    minSize: { width: 600, height: 400 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "create",
        description: "Cria um novo documento",
        payloadSchema: {
          title: { type: "string", required: true },
          content: { type: "string", description: "Conteúdo markdown-like" },
        },
      },
      {
        action: "list",
        description: "Lista documentos",
        payloadSchema: {},
      },
    ],
  },
  {
    id: "assistant",
    name: "Assistente",
    description: "Assistente de IA que opera o sistema",
    icon: null as any,
    defaultSize: { width: 520, height: 720 },
    minSize: { width: 380, height: 500 },
    resizable: true,
    pinnable: true,
    category: "ai",
    actions: [],
  },
  {
    id: "fileexplorer",
    name: "Arquivos",
    description: "Navega por notas, documentos e tarefas",
    icon: null as any,
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 480, height: 360 },
    resizable: true,
    pinnable: true,
    category: "system",
    actions: [
      { action: "list", description: "Lista itens por tipo", payloadSchema: { kind: { type: "string", enum: ["notes", "docs", "tasks"], description: "Tipo de item" } } },
    ],
  },
  {
    id: "settings",
    name: "Configurações",
    description: "Tema, wallpaper, provedor IA, API keys",
    icon: null as any,
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 500, height: 400 },
    resizable: true,
    pinnable: true,
    category: "system",
    actions: [
      { action: "setTheme", description: "Define tema", payloadSchema: { mode: { type: "string", enum: ["dark", "light"], required: true } } },
      { action: "setWallpaper", description: "Define wallpaper", payloadSchema: { id: { type: "string", required: true } } },
      { action: "setAccent", description: "Define cor de acento", payloadSchema: { hex: { type: "string", required: true } } },
    ],
  },
  {
    id: "calendar",
    name: "Calendário",
    description: "Agenda com eventos, vinculada a tarefas e notas",
    icon: null as any,
    defaultSize: { width: 1000, height: 680 },
    minSize: { width: 600, height: 480 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "createEvent",
        description: "Cria um evento no calendário",
        payloadSchema: {
          title: { type: "string", required: true },
          description: { type: "string" },
          startAt: { type: "string", required: true, description: "ISO 8601" },
          endAt: { type: "string", description: "ISO 8601" },
          allDay: { type: "boolean" },
          color: { type: "string" },
          linkedTaskId: { type: "string" },
          linkedNoteId: { type: "string" },
        },
      },
      {
        action: "updateEvent",
        description: "Atualiza um evento",
        payloadSchema: {
          id: { type: "string", required: true },
          title: { type: "string" },
          description: { type: "string" },
          startAt: { type: "string" },
          endAt: { type: "string" },
        },
      },
      {
        action: "deleteEvent",
        description: "Apaga um evento",
        payloadSchema: { id: { type: "string", required: true } },
      },
      {
        action: "list",
        description: "Lista eventos (opcionalmente por período)",
        payloadSchema: {
          from: { type: "string", description: "ISO 8601" },
          to: { type: "string", description: "ISO 8601" },
        },
      },
    ],
  },
  {
    id: "habits",
    name: "Hábitos",
    description: "Hábitos diários/semanais com streak e check-in",
    icon: null as any,
    defaultSize: { width: 900, height: 640 },
    minSize: { width: 500, height: 400 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "createHabit",
        description: "Cria um novo hábito",
        payloadSchema: {
          title: { type: "string", required: true },
          cadence: { type: "string", enum: ["daily", "weekly"], description: "Padrão: daily" },
          color: { type: "string" },
          targetPerWeek: { type: "number", description: "Para cadência weekly" },
        },
      },
      {
        action: "checkin",
        description: "Marca hábito como feito hoje (ou data específica)",
        payloadSchema: {
          habitId: { type: "string", required: true },
          date: { type: "string", description: "YYYY-MM-DD (default: hoje)" },
        },
      },
      {
        action: "uncheckin",
        description: "Desmarca check-in",
        payloadSchema: { habitId: { type: "string", required: true }, date: { type: "string" } },
      },
      {
        action: "list",
        description: "Lista hábitos e streaks",
        payloadSchema: {},
      },
    ],
  },
  {
    id: "timetracker",
    name: "Time Tracker",
    description: "Rastreia tempo gasto em tarefas",
    icon: null as any,
    defaultSize: { width: 700, height: 640 },
    minSize: { width: 400, height: 400 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "start",
        description: "Inicia um timer",
        payloadSchema: {
          taskId: { type: "string", description: "ID de tarefa kanban" },
          description: { type: "string" },
        },
      },
      {
        action: "stop",
        description: "Para o timer atual",
        payloadSchema: {},
      },
      {
        action: "list",
        description: "Lista entradas de tempo",
        payloadSchema: { taskId: { type: "string" } },
      },
    ],
  },
  {
    id: "wiki",
    name: "Wiki",
    description: "Base de conhecimento estilo Obsidian com [[links]]",
    icon: null as any,
    defaultSize: { width: 1100, height: 720 },
    minSize: { width: 600, height: 400 },
    resizable: true,
    pinnable: true,
    category: "productivity",
    actions: [
      {
        action: "createPage",
        description: "Cria uma página wiki",
        payloadSchema: {
          title: { type: "string", required: true },
          content: { type: "string", description: "Markdown com [[links]]" },
          tags: { type: "array" },
        },
      },
      {
        action: "updatePage",
        description: "Atualiza uma página",
        payloadSchema: {
          id: { type: "string", required: true },
          title: { type: "string" },
          content: { type: "string" },
        },
      },
      {
        action: "list",
        description: "Lista páginas wiki",
        payloadSchema: {},
      },
    ],
  },
  {
    id: "importer",
    name: "Importar MD",
    description: "Importa um arquivo markdown e configura o ambiente",
    icon: null as any,
    defaultSize: { width: 720, height: 680 },
    minSize: { width: 500, height: 500 },
    resizable: true,
    pinnable: false,
    category: "system",
    actions: [],
  },
];

// System-level actions (not bound to a single app)
export const SYSTEM_ACTIONS = [
  {
    app: "system",
    action: "dailyReview",
    description: "Gera resumo IA do dia e sugestões para amanhã",
    payloadSchema: {},
  },
  {
    app: "system",
    action: "enterFocusMode",
    description: "Entra em modo foco (DND, esconde tudo, abre Pomodoro)",
    payloadSchema: { taskId: { type: "string", description: "Tarefa para focar" } },
  },
  {
    app: "system",
    action: "exitFocusMode",
    description: "Sai do modo foco",
    payloadSchema: {},
  },
  {
    app: "system",
    action: "notify",
    description: "Envia notificação",
    payloadSchema: { title: { type: "string", required: true }, body: { type: "string" } },
  },
  {
    app: "system",
    action: "openApp",
    description: "Abre um app",
    payloadSchema: { appId: { type: "string", required: true }, title: { type: "string" } },
  },
];

export function getManifest(appId: string) {
  return APP_MANIFESTS.find((m) => m.id === appId);
}

export function getActionManifest(appId: string, action: string) {
  const m = getManifest(appId);
  return m?.actions?.find((a) => a.action === action);
}
