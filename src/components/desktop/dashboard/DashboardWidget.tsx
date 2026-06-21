"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import { useSettings } from "@/stores/settingsStore";
import {
  Sparkles,
  StickyNote,
  Timer,
  Trello,
  CheckCircle2,
  Flame,
  Calendar,
  Plus,
} from "lucide-react";

interface DashboardWidget {
  id: string;
  title: string;
  icon: any;
  body: React.ReactNode;
  onClick?: () => void;
}

export function DashboardWidget() {
  const refreshTick = useSystemBus((s) => s.refreshTick);
  const open = useWindowStore((s) => s.open);
  const accent = useSettings((s) => s.accent);
  const [pos, setPos] = useState({ x: 24, y: 24 });

  const todayStr = new Date().toDateString();

  const data = useLiveQuery(async () => {
    const db = getDb();
    const [notes, tasks, sessions, habits, checkins, events] = await Promise.all([
      db.notes.toArray(),
      db.kanbanTasks.toArray(),
      db.pomodoroSessions.toArray(),
      db.habits.toArray(),
      db.habitCheckins.toArray(),
      db.calendarEvents.toArray(),
    ]);
    return { notes, tasks, sessions, habits, checkins, events };
  }, [refreshTick]);

  // Drag
  const [dragging, setDragging] = useState(false);
  const dragStart = { x: 0, y: 0, ox: 0, oy: 0 };

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    dragStart.ox = pos.x;
    dragStart.oy = pos.y;
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setPos({
      x: Math.max(0, dragStart.ox + (e.clientX - dragStart.x)),
      y: Math.max(0, dragStart.oy + (e.clientY - dragStart.y)),
    });
  }
  function onPointerUp() {
    setDragging(false);
  }

  if (!data) return null;

  const todayNotes = data.notes.filter((n) => new Date(n.updatedAt).toDateString() === todayStr);
  const todayFocus = data.sessions.filter((s) => s.type === "focus" && new Date(s.startedAt).toDateString() === todayStr);
  const todayCheckins = data.checkins.filter((c) => c.date === new Date().toISOString().slice(0, 10));
  const activeHabits = data.habits.filter((h) => !h.archivedAt);
  const todayEvents = data.events.filter((e) => new Date(e.startAt).toDateString() === todayStr);
  const pendingTasks = data.tasks.slice(0, 5);

  const focusMinutes = Math.round(todayFocus.reduce((a, s) => a + s.durationSec, 0) / 60);

  return (
    <div
      className="hidden sm:block absolute pointer-events-auto w-72 rounded-2xl bg-card/80 backdrop-blur-2xl border border-border/60 shadow-2xl overflow-hidden"
      style={{ left: pos.x, top: pos.y, zIndex: 2 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2 cursor-grab active:cursor-grabbing">
        <div
          className="w-7 h-7 rounded-lg grid place-items-center text-white"
          style={{ background: accent }}
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Dashboard</div>
          <div className="text-[10px] text-muted-foreground capitalize">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <StatCard
            icon={Timer}
            value={focusMinutes.toString()}
            label="min foco"
            color="#F59E0B"
            onClick={() => open({ appId: "pomodoro", title: "Pomodoro", icon: null })}
          />
          <StatCard
            icon={CheckCircle2}
            value={todayCheckins.length.toString()}
            label={`/${activeHabits.length} hábitos`}
            color="#10B981"
            onClick={() => open({ appId: "habits", title: "Hábitos", icon: null })}
          />
          <StatCard
            icon={Calendar}
            value={todayEvents.length.toString()}
            label="eventos"
            color="#0078D4"
            onClick={() => open({ appId: "calendar", title: "Calendário", icon: null })}
          />
        </div>

        {/* Tasks today */}
        <div className="rounded-lg bg-muted/40 p-2" data-no-drag>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
              <Trello className="w-3 h-3" /> Tarefas
            </div>
            <button
              onClick={() => open({ appId: "kanban", title: "Kanban", icon: null })}
              className="text-[10px] text-primary hover:underline"
            >
              ver todas
            </button>
          </div>
          <div className="space-y-0.5">
            {pendingTasks.length === 0 ? (
              <div className="text-[10px] text-muted-foreground/60 py-1">Sem tarefas</div>
            ) : (
              pendingTasks.slice(0, 3).map((t) => (
                <div key={t.id} className="text-xs flex items-center gap-1.5 py-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                  <span className="truncate flex-1">{t.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Habits today */}
        {activeHabits.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-2" data-no-drag>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Flame className="w-3 h-3" /> Hábitos hoje
            </div>
            <div className="space-y-0.5">
              {activeHabits.slice(0, 3).map((h) => {
                const done = todayCheckins.some((c) => c.habitId === h.id);
                return (
                  <div key={h.id} className="text-xs flex items-center gap-1.5 py-0.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: done ? h.color : "transparent", border: done ? "none" : `1px solid ${h.color}` }}
                    />
                    <span className={done ? "line-through text-muted-foreground" : ""}>{h.title}</span>
                    {done && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent notes */}
        {todayNotes.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-2" data-no-drag>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notas recentes
            </div>
            <div className="space-y-0.5">
              {todayNotes.slice(0, 2).map((n) => (
                <div key={n.id} className="text-xs flex items-center gap-1.5 py-0.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: n.color }} />
                  <span className="truncate flex-1">{n.title || "Sem título"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-1" data-no-drag>
          <button
            onClick={() => open({ appId: "notes", title: "Notas", icon: null })}
            className="flex-1 h-7 text-[10px] rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center gap-1"
          >
            <Plus className="w-2.5 h-2.5" /> Nota
          </button>
          <button
            onClick={() => open({ appId: "assistant", title: "Assistente", icon: null })}
            className="flex-1 h-7 text-[10px] rounded-md text-white flex items-center justify-center gap-1"
            style={{ background: accent }}
          >
            <Sparkles className="w-2.5 h-2.5" /> IA
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  onClick,
}: {
  icon: any;
  value: string;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-muted/40 hover:bg-muted/60 p-2 text-center transition"
    >
      <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </button>
  );
}
