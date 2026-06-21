"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useWindowStore } from "@/stores/windowStore";
import { useSystemBus } from "@/stores/systemBus";
import { useSettings } from "@/stores/settingsStore";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/db";
import { APP_MANIFESTS } from "@/lib/os/registry";
import {
  Search,
  Sparkles,
  StickyNote,
  Timer,
  Trello,
  FileText,
  Calendar,
  Clock,
  Flame,
  Network,
  Folder,
  Settings as SettingsIcon,
  Brain,
  Plus,
  CheckCircle2,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const APP_ICONS: Record<string, any> = {
  notes: StickyNote,
  pomodoro: Timer,
  kanban: Trello,
  editor: FileText,
  assistant: Sparkles,
  settings: SettingsIcon,
  fileexplorer: Folder,
  calendar: Calendar,
  timetracker: Clock,
  habits: Flame,
  wiki: Network,
};

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  category: string;
  action: () => void;
  keywords?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openWindow = useWindowStore((s) => s.open);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);
  const enterFocusMode = useSystemBus((s) => s.enterFocusMode);
  const toggleMode = useSettings((s) => s.toggleMode);

  const notes = useLiveQuery(async () => (await getDb().notes.toArray()).slice(0, 50), []);
  const tasks = useLiveQuery(async () => (await getDb().kanbanTasks.toArray()).slice(0, 50), []);
  const wikiPages = useLiveQuery(async () => (await getDb().wikiPages.toArray()).slice(0, 50), []);
  const events = useLiveQuery(async () => {
    const all = await getDb().calendarEvents.toArray();
    const now = new Date().toISOString();
    return all.filter((e) => e.startAt >= now).slice(0, 20);
  }, []);

  function openApp(appId: string) {
    const m = APP_MANIFESTS.find((x) => x.id === appId);
    if (!m) return;
    openWindow({
      appId,
      title: m.name,
      icon: null,
      width: m.defaultSize.width,
      height: m.defaultSize.height,
    });
    onClose();
  }

  async function createNote() {
    const now = new Date().toISOString();
    const note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "Nova nota",
      content: "",
      color: "#fbbf24",
      pinned: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().notes.add(note);
    openWindow({
      appId: "notes",
      title: "Notas",
      icon: null,
      width: 900,
      height: 640,
      payload: { noteId: note.id },
    });
    triggerRefresh();
    onClose();
  }

  async function createTask() {
    const boards = await getDb().kanbanBoards.toArray();
    if (boards.length === 0) {
      notify({ app: "kanban", title: "Abra o Kanban primeiro para criar o board" });
      openApp("kanban");
      return;
    }
    const board = boards[0];
    const firstCol = board.columns[0];
    if (!firstCol) return;
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      boardId: board.id,
      columnId: firstCol.id,
      title: "Nova tarefa",
      order: (await getDb().kanbanTasks.where({ boardId: board.id, columnId: firstCol.id }).count()),
      tags: [],
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await getDb().kanbanTasks.add(task);
    openApp("kanban");
    triggerRefresh();
    onClose();
  }

  function openNote(id: string) {
    openWindow({
      appId: "notes",
      title: "Notas",
      icon: null,
      width: 900,
      height: 640,
      payload: { noteId: id },
    });
    onClose();
  }

  function openTask() {
    openApp("kanban");
  }

  function openWikiPage(id: string) {
    openWindow({
      appId: "wiki",
      title: "Wiki",
      icon: null,
      width: 1100,
      height: 720,
      payload: { pageId: id },
    });
    onClose();
  }

  // Build command list
  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

    // Apps
    APP_MANIFESTS.forEach((app) => {
      const Icon = APP_ICONS[app.id] ?? Sparkles;
      items.push({
        id: `app-${app.id}`,
        title: app.name,
        subtitle: app.description,
        icon: Icon,
        category: "Apps",
        action: () => openApp(app.id),
        keywords: [app.id, app.name.toLowerCase()],
      });
    });

    // Quick actions
    items.push({
      id: "qa-new-note",
      title: "Nova nota",
      subtitle: "Cria uma nota em branco",
      icon: Plus,
      category: "Ações rápidas",
      action: createNote,
      keywords: ["nota", "new", "note", "criar"],
    });
    items.push({
      id: "qa-new-task",
      title: "Nova tarefa",
      subtitle: "Adiciona ao Kanban",
      icon: Plus,
      category: "Ações rápidas",
      action: createTask,
      keywords: ["tarefa", "task", "kanban", "criar"],
    });
    items.push({
      id: "qa-focus",
      title: "Entrar em Modo Foco",
      subtitle: "DND + Pomodoro",
      icon: Brain,
      category: "Ações rápidas",
      action: () => { enterFocusMode(); onClose(); },
      keywords: ["foco", "focus", "dnd", "pomodoro"],
    });
    items.push({
      id: "qa-toggle-theme",
      title: "Alternar tema claro/escuro",
      icon: SettingsIcon,
      category: "Ações rápidas",
      action: () => { toggleMode(); onClose(); },
      keywords: ["tema", "theme", "dark", "light", "claro", "escuro"],
    });

    // Notes
    (notes ?? []).forEach((n) => {
      items.push({
        id: `note-${n.id}`,
        title: n.title || "Sem título",
        subtitle: `Nota · ${n.content.slice(0, 60) || "vazia"}`,
        icon: StickyNote,
        category: "Notas",
        action: () => openNote(n.id),
        keywords: [n.title.toLowerCase(), n.content.toLowerCase(), ...n.tags],
      });
    });

    // Tasks
    (tasks ?? []).forEach((t) => {
      items.push({
        id: `task-${t.id}`,
        title: t.title,
        subtitle: `Tarefa kanban`,
        icon: Trello,
        category: "Tarefas",
        action: openTask,
        keywords: [t.title.toLowerCase(), ...(t.tags ?? [])],
      });
    });

    // Wiki
    (wikiPages ?? []).forEach((p) => {
      items.push({
        id: `wiki-${p.id}`,
        title: p.title,
        subtitle: `Página wiki`,
        icon: Network,
        category: "Wiki",
        action: () => openWikiPage(p.id),
        keywords: [p.title.toLowerCase(), p.content.toLowerCase()],
      });
    });

    // Events (upcoming)
    (events ?? []).forEach((e) => {
      const date = new Date(e.startAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      items.push({
        id: `event-${e.id}`,
        title: e.title,
        subtitle: `Evento · ${date}`,
        icon: Calendar,
        category: "Eventos",
        action: () => openApp("calendar"),
        keywords: [e.title.toLowerCase()],
      });
    });

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, tasks, wikiPages, events]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      if (c.subtitle?.toLowerCase().includes(q)) return true;
      if (c.keywords?.some((k) => k.includes(q))) return true;
      return false;
    });
  }, [query, commands]);

  // Group
  const grouped = useMemo(() => {
    const g: Record<string, CommandItem[]> = {};
    filtered.forEach((c) => {
      if (!g[c.category]) g[c.category] = [];
      g[c.category].push(c);
    });
    return g;
  }, [filtered]);

  // Reset selected when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) item.action();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[9600] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-3 sm:px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-2xl border border-border/60 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar apps, notas, tarefas, ações..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 text-muted-foreground">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum resultado para "{query}"
            </div>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-2">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1.5">
                {category}
              </div>
              {items.map((item) => {
                runningIdx++;
                const idx = runningIdx;
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={item.action}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40",
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-md grid place-items-center flex-shrink-0",
                      isSelected ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground",
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                      )}
                    </div>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/20 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 rounded border border-border/60 bg-background">↑↓</kbd> navegar</span>
            <span><kbd className="px-1 rounded border border-border/60 bg-background">↵</kbd> executar</span>
            <span><kbd className="px-1 rounded border border-border/60 bg-background">esc</kbd> fechar</span>
          </div>
          <span>{filtered.length} resultado(s)</span>
        </div>
      </div>
    </div>
  );
}
