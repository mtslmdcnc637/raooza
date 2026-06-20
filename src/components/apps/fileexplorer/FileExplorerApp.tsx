"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/db";
import { useWindowStore } from "@/stores/windowStore";
import { FileText, StickyNote, Trello, Clock, Search, Calendar, Network, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "notes" | "docs" | "tasks" | "events" | "wiki" | "habits";

export function FileExplorerApp() {
  const [kind, setKind] = useState<Kind>("notes");
  const [query, setQuery] = useState("");
  const open = useWindowStore((s) => s.open);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const [notes, docs, tasks, events, wiki, habits] = await Promise.all([
      db.notes.toArray(),
      db.editorDocs.toArray(),
      db.kanbanTasks.toArray(),
      db.calendarEvents.toArray(),
      db.wikiPages.toArray(),
      db.habits.toArray(),
    ]);
    return { notes, docs, tasks, events, wiki, habits };
  }, []);

  function openItem(item: any) {
    if (kind === "notes") {
      open({
        appId: "notes",
        title: "Notas",
        icon: null,
        width: 900,
        height: 640,
        payload: { noteId: item.id },
      });
    } else if (kind === "docs") {
      open({
        appId: "editor",
        title: "Editor",
        icon: null,
        width: 1000,
        height: 720,
        payload: { docId: item.id },
      });
    } else if (kind === "wiki") {
      open({
        appId: "wiki",
        title: "Wiki",
        icon: null,
        width: 1100,
        height: 720,
        payload: { pageId: item.id },
      });
    } else if (kind === "tasks") {
      open({
        appId: "kanban",
        title: "Kanban",
        icon: null,
        width: 1000,
        height: 680,
      });
    } else if (kind === "events") {
      open({
        appId: "calendar",
        title: "Calendário",
        icon: null,
        width: 1000,
        height: 680,
      });
    } else {
      open({
        appId: "habits",
        title: "Hábitos",
        icon: null,
        width: 900,
        height: 640,
      });
    }
  }

  const items: any[] = (() => {
    if (!data) return [];
    let list: any[] = [];
    if (kind === "notes") list = data.notes;
    else if (kind === "docs") list = data.docs;
    else if (kind === "tasks") list = data.tasks;
    else if (kind === "events") list = data.events.map((e) => ({ ...e, title: e.title, updatedAt: e.startAt }));
    else if (kind === "wiki") list = data.wiki;
    else list = data.habits;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((x) => (x.title ?? "").toLowerCase().includes(q));
    }
    return list;
  })();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-48 border-r border-border/40 bg-muted/20 p-3">
        <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">Categorias</div>
        <nav className="space-y-1">
          <KindButton kind="notes" current={kind} onClick={setKind} icon={StickyNote} label="Notas" count={data?.notes.length ?? 0} />
          <KindButton kind="docs" current={kind} onClick={setKind} icon={FileText} label="Documentos" count={data?.docs.length ?? 0} />
          <KindButton kind="tasks" current={kind} onClick={setKind} icon={Trello} label="Tarefas" count={data?.tasks.length ?? 0} />
          <KindButton kind="events" current={kind} onClick={setKind} icon={Calendar} label="Eventos" count={data?.events.length ?? 0} />
          <KindButton kind="wiki" current={kind} onClick={setKind} icon={Network} label="Wiki" count={data?.wiki.length ?? 0} />
          <KindButton kind="habits" current={kind} onClick={setKind} icon={Flame} label="Hábitos" count={data?.habits.length ?? 0} />
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-border/40">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted/40 border border-border/60">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar em ${kind}...`}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => openItem(item)}
                className="p-3 rounded-lg border border-border/40 hover:bg-muted/40 hover:border-border transition text-left group"
              >
                <div className="flex items-center gap-2">
                  {kind === "notes" && <StickyNote className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                  {kind === "docs" && <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />}
                  {kind === "tasks" && <Trello className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                  {kind === "events" && <Calendar className="w-5 h-5 text-cyan-500 flex-shrink-0" />}
                  {kind === "wiki" && <Network className="w-5 h-5 text-violet-500 flex-shrink-0" />}
                  {kind === "habits" && <Flame className="w-5 h-5 text-orange-500 flex-shrink-0" />}
                  <span className="text-sm font-medium truncate flex-1">{item.title || "Sem título"}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(item.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </div>
                {kind === "notes" && item.pinned && (
                  <div className="text-[10px] mt-1 text-primary">📌 Fixada</div>
                )}
              </button>
            ))}
            {items.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-12">
                Nenhum item
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KindButton({
  kind,
  current,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  kind: Kind;
  current: Kind;
  onClick: (k: Kind) => void;
  icon: any;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={() => onClick(kind)}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition",
        current === kind ? "bg-muted/80 font-medium" : "hover:bg-muted/40",
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{label}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background">{count}</span>
    </button>
  );
}
