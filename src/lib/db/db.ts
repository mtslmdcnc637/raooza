// Raooza OS - IndexedDB via Dexie

import Dexie, { type Table } from "dexie";
import type { ScheduledAction } from "@/lib/os/types";

export interface NoteRecord {
  id: string;
  title: string;
  content: string; // markdown-ish
  color: string; // accent for sticky
  pinned: boolean; // pinned to desktop
  position?: { x: number; y: number }; // desktop position
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanBoard {
  id: string;
  title: string;
  columns: KanbanColumn[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
}

export interface KanbanTask {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  order: number;
  linkedNoteId?: string;
  pomodoroCount?: number; // sessions logged
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroSession {
  id: string;
  startedAt: string;
  durationSec: number;
  type: "focus" | "short-break" | "long-break";
  taskId?: string; // kanban task
  completed: boolean;
}

export interface EditorDoc {
  id: string;
  title: string;
  blocks: any[]; // Notion-like blocks
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: any[]; // actions executed
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startAt: string; // ISO 8601
  endAt?: string;
  allDay?: boolean;
  color?: string;
  linkedTaskId?: string;
  linkedNoteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  title: string;
  cadence: "daily" | "weekly";
  color?: string;
  targetPerWeek?: number; // for weekly cadence
  icon?: string;
  createdAt: string;
  archivedAt?: string;
}

export interface HabitCheckin {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  taskId?: string; // kanban task
  description: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  createdAt: string;
}

export interface WikiPage {
  id: string;
  title: string;
  content: string; // markdown with [[wiki links]]
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectImport {
  id: string;
  fileName: string;
  projectName: string;
  projectDescription?: string;
  tag: string;
  items: Array<{ app: string; id: string }>; // all created item IDs by app
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: "note" | "doc" | "wiki" | "kanban-tasks";
  content: string; // markdown content (for note/doc/wiki) or JSON array of task titles (for kanban-tasks)
  tags?: string[];
  icon?: string;
  isBuiltin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Snippet {
  id: string;
  trigger: string; // e.g. "/meeting"
  name: string;
  content: string; // expanded text
  isBuiltin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export class RaoozaDB extends Dexie {
  notes!: Table<NoteRecord, string>;
  kanbanBoards!: Table<KanbanBoard, string>;
  kanbanTasks!: Table<KanbanTask, string>;
  pomodoroSessions!: Table<PomodoroSession, string>;
  editorDocs!: Table<EditorDoc, string>;
  conversations!: Table<ChatConversation, string>;
  scheduledActions!: Table<ScheduledAction, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  habits!: Table<Habit, string>;
  habitCheckins!: Table<HabitCheckin, string>;
  timeEntries!: Table<TimeEntry, string>;
  wikiPages!: Table<WikiPage, string>;
  imports!: Table<ProjectImport, string>;
  templates!: Table<Template, string>;
  snippets!: Table<Snippet, string>;

  constructor() {
    super("raooza");
    this.version(5).stores({
      notes: "id, pinned, updatedAt, *tags",
      kanbanBoards: "id, updatedAt",
      kanbanTasks: "id, boardId, columnId, order, updatedAt, *tags",
      pomodoroSessions: "id, startedAt, type, taskId, completed",
      editorDocs: "id, updatedAt",
      conversations: "id, updatedAt",
      scheduledActions: "id, at, executed",
      calendarEvents: "id, startAt, linkedTaskId, linkedNoteId",
      habits: "id, cadence, archivedAt",
      habitCheckins: "id, habitId, date, createdAt",
      timeEntries: "id, taskId, startedAt, endedAt",
      wikiPages: "id, updatedAt, *tags",
      imports: "id, tag, createdAt",
      templates: "id, category, name",
      snippets: "id, &trigger, name",
    });
  }
}

let _db: RaoozaDB | null = null;

export function getDb(): RaoozaDB {
  if (typeof window === "undefined") {
    // SSR fallback - shouldn't be used
    return {} as RaoozaDB;
  }
  if (!_db) {
    _db = new RaoozaDB();
  }
  return _db;
}
