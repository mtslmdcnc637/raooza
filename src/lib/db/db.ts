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

export class RaoozaDB extends Dexie {
  notes!: Table<NoteRecord, string>;
  kanbanBoards!: Table<KanbanBoard, string>;
  kanbanTasks!: Table<KanbanTask, string>;
  pomodoroSessions!: Table<PomodoroSession, string>;
  editorDocs!: Table<EditorDoc, string>;
  conversations!: Table<ChatConversation, string>;
  scheduledActions!: Table<ScheduledAction, string>;

  constructor() {
    super("raooza");
    this.version(1).stores({
      notes: "id, pinned, updatedAt, *tags",
      kanbanBoards: "id, updatedAt",
      kanbanTasks: "id, boardId, columnId, order, updatedAt, *tags",
      pomodoroSessions: "id, startedAt, type, taskId, completed",
      editorDocs: "id, updatedAt",
      conversations: "id, updatedAt",
      scheduledActions: "id, at, executed",
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
