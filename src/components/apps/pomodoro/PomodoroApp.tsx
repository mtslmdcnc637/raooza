"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/db";
import { Play, Pause, RotateCcw, Coffee, Brain, ChartBar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystemBus } from "@/stores/systemBus";
import { useSettings } from "@/stores/settingsStore";

type Phase = "focus" | "short-break" | "long-break";

const DEFAULT_DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  "short-break": 5 * 60,
  "long-break": 15 * 60,
};

const PHASE_LABELS: Record<Phase, string> = {
  focus: "Foco",
  "short-break": "Pausa curta",
  "long-break": "Pausa longa",
};

export function PomodoroApp() {
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(DEFAULT_DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [cyclesDone, setCyclesDone] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const notify = useSystemBus((s) => s.notify);
  const accent = useSettings((s) => s.accent);

  const tickRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const elapsedAtPause = useRef(0);
  const phaseRef = useRef<Phase>("focus");
  const cyclesRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { cyclesRef.current = cyclesDone; }, [cyclesDone]);

  const sessions = useLiveQuery(async () => {
    return await getDb().pomodoroSessions.orderBy("startedAt").reverse().limit(50).toArray();
  });

  const completeCycle = useCallback(async () => {
    setRunning(false);
    elapsedAtPause.current = 0;
    const currentPhase = phaseRef.current;
    const currentCycles = cyclesRef.current;
    const now = new Date().toISOString();
    await getDb().pomodoroSessions.add({
      id: `pom-${Date.now()}`,
      startedAt: now,
      durationSec: DEFAULT_DURATIONS[currentPhase],
      type: currentPhase,
      completed: true,
    });
    if (currentPhase === "focus") {
      const c = currentCycles + 1;
      setCyclesDone(c);
      notify({
        app: "pomodoro",
        title: "Ciclo de foco concluído! 🎉",
        body: c % 4 === 0 ? "Hora de uma pausa longa" : "Hora de uma pausa curta",
      });
      const nextPhase: Phase = c % 4 === 0 ? "long-break" : "short-break";
      setPhase(nextPhase);
      setRemaining(DEFAULT_DURATIONS[nextPhase]);
    } else {
      notify({
        app: "pomodoro",
        title: "Pausa concluída",
        body: "Bora focar de novo?",
      });
      setPhase("focus");
      setRemaining(DEFAULT_DURATIONS.focus);
    }
  }, [notify]);

  // Tick
  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsedAtPause.current * 1000;
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000);
        const total = DEFAULT_DURATIONS[phaseRef.current];
        const rem = Math.max(0, total - elapsed);
        setRemaining(rem);
        if (rem <= 0) {
          completeCycle();
        }
      }, 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      if (startRef.current) {
        elapsedAtPause.current = Math.floor((Date.now() - startRef.current) / 1000);
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running, completeCycle]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => {
    setRunning(false);
    elapsedAtPause.current = 0;
    setRemaining(DEFAULT_DURATIONS[phaseRef.current]);
  }, []);
  const switchPhase = useCallback((p: Phase) => {
    setRunning(false);
    elapsedAtPause.current = 0;
    setPhase(p);
    setRemaining(DEFAULT_DURATIONS[p]);
  }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = 1 - remaining / DEFAULT_DURATIONS[phase];

  const focusSessions = (sessions ?? []).filter((s) => s.type === "focus");
  const todayStr = new Date().toDateString();
  const todayFocus = focusSessions.filter((s) => new Date(s.startedAt).toDateString() === todayStr);
  const totalFocusMin = focusSessions.reduce((a, s) => a + s.durationSec, 0) / 60;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Phase tabs */}
      <div className="flex p-3 gap-1 border-b border-border/40">
        {(["focus", "short-break", "long-break"] as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => switchPhase(p)}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5",
              phase === p ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            style={phase === p ? { background: accent } : {}}
          >
            {p === "focus" && <Brain className="w-3.5 h-3.5" />}
            {p !== "focus" && <Coffee className="w-3.5 h-3.5" />}
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div className="relative w-56 h-56">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 46}
              strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-light tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{PHASE_LABELS[phase]}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="w-12 h-12 rounded-full grid place-items-center bg-muted hover:bg-muted/80 transition"
            title="Resetar"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={running ? pause : start}
            className="w-16 h-16 rounded-full grid place-items-center text-white shadow-lg transition hover:scale-105"
            style={{ background: accent }}
          >
            {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          <button
            onClick={() => setShowStats((v) => !v)}
            className={cn(
              "w-12 h-12 rounded-full grid place-items-center transition",
              showStats ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80",
            )}
            title="Estatísticas"
          >
            <ChartBar className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Ciclos hoje: <span className="font-semibold text-foreground">{todayFocus.length}</span>
          {cyclesDone > 0 && (<> · Sequência atual: {cyclesDone}</>)}
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="border-t border-border/40 p-4 bg-muted/20 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Hoje (sessões)" value={todayFocus.length.toString()} />
            <Stat label="Total (sessões)" value={focusSessions.length.toString()} />
            <Stat label="Total (min)" value={Math.round(totalFocusMin).toString()} />
          </div>
          <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Histórico recente</div>
          <div className="space-y-1">
            {(sessions ?? []).slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/40">
                <span>{new Date(s.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-muted-foreground">
                  {PHASE_LABELS[s.type]} · {Math.round(s.durationSec / 60)}min
                </span>
              </div>
            ))}
            {(!sessions || sessions.length === 0) && (
              <div className="text-xs text-muted-foreground text-center py-3">
                Nenhuma sessão ainda
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-background border border-border/40">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
