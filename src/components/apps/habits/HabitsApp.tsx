"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Habit, type HabitCheckin } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { computeStreak } from "@/lib/ai/executor";
import { Plus, Flame, Check, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const HABIT_COLORS = ["#10B981", "#0078D4", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4"];

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function HabitsApp() {
  const habits = useLiveQuery(async () => {
    return (await getDb().habits.toArray()).filter((h) => !h.archivedAt);
  }, []);
  const checkins = useLiveQuery(async () => await getDb().habitCheckins.toArray(), []);
  const [showCreate, setShowCreate] = useState(false);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const today = new Date();
  const todayStr = dateStr(today);
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });

  async function toggleCheckin(habitId: string, date: string) {
    const existing = (checkins ?? []).find((c) => c.habitId === habitId && c.date === date);
    if (existing) {
      await getDb().habitCheckins.delete(existing.id);
    } else {
      await getDb().habitCheckins.add({
        id: uid("chk"),
        habitId,
        date,
        createdAt: new Date().toISOString(),
      });
    }
    triggerRefresh();
  }

  async function createHabit(data: { title: string; cadence: "daily" | "weekly"; color: string; targetPerWeek?: number }) {
    const h: Habit = {
      id: uid("habit"),
      title: data.title,
      cadence: data.cadence,
      color: data.color,
      targetPerWeek: data.targetPerWeek,
      createdAt: new Date().toISOString(),
    };
    await getDb().habits.add(h);
    triggerRefresh();
    setShowCreate(false);
  }

  async function deleteHabit(id: string) {
    if (!confirm("Apagar este hábito?")) return;
    await getDb().habits.delete(id);
    await getDb().habitCheckins.where("habitId").equals(id).delete();
    triggerRefresh();
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Hábitos</h2>
          <p className="text-xs text-muted-foreground">
            {(habits ?? []).length} hábito(s) ativo(s)
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {/* Habits list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-7 gap-1 mb-3 max-w-md">
          {last7Days.map((d, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] uppercase text-muted-foreground">
                {["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()]}
              </div>
              <div className={cn(
                "text-xs font-medium",
                dateStr(d) === todayStr && "text-primary"
              )}>
                {d.getDate()}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {(habits ?? []).map((h) => {
            const streak = computeStreak(h, checkins ?? []);
            const checkinCount = (checkins ?? []).filter((c) => c.habitId === h.id).length;
            return (
              <div key={h.id} className="group p-3 rounded-lg bg-card border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: h.color }} />
                  <span className="text-sm font-medium flex-1">{h.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {h.cadence === "daily" ? "Diário" : "Semanal"}
                  </span>
                  {streak > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      {streak}
                    </span>
                  )}
                  <button
                    onClick={() => deleteHabit(h.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Last 7 days */}
                <div className="grid grid-cols-7 gap-1 max-w-md">
                  {last7Days.map((d, i) => {
                    const ds = dateStr(d);
                    const done = (checkins ?? []).some((c) => c.habitId === h.id && c.date === ds);
                    const isToday = ds === todayStr;
                    return (
                      <button
                        key={i}
                        onClick={() => toggleCheckin(h.id, ds)}
                        className={cn(
                          "h-7 rounded-md border transition flex items-center justify-center",
                          done ? "text-white border-transparent" : "border-border/60 hover:bg-muted/60",
                          isToday && !done && "border-primary/60",
                        )}
                        style={done ? { background: h.color } : {}}
                        title={ds}
                      >
                        {done && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-muted-foreground mt-1.5">
                  {checkinCount} check-ins no total
                </div>
              </div>
            );
          })}
          {(!habits || habits.length === 0) && (
            <div className="text-center py-12">
              <Flame className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro hábito para começar a acompanhar.
              </p>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateHabitDialog onCreate={createHabit} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateHabitDialog({
  onCreate,
  onClose,
}: {
  onCreate: (data: { title: string; cadence: "daily" | "weekly"; color: string; targetPerWeek?: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [targetPerWeek, setTargetPerWeek] = useState(3);

  function submit() {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      cadence,
      color,
      targetPerWeek: cadence === "weekly" ? targetPerWeek : undefined,
    });
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Novo hábito</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ex: Beber 2L de água, Meditar 10min..."
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <div>
            <div className="text-xs font-medium mb-1.5">Cadência</div>
            <div className="flex gap-1 bg-muted/40 p-0.5 rounded-md">
              <button
                onClick={() => setCadence("daily")}
                className={cn("flex-1 h-8 text-xs rounded", cadence === "daily" ? "bg-background shadow-sm" : "")}
              >
                Diário
              </button>
              <button
                onClick={() => setCadence("weekly")}
                className={cn("flex-1 h-8 text-xs rounded", cadence === "weekly" ? "bg-background shadow-sm" : "")}
              >
                Semanal
              </button>
            </div>
          </div>
          {cadence === "weekly" && (
            <div>
              <div className="text-xs font-medium mb-1.5">Meta por semana: {targetPerWeek}x</div>
              <input
                type="range"
                min={1}
                max={7}
                value={targetPerWeek}
                onChange={(e) => setTargetPerWeek(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}
          <div>
            <div className="text-xs font-medium mb-1.5">Cor</div>
            <div className="flex gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar hábito
          </button>
        </div>
      </div>
    </div>
  );
}
