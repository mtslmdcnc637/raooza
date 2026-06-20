"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type NoteRecord } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import { Sparkles, Pin, Trash2, Plus, Search, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindowState } from "@/lib/os/types";

const COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f87171", "#a78bfa", "#f9fafb"];

export function NotesApp({ win }: { win: WindowState }) {
  const notes = useLiveQuery(async () => {
    return await getDb().notes.orderBy("updatedAt").reverse().toArray();
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);
  const setTitle = useWindowStore((s) => s.setTitle);

  // Open note from payload
  useEffect(() => {
    if (win.payload?.noteId) {
      setSelectedId(win.payload.noteId as string);
    }
  }, [win.payload?.noteId]);

  const allTags = Array.from(new Set((notes ?? []).flatMap((n) => n.tags))).sort();

  const filtered = (notes ?? []).filter((n) => {
    if (query) {
      const q = query.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
    }
    if (tagFilter && !n.tags.includes(tagFilter)) return false;
    return true;
  });

  async function createNote() {
    const now = new Date().toISOString();
    const note: NoteRecord = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "Nova nota",
      content: "",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      pinned: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().notes.add(note);
    setSelectedId(note.id);
    triggerRefresh();
  }

  async function updateNote(id: string, patch: Partial<NoteRecord>) {
    await getDb().notes.update(id, { ...patch, updatedAt: new Date().toISOString() });
    triggerRefresh();
  }

  async function deleteNote(id: string) {
    if (!confirm("Apagar esta nota?")) return;
    await getDb().notes.delete(id);
    if (selectedId === id) setSelectedId(null);
    triggerRefresh();
  }

  async function togglePin(id: string, pinned: boolean) {
    await updateNote(id, {
      pinned,
      position: pinned ? { x: 80 + Math.random() * 200, y: 80 + Math.random() * 100 } : undefined,
    });
    notify({ app: "notes", title: pinned ? "Nota fixada no desktop" : "Nota desafixada" });
  }

  const selected = (notes ?? []).find((n) => n.id === selectedId);

  useEffect(() => {
    if (selected) setTitle(win.id, `Notas - ${selected.title}`);
  }, [selected?.title, setTitle, win.id]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/40 flex flex-col bg-muted/20">
        <div className="p-3 border-b border-border/40 space-y-2">
          <button
            onClick={createNote}
            className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
            style={{ background: "var(--accent-color)" }}
          >
            <Plus className="w-4 h-4" /> Nova nota
          </button>
          <div className="flex items-center gap-2 h-8 px-2 rounded-md bg-muted/60 border border-border/60">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent outline-none text-xs"
            />
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="p-2 border-b border-border/40">
            <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5 px-1">Tags</div>
            <div className="flex flex-wrap gap-1">
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border transition flex items-center gap-1",
                    tagFilter === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 hover:bg-muted",
                  )}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Nenhuma nota
            </div>
          )}
          {filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              className={cn(
                "w-full text-left p-2 rounded-lg border transition group cursor-pointer",
                selectedId === n.id
                  ? "bg-muted/60 border-border"
                  : "border-transparent hover:bg-muted/40",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate flex-1">{n.title || "Sem título"}</span>
                    {n.pinned && <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {n.content.slice(0, 50) || "Vazio"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onTogglePin={togglePin}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground">
            <div className="text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div className="text-sm">Selecione ou crie uma nota</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteEditor({
  note,
  onUpdate,
  onDelete,
  onTogglePin,
}: {
  note: NoteRecord;
  onUpdate: (id: string, patch: Partial<NoteRecord>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string, pinned: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsInput, setTagsInput] = useState(note.tags.join(", "));
  const [color, setColor] = useState(note.color);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTagsInput(note.tags.join(", "));
    setColor(note.color);
  }, [note.id]);

  // Debounced save
  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== note.title || content !== note.content || color !== note.color || tagsInput !== note.tags.join(", ")) {
        onUpdate(note.id, {
          title,
          content,
          color,
          tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [title, content, color, tagsInput]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "w-5 h-5 rounded-full border-2 transition",
                color === c ? "border-foreground scale-110" : "border-transparent",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => onTogglePin(note.id, !note.pinned)}
          className={cn(
            "h-8 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition hover:bg-muted",
            note.pinned && "text-primary",
          )}
          title={note.pinned ? "Desafixar do desktop" : "Fixar no desktop"}
        >
          <Pin className="w-3.5 h-3.5" />
          {note.pinned ? "Fixada" : "Fixar"}
        </button>
        <button
          onClick={() => onDelete(note.id)}
          className="h-8 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className="w-full text-xl font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva aqui... (markdown suportado)"
          className="w-full flex-1 min-h-[300px] bg-transparent outline-none text-sm leading-relaxed resize-none placeholder:text-muted-foreground/50"
        />
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="tags separadas por vírgula"
            className="flex-1 text-xs bg-transparent outline-none"
          />
        </div>
      </div>
    </div>
  );
}
