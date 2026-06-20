"use client";

import { useEffect, useState } from "react";
import { useWindowStore } from "@/stores/windowStore";
import { useSettings } from "@/stores/settingsStore";
import { useSystemBus } from "@/stores/systemBus";
import { APP_MANIFESTS } from "@/lib/os/registry";
import {
  StickyNote,
  Timer,
  Trello,
  FileText,
  Sparkles,
  Settings as SettingsIcon,
  Folder,
  Wifi,
  Volume2,
  Battery,
  Search,
  Bell,
  Calendar,
  Clock,
  Flame,
  Network,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StartMenu } from "./StartMenu";
import { NotificationCenter } from "./NotificationCenter";

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
};

const PINNED = [
  "notes",
  "kanban",
  "pomodoro",
  "editor",
  "assistant",
  "calendar",
  "habits",
  "timetracker",
  "wiki",
  "fileexplorer",
  "settings",
];

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const minimize = useWindowStore((s) => s.minimize);
  const restore = useWindowStore((s) => s.restore);
  const open = useWindowStore((s) => s.open);
  const activeId = useWindowStore((s) => s.activeId);

  const mode = useSettings((s) => s.mode);
  const toggleMode = useSettings((s) => s.toggleMode);
  const notify = useSystemBus((s) => s.notifications.length);

  const [startOpen, setStartOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  function openApp(appId: string) {
    const m = APP_MANIFESTS.find((x) => x.id === appId);
    if (!m) return;
    open({
      appId,
      title: m.name,
      icon: null,
      width: m.defaultSize.width,
      height: m.defaultSize.height,
    });
    setStartOpen(false);
  }

  function toggleWindow(id: string) {
    const w = windows.find((x) => x.id === id);
    if (!w) return;
    if (w.minimized) restore(id);
    else if (activeId === id) minimize(id);
    else focus(id);
  }

  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      {startOpen && <StartMenu onClose={() => setStartOpen(false)} onOpenApp={openApp} />}

      <div className="fixed bottom-0 left-0 right-0 h-12 z-[9000] px-2 flex items-center justify-between bg-card/70 backdrop-blur-2xl border-t border-border/60">
        {/* Left: start + widgets */}
        <div className="flex items-center gap-1 w-[200px]">
          <button
            onClick={() => setStartOpen((v) => !v)}
            className={cn(
              "h-9 px-3 rounded-md flex items-center gap-2 hover:bg-muted/60 transition",
              startOpen && "bg-muted/60",
            )}
            title="Iniciar"
          >
            <div
              className="w-5 h-5 rounded grid place-items-center text-white text-[10px] font-bold"
              style={{ background: useSettings.getState().accent }}
            >
              R
            </div>
          </button>
        </div>

        {/* Center: app icons */}
        <div className="flex items-center gap-1">
          {PINNED.map((appId) => {
            const Icon = ICONS[appId] ?? Sparkles;
            const wins = windows.filter((w) => w.appId === appId);
            const isRunning = wins.length > 0;
            const isActive = wins.some((w) => w.id === activeId && !w.minimized);
            return (
              <button
                key={appId}
                onClick={() => {
                  if (isRunning) {
                    const w = wins[0];
                    toggleWindow(w.id);
                  } else {
                    openApp(appId);
                  }
                }}
                className={cn(
                  "relative h-9 w-9 grid place-items-center rounded-md hover:bg-muted/60 transition group",
                  isActive && "bg-muted/60",
                )}
                title={APP_MANIFESTS.find((x) => x.id === appId)?.name}
              >
                <Icon className="w-5 h-5 text-foreground" />
                {isRunning && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 rounded-full transition-all"
                    style={{
                      width: isActive ? 16 : 6,
                      background: useSettings.getState().accent,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: system tray */}
        <div className="flex items-center gap-1 w-[220px] justify-end">
          <button
            onClick={() => useSystemBus.getState().enterFocusMode()}
            className="h-9 px-2 rounded-md hover:bg-muted/60 transition grid place-items-center"
            title="Modo Foco"
          >
            <Brain className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCenterOpen((v) => !v)}
            className="relative h-9 px-2 rounded-md hover:bg-muted/60 transition grid place-items-center"
            title="Notificações"
          >
            <Bell className="w-4 h-4" />
            {notify > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 text-[9px] text-white rounded-full w-4 h-4 grid place-items-center font-bold"
                style={{ background: useSettings.getState().accent }}
              >
                {notify > 9 ? "9+" : notify}
              </span>
            )}
          </button>
          <button
            onClick={toggleMode}
            className="h-9 px-2 rounded-md hover:bg-muted/60 transition text-xs"
            title="Tema"
          >
            {mode === "dark" ? "🌙" : "☀️"}
          </button>
          <div className="flex items-center gap-2 h-9 px-2 rounded-md hover:bg-muted/60 transition cursor-default text-xs">
            <Wifi className="w-3.5 h-3.5" />
            <Volume2 className="w-3.5 h-3.5" />
            <Battery className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col items-end h-9 px-2 rounded-md hover:bg-muted/60 transition cursor-default justify-center text-xs leading-tight">
            <span className="tabular-nums">{time}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{date}</span>
          </div>
        </div>
      </div>

      {centerOpen && <NotificationCenter onClose={() => setCenterOpen(false)} />}
    </>
  );
}
