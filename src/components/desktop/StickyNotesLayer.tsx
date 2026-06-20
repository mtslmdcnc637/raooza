"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type NoteRecord } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { Pin, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function StickyNotesLayer() {
  const notes = useLiveQuery(async () => {
    const all = await getDb().notes.toArray();
    return all.filter((n) => n.pinned);
  }, []);

  if (!notes || notes.length === 0) return null;

  return (
    <div className="absolute inset-0 bottom-12 pointer-events-none">
      {notes.map((n) => (
        <StickyNoteWidget key={n.id} note={n} />
      ))}
    </div>
  );
}

function StickyNoteWidget({ note }: { note: NoteRecord }) {
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [pos, setPos] = useState(note.position ?? { x: 80, y: 80 });

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setPos(note.position ?? { x: 80, y: 80 });
  }, [note.id, note.title, note.content, note.position]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    if (editing) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: Math.max(0, dragRef.current.origY + dy) });
  }
  async function onPointerUp() {
    if (dragRef.current) {
      dragRef.current = null;
      await getDb().notes.update(note.id, { position: pos });
    }
  }

  async function save() {
    await getDb().notes.update(note.id, {
      title,
      content,
      updatedAt: new Date().toISOString(),
    });
    setEditing(false);
    triggerRefresh();
  }

  async function unpin() {
    await getDb().notes.update(note.id, { pinned: false });
    triggerRefresh();
    notify({ app: "notes", title: "Nota desafixada" });
  }

  async function del() {
    if (!confirm("Apagar esta nota?")) return;
    await getDb().notes.delete(note.id);
    triggerRefresh();
  }

  return (
    <div
      className="absolute pointer-events-auto rounded-lg shadow-xl border border-black/10 w-56 flex flex-col group"
      style={{
        left: pos.x,
        top: pos.y,
        background: note.color,
        zIndex: 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="flex items-center justify-between px-2 py-1 cursor-grab active:cursor-grabbing">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={save}
          className="flex-1 bg-transparent text-xs font-bold outline-none truncate"
          style={{ color: "#1f2937" }}
        />
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition" data-no-drag>
          <button onClick={unpin} className="w-5 h-5 grid place-items-center rounded hover:bg-black/10" title="Desafixar">
            <Pin className="w-3 h-3 text-gray-700" />
          </button>
          <button onClick={del} className="w-5 h-5 grid place-items-center rounded hover:bg-red-500/30" title="Apagar">
            <Trash2 className="w-3 h-3 text-gray-700" />
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={save}
        placeholder="Anote algo..."
        className="flex-1 min-h-[80px] max-h-[200px] p-2 bg-transparent text-xs outline-none resize-none"
        style={{ color: "#1f2937" }}
      />
    </div>
  );
}
