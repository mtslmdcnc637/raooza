"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type TimeEntry } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { Play, Pause, Square, Clock, Trash2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TimeTrackerApp() {
  const [description, setDescription] = useState("");
  const [tick, setTick] = useState(0);

  const entries = useLiveQuery(async () => {
    return (await getDb().timeEntries.toArray()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, []);
  const tasks = useLiveQuery(async () => await getDb().kanbanTasks.toArray(), []);

  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const setTrackerActive = useSystemBus((s) => s.setTrackerActive);

  const running = (entries ?? []).find((e) => !e.endedAt);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  void tick;

  async function start() {
    // Stop any running
    if (running) {
      await stopRunning();
    }
    const entry = {
      id: uid("time"),
      taskId: selectedTaskId || undefined,
      description: description.trim(),
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await getDb().timeEntries.add(entry);
    setDescription("");
    setTrackerActive(true);
    triggerRefresh();
  }

  async function stopRunning() {
    if (!running) return;
    const durationSec = Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000);
    await getDb().timeEntries.update(running.id, {
      endedAt: new Date().toISOString(),
      durationSec,
    });
    setTrackerActive(false);
    triggerRefresh();
  }

  async function discardRunning() {
    if (!running) return;
    if (!confirm("Descartar timer atual?")) return;
    await getDb().timeEntries.delete(running.id);
    setTrackerActive(false);
    triggerRefresh();
  }

  async function deleteEntry(id: string) {
    await getDb().timeEntries.delete(id);
    triggerRefresh();
  }

  const elapsedSec = running ? Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000) : 0;
  const todayStr = new Date().toDateString();
  const todayEntries = (entries ?? []).filter((e) => new Date(e.startedAt).toDateString() === todayStr);
  const todayTotalSec = todayEntries.reduce((a, e) => a + (e.durationSec ?? (running && e.id === running.id ? elapsedSec : 0)), 0);

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Timer panel */}
      <div className="p-4 border-b border-border/40">
        <div className="flex flex-col items-center gap-3 mb-3">
          <div className="text-4xl font-light tabular-nums">
            {formatTime(elapsedSec)}
          </div>
          {running && (
            <div className="text-xs text-muted-foreground">
              {running.description || "Sem descrição"}
              {running.taskId && tasks && (
                <span className="ml-2 text-primary">
                  · {tasks.find((t) => t.id === running.taskId)?.title ?? "tarefa"}
                </span>
              )}
            </div>
          )}
        </div>

        {!running ? (
          <div className="space-y-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="O que você está trabalhando?"
              className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="flex-1 h-9 px-2 text-xs rounded-md bg-muted/40 border border-border/60 outline-none"
              >
                <option value="">Sem tarefa vinculada</option>
                {(tasks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                onClick={start}
                className="h-9 px-4 text-sm rounded-md text-white flex items-center gap-1.5"
                style={{ background: "var(--accent-color)" }}
              >
                <Play className="w-3.5 h-3.5" /> Iniciar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={stopRunning}
              className="flex-1 h-9 text-sm rounded-md bg-primary text-primary-foreground flex items-center justify-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" /> Parar
            </button>
            <button
              onClick={discardRunning}
              className="h-9 px-3 text-sm rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              Descartar
            </button>
          </div>
        )}

        {/* Today total */}
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Hoje
          </span>
          <span className="font-medium tabular-nums">{formatTime(todayTotalSec)}</span>
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-xs uppercase font-semibold text-muted-foreground mb-2 px-1">Histórico</div>
        <div className="space-y-1.5">
          {(entries ?? []).map((e) => {
            const dur = e.durationSec ?? (e.id === running?.id ? elapsedSec : 0);
            const task = tasks?.find((t) => t.id === e.taskId);
            return (
              <div
                key={e.id}
                className="group p-2.5 rounded-lg bg-card border border-border/40 hover:border-border transition"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    e.endedAt ? "bg-muted-foreground" : "bg-green-500 animate-pulse"
                  )} />
                  <span className="text-sm flex-1 truncate">{e.description || "Sem descrição"}</span>
                  <span className="text-xs font-mono tabular-nums">{formatTime(dur)}</span>
                  <button
                    onClick={() => deleteEntry(e.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                  {new Date(e.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {task && (
                    <span className="flex items-center gap-1">
                      <Link2 className="w-2.5 h-2.5" /> {task.title}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(!entries || entries.length === 0) && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Nenhuma entrada ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
