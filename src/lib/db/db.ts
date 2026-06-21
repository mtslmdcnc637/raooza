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

export interface VideoProject {
  id: string;
  title: string;
  description?: string;
  status: "idea" | "scripting" | "recording" | "editing" | "published" | "archived";
  platform?: "youtube" | "tiktok" | "instagram" | "twitter" | "other";
  targetDuration?: number; // seconds
  thumbnailIdeas?: string;
  publishedUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoPrompt {
  id: string;
  projectId: string;
  title: string;
  content: string;
  type: "image" | "video" | "audio" | "text" | "thumbnail";
  rating: number; // 0-5
  status: "draft" | "testing" | "approved" | "rejected";
  result?: string; // what was generated / URL
  notes?: string; // what worked, what didn't
  tags: string[];
  version: number;
  parentPromptId?: string; // for prompt iterations
  createdAt: string;
  updatedAt: string;
}

export interface VideoNote {
  id: string;
  projectId: string;
  type: "hook" | "script" | "shot" | "broll" | "idea" | "general";
  title: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// E2E Messaging — all ciphertexts, never plaintext keys leave the device
export interface Peer {
  id: string; // peer's public ID (short hash of their pubkey)
  displayName: string; // local name you gave them (only on your device)
  publicKey: string; // their pubkey (base64) — needed to encrypt to them
  addedAt: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  peerId: string; // who sent or received
  direction: "in" | "out";
  // Plaintext (decrypted locally). Stored only on the device of the owner.
  plaintext: string;
  createdAt: string;
  read: boolean;
  // Optional: pinned as a note in the center of the screen
  pinned: boolean;
  pinnedAt?: string;
}

// YouTube Studio — study tool for YouTube videos
export interface YouTubeVideo {
  id: string;
  videoId: string; // YouTube video ID (from URL)
  title: string;
  channel?: string;
  thumbnail?: string;
  status: "not-started" | "in-progress" | "completed";
  progressSec: number; // last position
  durationSec?: number;
  addedAt: string;
  updatedAt: string;
}

export interface YouTubeNote {
  id: string;
  videoId: string; // links to YouTubeVideo.id
  timestampSec?: number; // video moment when note was taken (optional)
  content: string; // markdown-ish
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeBookmark {
  id: string;
  videoId: string;
  timestampSec: number;
  label: string;
  color?: string;
  createdAt: string;
}

export interface YouTubeFlashcard {
  id: string;
  videoId: string;
  front: string;
  back: string;
  lastReviewedAt?: string;
  correctCount: number;
  incorrectCount: number;
  createdAt: string;
}

export interface YouTubeCanvas {
  id: string;
  videoId: string;
  timestampSec?: number; // optional: linked to a video moment
  title: string;
  // Array of stroke objects: { color, size, points: [[x,y],...] }
  strokes: any[];
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
  videoProjects!: Table<VideoProject, string>;
  videoPrompts!: Table<VideoPrompt, string>;
  videoNotes!: Table<VideoNote, string>;
  peers!: Table<Peer, string>;
  messages!: Table<Message, string>;
  youtubeVideos!: Table<YouTubeVideo, string>;
  youtubeNotes!: Table<YouTubeNote, string>;
  youtubeBookmarks!: Table<YouTubeBookmark, string>;
  youtubeFlashcards!: Table<YouTubeFlashcard, string>;
  youtubeCanvases!: Table<YouTubeCanvas, string>;

  constructor() {
    super("raooza");
    this.version(8).stores({
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
      videoProjects: "id, status, platform, updatedAt",
      videoPrompts: "id, projectId, type, status, rating, updatedAt, *tags",
      videoNotes: "id, projectId, type, order, updatedAt",
      peers: "id, displayName, addedAt",
      messages: "id, peerId, direction, createdAt, read, pinned",
      youtubeVideos: "id, videoId, status, updatedAt",
      youtubeNotes: "id, videoId, timestampSec, updatedAt",
      youtubeBookmarks: "id, videoId, timestampSec",
      youtubeFlashcards: "id, videoId, lastReviewedAt",
      youtubeCanvases: "id, videoId, timestampSec, updatedAt",
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
