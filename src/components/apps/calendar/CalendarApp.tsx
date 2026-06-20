"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type CalendarEvent } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "month" | "week";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EVENT_COLORS = ["#0078D4", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4"];

export function CalendarApp() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const events = useLiveQuery(async () => await getDb().calendarEvents.toArray(), []);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const monthGrid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);

  function eventsForDay(day: Date): CalendarEvent[] {
    const dayStr = day.toDateString();
    return (events ?? []).filter((e) => new Date(e.startAt).toDateString() === dayStr);
  }

  function prev() {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCursor(d);
  }
  function next() {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCursor(d);
  }

  async function createEvent(data: Partial<CalendarEvent>) {
    const now = new Date().toISOString();
    const ev: CalendarEvent = {
      id: uid("evt"),
      title: data.title ?? "Sem título",
      description: data.description,
      startAt: data.startAt ?? new Date().toISOString(),
      endAt: data.endAt,
      allDay: data.allDay ?? true,
      color: data.color ?? EVENT_COLORS[0],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().calendarEvents.add(ev);
    triggerRefresh();
    setShowCreate(false);
  }

  async function deleteEvent(id: string) {
    await getDb().calendarEvents.delete(id);
    setSelectedEvent(null);
    triggerRefresh();
  }

  const title =
    view === "month"
      ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  const todayStr = new Date().toDateString();

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <button onClick={prev} className="w-8 h-8 grid place-items-center rounded hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="text-sm font-semibold capitalize flex-1 text-center">{title}</h2>
        <button onClick={next} className="w-8 h-8 grid place-items-center rounded hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
        <div className="flex bg-muted/60 rounded-md p-0.5 ml-2">
          <button
            onClick={() => setView("month")}
            className={cn("px-2 h-7 text-xs rounded", view === "month" ? "bg-background shadow-sm" : "")}
          >
            Mês
          </button>
          <button
            onClick={() => setView("week")}
            className={cn("px-2 h-7 text-xs rounded", view === "week" ? "bg-background shadow-sm" : "")}
          >
            Semana
          </button>
        </div>
        <button
          onClick={() => { setCreateDate(new Date()); setShowCreate(true); }}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Evento
        </button>
      </div>

      {/* Grid */}
      {view === "month" ? (
        <div className="flex-1 flex flex-col p-2">
          <div className="grid grid-cols-7 mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center text-[10px] uppercase font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1">
            {monthGrid.map((day, i) => {
              const dayEvents = eventsForDay(day);
              const isToday = day.toDateString() === todayStr;
              const isOtherMonth = day.getMonth() !== cursor.getMonth();
              return (
                <button
                  key={i}
                  onClick={() => { setCreateDate(day); setShowCreate(true); }}
                  className={cn(
                    "min-h-[60px] p-1 rounded-md border text-left transition relative flex flex-col gap-0.5 overflow-hidden",
                    isOtherMonth ? "border-transparent text-muted-foreground/50" : "border-border/40 hover:border-border",
                    isToday && "border-primary",
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-medium",
                    isToday && "text-primary",
                  )}>
                    {day.getDate()}
                  </span>
                  <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(evt) => { evt.stopPropagation(); setSelectedEvent(ev); }}
                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer text-white"
                        style={{ background: ev.color ?? "#0078D4" }}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-muted-foreground">+{dayEvents.length - 3} mais</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2">
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((d, i) => (
              <div key={i} className="text-center">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()]}
                </div>
                <div className={cn(
                  "text-sm font-semibold",
                  d.toDateString() === todayStr && "text-primary"
                )}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1">
            {weekDays.map((day, i) => {
              const dayEvents = eventsForDay(day);
              return (
                <div key={i} className="border border-border/40 rounded-md p-1 flex flex-col gap-1 overflow-y-auto">
                  {dayEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="text-[10px] px-1.5 py-1 rounded text-white text-left"
                      style={{ background: e.color ?? "#0078D4" }}
                    >
                      <div className="font-medium truncate">{e.title}</div>
                      {!e.allDay && (
                        <div className="opacity-90">
                          {new Date(e.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateEventDialog
          date={createDate ?? new Date()}
          onCreate={createEvent}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Event detail */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={deleteEvent}
        />
      )}
    </div>
  );
}

function CreateEventDialog({
  date,
  onCreate,
  onClose,
}: {
  date: Date;
  onCreate: (data: Partial<CalendarEvent>) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [color, setColor] = useState(EVENT_COLORS[0]);

  function submit() {
    if (!title.trim()) return;
    const day = new Date(date);
    if (!allDay && time) {
      const [h, m] = time.split(":").map(Number);
      day.setHours(h, m, 0, 0);
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      startAt: day.toISOString(),
      allDay,
      color,
    });
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Novo evento</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full p-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              defaultValue={date.toISOString().slice(0, 10)}
              className="h-9 px-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none"
              readOnly
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              Dia todo
            </label>
            {!allDay && (
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 px-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition",
                  color === c ? "border-foreground scale-110" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar evento
          </button>
        </div>
      </div>
    </div>
  );
}

function EventDetailDialog({
  event,
  onClose,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 rounded-full" style={{ background: event.color }} />
            <h3 className="text-sm font-semibold">{event.title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-muted-foreground space-y-1 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(event.startAt).toLocaleString("pt-BR", {
              day: "2-digit", month: "long", hour: event.allDay ? undefined : "2-digit", minute: event.allDay ? undefined : "2-digit",
            })}
          </div>
        </div>
        {event.description && (
          <p className="text-sm mb-3 whitespace-pre-wrap">{event.description}</p>
        )}
        <button
          onClick={() => onDelete(event.id)}
          className="w-full h-8 text-xs rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </button>
      </div>
    </div>
  );
}

function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDay = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startDay);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function buildWeekDays(cursor: Date): Date[] {
  const startDay = cursor.getDay();
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - startDay);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
