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
          case "enterFocusMode": {
            useSystemBus.getState().enterFocusMode(action.payload.taskId);
            useWindowStore.getState().open({
              appId: "pomodoro",
              title: "Pomodoro",
              icon: null as any,
            });
            return { ok: true, message: "Modo foco ativado" };
          }
          case "exitFocusMode": {
            useSystemBus.getState().exitFocusMode();
            return { ok: true, message: "Modo foco desativado" };
          }
          case "dailyReview": {
            // Aggregate today's activity and call AI
            const todayStr = new Date().toDateString();
            const [notes, tasks, sessions, events, checkins, timeEntries] = await Promise.all([
              db.notes.toArray(),
              db.kanbanTasks.toArray(),
              db.pomodoroSessions.toArray(),
              db.calendarEvents.toArray(),
              db.habitCheckins.toArray(),
              db.timeEntries.toArray(),
            ]);
            const todayNotes = notes.filter((n) => new Date(n.updatedAt).toDateString() === todayStr);
            const todayCompleted = tasks.filter((t) => new Date(t.updatedAt).toDateString() === todayStr && (t as any).columnId === "done");
            const todayFocus = sessions.filter((s) => s.type === "focus" && new Date(s.startedAt).toDateString() === todayStr);
            const todayCheckins = checkins.filter((c) => new Date(c.createdAt).toDateString() === todayStr);
            const todayEvents = events.filter((e) => new Date(e.startAt).toDateString() === todayStr);
            const todayTime = timeEntries.filter((t) => new Date(t.startedAt).toDateString() === todayStr);

            const summary = {
              date: new Date().toLocaleDateString("pt-BR"),
              notesCreated: todayNotes.length,
              notesTitles: todayNotes.map((n) => n.title),
              tasksCompleted: todayCompleted.length,
              focusSessions: todayFocus.length,
              focusMinutes: Math.round(todayFocus.reduce((a, s) => a + s.durationSec, 0) / 60),
              habitCheckins: todayCheckins.length,
              events: todayEvents.length,
              timeTrackedMinutes: Math.round(todayTime.reduce((a, t) => a + (t.durationSec ?? 0), 0) / 60),
            };
            useSystemBus.getState().notify({
              app: "system",
              title: "📋 Daily Review",
              body: `${summary.notesCreated} notas · ${summary.tasksCompleted} tarefas · ${summary.focusSessions} pomodoros · ${summary.habitCheckins} hábitos`,
            });
            return { ok: true, message: "Daily Review gerado", data: summary };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ CALENDAR ============
      case "calendar": {
        switch (action.action) {
          case "createEvent": {
            const ev = {
              id: uid("evt"),
              title: action.payload.title,
              description: action.payload.description,
              startAt: action.payload.startAt,
              endAt: action.payload.endAt,
              allDay: !!action.payload.allDay,
              color: action.payload.color ?? "#0078D4",
              linkedTaskId: action.payload.linkedTaskId,
              linkedNoteId: action.payload.linkedNoteId,
              createdAt: now,
              updatedAt: now,
            };
            await db.calendarEvents.add(ev);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Evento criado: "${ev.title}"`, data: ev };
          }
          case "updateEvent": {
            const existing = await db.calendarEvents.get(action.payload.id);
            if (!existing) return { ok: false, message: "Evento não encontrado" };
            await db.calendarEvents.update(action.payload.id, {
              ...existing,
              ...action.payload,
              updatedAt: now,
            });
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Evento atualizado" };
          }
          case "deleteEvent": {
            await db.calendarEvents.delete(action.payload.id);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Evento apagado" };
          }
          case "list": {
            let evs = await db.calendarEvents.toArray();
            if (action.payload.from) evs = evs.filter((e) => e.startAt >= action.payload.from);
            if (action.payload.to) evs = evs.filter((e) => e.startAt <= action.payload.to);
            return { ok: true, message: `${evs.length} evento(s)`, data: evs };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ HABITS ============
      case "habits": {
        switch (action.action) {
          case "createHabit": {
            const h = {
              id: uid("habit"),
              title: action.payload.title,
              cadence: action.payload.cadence ?? "daily",
              color: action.payload.color ?? "#10B981",
              targetPerWeek: action.payload.targetPerWeek,
              createdAt: now,
            };
            await db.habits.add(h);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Hábito criado: "${h.title}"`, data: h };
          }
          case "checkin": {
            const habit = await db.habits.get(action.payload.habitId);
            if (!habit) return { ok: false, message: "Hábito não encontrado" };
            const date = action.payload.date ?? new Date().toISOString().slice(0, 10);
            const existing = await db.habitCheckins
              .where({ habitId: habit.id, date })
              .first();
            if (existing) return { ok: true, message: "Já estava marcado hoje" };
            await db.habitCheckins.add({
              id: uid("chk"),
              habitId: habit.id,
              date,
              createdAt: now,
            });
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Hábito "${habit.title}" marcado para ${date}` };
          }
          case "uncheckin": {
            const date = action.payload.date ?? new Date().toISOString().slice(0, 10);
            const existing = await db.habitCheckins
              .where({ habitId: action.payload.habitId, date })
              .first();
            if (existing) {
              await db.habitCheckins.delete(existing.id);
              useSystemBus.getState().triggerRefresh();
              return { ok: true, message: "Check-in removido" };
            }
            return { ok: false, message: "Não havia check-in" };
          }
          case "list": {
            const habits = (await db.habits.toArray()).filter((h) => !h.archivedAt);
            const checkins = await db.habitCheckins.toArray();
            return {
              ok: true,
              message: `${habits.length} hábito(s)`,
              data: habits.map((h) => ({
                ...h,
                streak: computeStreak(h, checkins),
                checkins: checkins.filter((c) => c.habitId === h.id).length,
              })),
            };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ TIME TRACKER ============
      case "timetracker": {
        switch (action.action) {
          case "start": {
            // Stop any running timer
            const running = await db.timeEntries.where("endedAt").equals(null as any).first();
            if (running) {
              await db.timeEntries.update(running.id, {
                endedAt: now,
                durationSec: Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000),
              });
            }
            const entry = {
              id: uid("time"),
              taskId: action.payload.taskId,
              description: action.payload.description ?? "",
              startedAt: now,
              createdAt: now,
            };
            await db.timeEntries.add(entry);
            useSystemBus.getState().setTrackerActive(true);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Timer iniciado: ${entry.description || "sem descrição"}`, data: entry };
          }
          case "stop": {
            const running = (await db.timeEntries.toArray()).reverse().find((e) => !e.endedAt);
            if (!running) return { ok: false, message: "Nenhum timer ativo" };
            await db.timeEntries.update(running.id, {
              endedAt: now,
              durationSec: Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000),
            });
            useSystemBus.getState().setTrackerActive(false);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Timer parado" };
          }
          case "list": {
            const entries = action.payload.taskId
              ? await db.timeEntries.where("taskId").equals(action.payload.taskId).toArray()
              : await db.timeEntries.toArray();
            return { ok: true, message: `${entries.length} entrada(s)`, data: entries.reverse() };
          }
          default:
            return { ok: false, message: `Ação desconhecida: ${action.action}` };
        }
      }

      // ============ WIKI ============
      case "wiki": {
        switch (action.action) {
          case "createPage": {
            const page = {
              id: uid("wiki"),
              title: action.payload.title,
              content: action.payload.content ?? "",
              tags: action.payload.tags ?? [],
              createdAt: now,
              updatedAt: now,
            };
            await db.wikiPages.add(page);
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: `Página criada: "${page.title}"`, data: page };
          }
          case "updatePage": {
            const existing = await db.wikiPages.get(action.payload.id);
            if (!existing) return { ok: false, message: "Página não encontrada" };
            await db.wikiPages.update(action.payload.id, {
              ...existing,
              ...action.payload,
              updatedAt: now,
            });
            useSystemBus.getState().triggerRefresh();
            return { ok: true, message: "Página atualizada" };
          }
          case "list": {
            const pages = await db.wikiPages.toArray();
            return { ok: true, message: `${pages.length} página(s)`, data: pages };
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

// Compute current streak for a habit
export function computeStreak(
  habit: { id: string; cadence: "daily" | "weekly" },
  checkins: { habitId: string; date: string }[],
): number {
  const habitCheckins = checkins
    .filter((c) => c.habitId === habit.id)
    .map((c) => c.date)
    .sort();
  if (habitCheckins.length === 0) return 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

  // For daily: streak from today or yesterday backwards
  if (habit.cadence === "daily") {
    let streak = 0;
    let cursor = new Date(today);
    // If not done today, start from yesterday
    if (!habitCheckins.includes(todayStr)) {
      cursor = new Date(today.getTime() - 86400000);
      if (!habitCheckins.includes(yesterdayStr)) return 0;
    }
    while (true) {
      const ds = cursor.toISOString().slice(0, 10);
      if (habitCheckins.includes(ds)) {
        streak++;
        cursor = new Date(cursor.getTime() - 86400000);
      } else break;
    }
    return streak;
  }

  // For weekly: count consecutive weeks with at least 1 check-in
  let streak = 0;
  let weekCursor = new Date(today);
  while (true) {
    const weekStart = new Date(weekCursor);
    weekStart.setDate(weekCursor.getDate() - weekCursor.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const hasCheckin = habitCheckins.some((d) => {
      const dd = new Date(d + "T00:00:00");
      return dd >= weekStart && dd <= weekEnd;
    });
    if (hasCheckin) {
      streak++;
      weekCursor = new Date(weekStart.getTime() - 86400000);
    } else break;
    if (streak > 52) break;
  }
  return streak;
}
