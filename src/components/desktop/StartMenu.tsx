"use client";

import { useState } from "react";
import { APP_MANIFESTS } from "@/lib/os/registry";
import {
  StickyNote,
  Timer,
  Trello,
  FileText,
  Sparkles,
  Settings as SettingsIcon,
  Folder,
  Search,
  Power,
  X,
  Calendar,
  Clock,
  Flame,
  Network,
  Upload,
  Brain,
  LayoutTemplate,
  Zap,
  Video,
  MessageCircle,
  GraduationCap,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settingsStore";

const ICONS: Record<string, any> = {
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
  importer: Upload,
  myday: Brain,
  templates: LayoutTemplate,
  snippets: Zap,
  video: Video,
  messages: MessageCircle,
  youtube: GraduationCap,
  intel: Radar,
};

interface Props {
  onClose: () => void;
  onOpenApp: (appId: string) => void;
}

export function StartMenu({ onClose, onOpenApp }: Props) {
  const [query, setQuery] = useState("");
  const accent = useSettings((s) => s.accent);
  const setBooted = useSettings((s) => s.setBooted);

  const filtered = APP_MANIFESTS.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.description.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="fixed inset-0 z-[8999]" onClick={onClose} />
      <div
        className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[9000] w-[calc(100vw-1rem)] max-w-[640px] rounded-2xl border border-border/60 bg-card/85 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ maxHeight: "70vh" }}
      >
        {/* Search */}
        <div className="p-4 border-b border-border/40">
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-muted/60 border border-border/60 focus-within:border-primary/60 transition">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar apps..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Apps grid */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(70vh - 130px)" }}>
          <div className="text-xs text-muted-foreground font-medium mb-3 px-1">
            {query ? "Resultados" : "Todos os aplicativos"}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
            {filtered.map((m) => {
              const Icon = ICONS[m.id] ?? Sparkles;
              return (
                <button
                  key={m.id}
                  onClick={() => onOpenApp(m.id)}
                  className="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-lg hover:bg-muted/60 transition group"
                >
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl grid place-items-center group-hover:scale-105 transition"
                    style={{ background: `${accent}20`, color: accent }}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] sm:text-xs text-center font-medium truncate max-w-full">{m.name}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-4 text-center text-sm text-muted-foreground py-8">
                Nenhum app encontrado
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full grid place-items-center text-white text-sm font-bold"
              style={{ background: accent }}
            >
              R
            </div>
            <span className="text-sm font-medium">Raooza</span>
          </div>
          <button
            onClick={() => {
              if (confirm("Reiniciar o Raooza?")) {
                setBooted(false);
                location.reload();
              }
            }}
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-muted/60 transition text-muted-foreground hover:text-foreground"
            title="Reiniciar"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
