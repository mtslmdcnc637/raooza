"use client";

import { useEffect, useState } from "react";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/db";
import { X, Brain, Clock, CheckCircle2, Play } from "lucide-react";

export function FocusMode() {
  const focusMode = useSystemBus((s) => s.focusMode);
  const focusTaskId = useSystemBus((s) => s.focusTaskId);
  const exitFocusMode = useSystemBus((s) => s.exitFocusMode);
  const open = useWindowStore((s) => s.open);
  const [elapsed, setElapsed] = useState(0);

  const task = useLiveQuery(async () => {
    if (!focusTaskId) return null;
    return await getDb().kanbanTasks.get(focusTaskId);
  }, [focusTaskId]);

  const todaySessions = useLiveQuery(async () => {
    const todayStr = new Date().toDateString();
    const sessions = await getDb().pomodoroSessions.toArray();
    return sessions.filter((s) => s.type === "focus" && new Date(s.startedAt).toDateString() === todayStr);
  }, []);

  useEffect(() => {
    if (!focusMode) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [focusMode]);

  if (!focusMode) return null;

  function exit() {
    exitFocusMode();
    setElapsed(0);
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const focusCount = (todaySessions ?? []).length;

  return (
    <div className="fixed inset-0 z-[9500] flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl">
      <button
        onClick={exit}
        className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full hover:bg-muted transition text-muted-foreground"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="text-center max-w-md px-6">
        <div
          className="w-20 h-20 rounded-full mx-auto mb-6 grid place-items-center text-white shadow-2xl"
          style={{ background: "var(--accent-color)" }}
        >
          <Brain className="w-10 h-10" />
        </div>

        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Modo Foco</div>

        {task && (
          <h2 className="text-2xl font-semibold mb-6">{task.title}</h2>
        )}
        {!task && (
          <h2 className="text-2xl font-semibold mb-6">Concentre-se</h2>
        )}

        <div className="text-5xl font-light tabular-nums mb-8">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>

        <div className="flex items-center justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            {focusCount} ciclos hoje
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => open({ appId: "pomodoro", title: "Pomodoro", icon: null })}
            className="h-10 px-4 rounded-md text-white text-sm font-medium flex items-center gap-2"
            style={{ background: "var(--accent-color)" }}
          >
            <Play className="w-4 h-4" />
            Iniciar Pomodoro
          </button>
          <button
            onClick={exit}
            className="h-10 px-4 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition"
          >
            Sair do foco
          </button>
        </div>

        <div className="mt-12 text-xs text-muted-foreground">
          Notificações silenciadas · Foco total
        </div>
      </div>
    </div>
  );
}
