"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/db";
import { useSettings } from "@/stores/settingsStore";
import { useSystemBus } from "@/stores/systemBus";
import { executeBatch } from "@/lib/ai/executor";
import { Sparkles, Loader2, RefreshCw, Plus, Calendar, Clock, X, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RaoozaAction } from "@/lib/os/types";

interface Suggestion {
  title: string;
  reason: string;
  estimatedMinutes: number;
  taskId: string | null;
  isNew: boolean;
}

export function MyDayApp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());

  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);

  const todayStr = new Date().toDateString();
  const todayCheckins = useLiveQuery(async () => {
    const todayDate = new Date().toISOString().slice(0, 10);
    return await getDb().habitCheckins.where("date").equals(todayDate).toArray();
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const db = getDb();
      const [tasks, habits, checkins, events, notes, imports] = await Promise.all([
        db.kanbanTasks.toArray(),
        db.habits.toArray(),
        db.habitCheckins.toArray(),
        db.calendarEvents.toArray(),
        db.notes.toArray(),
        db.imports.toArray(),
      ]);

      const todayDateStr = new Date().toISOString().slice(0, 10);
      const uncheckedHabits = habits
        .filter((h) => !h.archivedAt)
        .filter((h) => !checkins.some((c) => c.habitId === h.id && c.date === todayDateStr));

      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59);
      const upcomingEvents = events.filter((e) => {
        const start = new Date(e.startAt);
        return start >= now && start <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
      });

      const recentNotes = notes
        .filter((n) => new Date(n.updatedAt).toDateString() === todayStr || (Date.now() - new Date(n.updatedAt).getTime()) < 3 * 24 * 60 * 60 * 1000)
        .slice(0, 10);

      const activeTags = imports.map((imp) => ({ tag: imp.tag, count: imp.items.length }));

      const settings = useSettings.getState();
      const res = await fetch("/api/myday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.aiProvider,
          apiKey: settings.apiKeys[settings.aiProvider],
          model: settings.defaultModel[settings.aiProvider],
          context: {
            tasks: tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, dueDate: t.dueDate })),
            habits: uncheckedHabits.map((h) => ({ id: h.id, title: h.title, cadence: h.cadence })),
            events: upcomingEvents.map((e) => ({ title: e.title, startAt: e.startAt })),
            recentNotes: recentNotes.map((n) => ({ title: n.title, content: n.content })),
            activeTags,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setSummary(data.summary || "");
      setSuggestions(data.suggestions || []);
      setDone(new Set());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function addToKanban(suggestion: Suggestion) {
    const actions: RaoozaAction[] = [
      {
        app: "kanban",
        action: "createTask",
        payload: { title: suggestion.title, description: suggestion.reason },
      },
    ];
    await executeBatch(actions);
    triggerRefresh();
    notify({
      app: "myday",
      title: "Tarefa adicionada ao Kanban",
      body: suggestion.title,
    });
  }

  function toggleDone(idx: number) {
    const key = `sug-${idx}`;
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <Brain className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Meu Dia</h2>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1 disabled:opacity-50"
          style={{ background: "var(--accent-color)" }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {suggestions.length > 0 ? "Regenerar" : "Gerar sugestões"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
              <div className="text-sm">Analisando seu contexto...</div>
              <div className="text-xs text-muted-foreground mt-1">A IA está priorizando suas tarefas</div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-8">
            <X className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <div className="text-sm font-medium">Erro</div>
            <div className="text-xs text-muted-foreground mt-1">{error}</div>
          </div>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <div className="h-full grid place-items-center">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Planeje seu dia com IA</h3>
              <p className="text-xs text-muted-foreground mb-4">
                A IA vai analisar suas tarefas, hábitos pendentes, eventos e notas recentes para sugerir de 3 a 5 prioridades para hoje.
              </p>
              <button
                onClick={generate}
                className="h-9 px-4 text-sm rounded-md text-white"
                style={{ background: "var(--accent-color)" }}
              >
                Gerar sugestões
              </button>
            </div>
          </div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <>
            {summary && (
              <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-xs uppercase font-semibold text-primary mb-1">Foco do dia</div>
                <div className="text-sm">{summary}</div>
              </div>
            )}

            <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">
              {suggestions.length} prioridade(s) sugeridas
            </div>

            <div className="space-y-2">
              {suggestions.map((s, i) => {
                const key = `sug-${i}`;
                const isDone = done.has(key);
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg bg-card border transition",
                      isDone ? "border-green-500/30 bg-green-500/5 opacity-60" : "border-border/40",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleDone(i)}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition flex items-center justify-center",
                          isDone ? "bg-green-500 border-green-500" : "border-border hover:border-primary",
                        )}
                      >
                        {isDone && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium", isDone && "line-through")}>{s.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.reason}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {s.estimatedMinutes}min
                          </span>
                          {s.isNew ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              Nova
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
                              Existente
                            </span>
                          )}
                          {s.isNew && !isDone && (
                            <button
                              onClick={() => addToKanban(s)}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Adicionar ao Kanban
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-[10px] text-muted-foreground text-center">
              {done.size} de {suggestions.length} concluída(s)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
