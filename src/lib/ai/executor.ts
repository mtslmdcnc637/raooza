// Raooza OS - AI Action Executor
// Executes RaoozaAction objects against the system (notes, kanban, pomodoro, etc.)

import { getDb, type NoteRecord, type KanbanBoard, type KanbanTask } from "@/lib/db/db";
import { useSettings } from "@/stores/settingsStore";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import type { RaoozaAction } from "@/lib/os/types";

export interface ActionResult {
  ok: boolean;
  message: string;
  data?: any;
}

function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ensure default board exists
async function ensureDefaultBoard(): Promise<KanbanBoard> {
  const db = getDb();
  const existing = await db.kanbanBoards.toArray();
  if (existing.length > 0) return existing[0];
  const board: KanbanBoard = {
    id: uid("board"),
    title: "Meu Quadro",
    columns: [
      { id: uid("col"), title: "A Fazer", color: "#94a3b8" },
      { id: uid("col"), title: "Em Andamento", color: "#f59e0b" },
      { id: uid("col"), title: "Concluído", color: "#10b981" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.kanbanBoards.add(board);
  return board;
}

export async function executeAction(action: RaoozaAction): Promise<ActionResult> {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    switch (action.app) {
      // ============ NOTES ============
      case "notes": {
        switch (action.action) {
          case "create": {
            const note: NoteRecord = {
              id: uid("note"),
              title: action.payload.title ?? "Sem título",
              content: action.payload.content ?? "",
              color: action.payload.color ?? "#fbbf24",
              pinned: !!action.payload.pinned,
              position: action.payload.pinned ? { x: 80 + Math.random() * 200, y: 80 + Math.random() * 100 } : undefined,
              tags: action.payload.tags ?? [],
              createdAt: now,
              updatedAt: now,
            };
            await db.notes.add(note);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Nota criada: "${note.title}"`, data: note };
          }
          case "update": {
            const existing = await db.notes.get(action.payload.id);
            if (!existing) return { ok: false, message: "Nota não encontrada" };
            const updated: NoteRecord = {
              ...existing,
              title: action.payload.title ?? existing.title,
              content: action.payload.content ?? existing.content,
              pinned: action.payload.pinned ?? existing.pinned,
              updatedAt: now,
            };
            await db.notes.put(updated);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Nota atualizada: "${updated.title}"` };
          }
          case "delete": {
            await db.notes.delete(action.payload.id);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Nota apagada" };
          }
          case "pin": {
            const existing = await db.notes.get(action.payload.id);
            if (!existing) return { ok: false, message: "Nota não encontrada" };
            const pinned = !!action.payload.pinned;
            await db.notes.update(action.payload.id, {
              pinned,
              position: pinned ? existing.position ?? { x: 80 + Math.random() * 200, y: 80 + Math.random() * 100 } : undefined,
              updatedAt: now,
            });
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: pinned ? "Nota fixada no desktop" : "Nota desafixada" };
          }
          case "list": {
            const notes = await db.notes.toArray();
            return { ok: true, message: `${notes.length} nota(s)`, data: notes };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ KANBAN ============
      case "kanban": {
        switch (action.action) {
          case "createTask": {
            const board = action.payload.boardId
              ? await db.kanbanBoards.get(action.payload.boardId)
              : await ensureDefaultBoard();
            if (!board) return { ok: false, message: "Board não encontrado" };
            const columnId = action.payload.columnId ?? board.columns[0]?.id;
            if (!columnId) return { ok: false, message: "Sem coluna no board" };
            const existingTasks = await db.kanbanTasks
              .where({ boardId: board.id, columnId })
              .toArray();
            const task: KanbanTask = {
              id: uid("task"),
              boardId: board.id,
              columnId,
              title: action.payload.title,
              description: action.payload.description,
              order: existingTasks.length,
              tags: action.payload.tags ?? [],
              dueDate: action.payload.dueDate,
              pomodoroCount: 0,
              createdAt: now,
              updatedAt: now,
            };
            await db.kanbanTasks.add(task);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Tarefa criada: "${task.title}"`, data: task };
          }
          case "moveTask": {
            const task = await db.kanbanTasks.get(action.payload.taskId);
            if (!task) return { ok: false, message: "Tarefa não encontrada" };
            const tasksInCol = await db.kanbanTasks
              .where({ boardId: task.boardId, columnId: action.payload.columnId })
              .toArray();
            await db.kanbanTasks.update(action.payload.taskId, {
              columnId: action.payload.columnId,
              order: tasksInCol.length,
              updatedAt: now,
            });
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Tarefa movida" };
          }
          case "updateTask": {
            const task = await db.kanbanTasks.get(action.payload.taskId);
            if (!task) return { ok: false, message: "Tarefa não encontrada" };
            await db.kanbanTasks.update(action.payload.taskId, {
              title: action.payload.title ?? task.title,
              description: action.payload.description ?? task.description,
              dueDate: action.payload.dueDate ?? task.dueDate,
              updatedAt: now,
            });
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Tarefa atualizada" };
          }
          case "deleteTask": {
            await db.kanbanTasks.delete(action.payload.taskId);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Tarefa apagada" };
          }
          case "createColumn": {
            const board = action.payload.boardId
              ? await db.kanbanBoards.get(action.payload.boardId)
              : await ensureDefaultBoard();
            if (!board) return { ok: false, message: "Board não encontrado" };
            board.columns.push({
              id: uid("col"),
              title: action.payload.title,
              color: action.payload.color,
            });
            board.updatedAt = now;
            await db.kanbanBoards.put(board);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Coluna criada: "${action.payload.title}"` };
          }
          case "list": {
            const boards = await db.kanbanBoards.toArray();
            const tasks = await db.kanbanTasks.toArray();
            return { ok: true, message: `${boards.length} board(s), ${tasks.length} tarefa(s)`, data: { boards, tasks } };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ POMODORO ============
      case "pomodoro": {
        switch (action.action) {
          case "start": {
            // Signal pomodoro app via system bus + open it
            useWindowStore.getState().open({
              appId: "pomodoro",
              title: "Pomodoro",
              icon: null as any,
            });
            useSystemBus.getState().notify({
              app: "pomodoro",
              title: "Pomodoro iniciado",
              body: `Ciclo: ${action.payload.type ?? "focus"}`,
            });
            return { ok: true, message: "Pomodoro aberto" };
          }
          case "stop": {
            useSystemBus.getState().notify({
              app: "pomodoro",
              title: "Pomodoro parado",
            });
            return { ok: true, message: "Pomodoro parado" };
          }
          case "stats": {
            const sessions = await db.pomodoroSessions.toArray();
            const focus = sessions.filter((s) => s.type === "focus" && s.completed);
            const totalMin = focus.reduce((a, s) => a + s.durationSec, 0) / 60;
            return {
              ok: true,
              message: `${focus.length} sessões de foco, ${Math.round(totalMin)} min total`,
              data: { sessions: focus.length, totalMin },
            };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ EDITOR ============
      case "editor": {
        switch (action.action) {
          case "create": {
            const doc = {
              id: uid("doc"),
              title: action.payload.title ?? "Sem título",
              blocks: parseMarkdownToBlocks(action.payload.content ?? ""),
              createdAt: now,
              updatedAt: now,
            };
            await db.editorDocs.add(doc);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Documento criado: "${doc.title}"`, data: doc };
          }
          case "list": {
            const docs = await db.editorDocs.toArray();
            return { ok: true, message: `${docs.length} documento(s)`, data: docs };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ SETTINGS ============
      case "settings": {
        switch (action.action) {
          case "setTheme": {
            useSettings.getState().setMode(action.payload.mode);
            return { ok: true, message: `Tema: ${action.payload.mode}` };
          }
          case "setWallpaper": {
            useSettings.getState().setWallpaper(action.payload.id);
            return { ok: true, message: `Wallpaper: ${action.payload.id}` };
          }
          case "setAccent": {
            useSettings.getState().setAccent(action.payload.hex);
            return { ok: true, message: `Acento: ${action.payload.hex}` };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ SYSTEM ============
      case "system": {
        switch (action.action) {
          case "notify": {
            useSystemBus.getState().notify({
              app: "system",
              title: action.payload.title ?? "Notificação",
              body: action.payload.body,
            });
            return { ok: true, message: "Notificação enviada" };
          }
          case "openApp": {
            useWindowStore.getState().open({
              appId: action.payload.appId,
              title: action.payload.title ?? action.payload.appId,
              icon: null as any,
            });
            return { ok: true, message: `App aberto: ${action.payload.appId}` };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      default:
        return { ok: false, message: `App desconhecido: ${action.app}` };
    }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

export async function executeBatch(actions: RaoozaAction[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of actions) {
    if (action.schedule?.type === "once" && action.schedule.at) {
      // Schedule for later
      const { getDb } = await import("@/lib/db/db");
      await getDb().scheduledActions.add({
        id: uid("sched"),
        action,
        at: action.schedule.at,
        executed: false,
        createdAt: new Date().toISOString(),
      });
      results.push({ ok: true, message: `Agendado para ${new Date(action.schedule.at).toLocaleString("pt-BR")}` });
    } else {
      const r = await executeAction(action);
      results.push(r);
      useSystemBus.getState().notify({
        app: action.app,
        title: r.ok ? "✓ " + action.app : "✗ " + action.app,
        body: r.message,
      });
    }
  }
  return results;
}

// Simple markdown-to-blocks parser for editor
function parseMarkdownToBlocks(md: string): any[] {
  if (!md) return [];
  const lines = md.split("\n");
  const blocks: any[] = [];
  for (const line of lines) {
    if (line.startsWith("# ")) {
      blocks.push({ type: "heading1", text: line.slice(2) });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "heading2", text: line.slice(3) });
    } else if (line.startsWith("- ")) {
      blocks.push({ type: "bullet", text: line.slice(2) });
    } else if (line.trim()) {
      blocks.push({ type: "paragraph", text: line });
    }
  }
  return blocks;
}
