"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type EditorDoc } from "@/lib/db/db";
import { apiUrl } from "@/lib/ai/providers";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import {
  Plus,
  Trash2,
  Search,
  Type,
  Heading1,
  Heading2,
  List,
  Quote,
  Code,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindowState } from "@/lib/os/types";

type BlockType = "paragraph" | "heading1" | "heading2" | "bullet" | "todo" | "quote" | "code";

interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "Texto",
  heading1: "Título 1",
  heading2: "Título 2",
  bullet: "Lista",
  todo: "Checkbox",
  quote: "Citação",
  code: "Código",
};

export function EditorApp({ win }: { win: WindowState }) {
  const docs = useLiveQuery(async () => {
    return await getDb().editorDocs.orderBy("updatedAt").reverse().toArray();
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const setTitle = useWindowStore((s) => s.setTitle);
  const [slashOpen, setSlashOpen] = useState<{ blockId: string; pos: { x: number; y: number } } | null>(null);

  useEffect(() => {
    if (win.payload?.docId) setSelectedId(win.payload.docId as string);
  }, [win.payload?.docId]);

  const filtered = (docs ?? []).filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase()),
  );

  async function createDoc() {
    const now = new Date().toISOString();
    const doc: EditorDoc = {
      id: uid("doc"),
      title: "Novo documento",
      blocks: [{ id: uid("b"), type: "paragraph", text: "" }],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().editorDocs.add(doc);
    setSelectedId(doc.id);
    triggerRefresh();
  }

  async function deleteDoc(id: string) {
    if (!confirm("Apagar este documento?")) return;
    await getDb().editorDocs.delete(id);
    if (selectedId === id) setSelectedId(null);
    triggerRefresh();
  }

  const selected = (docs ?? []).find((d) => d.id === selectedId);

  useEffect(() => {
    if (selected) setTitle(win.id, `Editor - ${selected.title}`);
  }, [selected?.title, setTitle, win.id]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 border-r border-border/40 flex flex-col bg-muted/20">
        <div className="p-3 border-b border-border/40 space-y-2">
          <button
            onClick={createDoc}
            className="w-full h-9 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2 text-white"
            style={{ background: "var(--accent-color)" }}
          >
            <Plus className="w-4 h-4" /> Novo doc
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
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={cn(
                "w-full text-left p-2 rounded-lg transition group cursor-pointer",
                selectedId === d.id ? "bg-muted/60" : "hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-2">
                <Type className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium truncate flex-1">{d.title || "Sem título"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(d.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Nenhum documento
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <DocEditor key={selected.id} doc={selected} />
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground">
            <div className="text-center">
              <Type className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div className="text-sm">Selecione ou crie um documento</div>
            </div>
          </div>
        )}
      </div>

      {/* Slash menu */}
      {slashOpen && (
        <SlashMenu
          pos={slashOpen.pos}
          onSelect={(type) => {
            if (selected && slashOpen) {
              changeBlockType(selected, slashOpen.blockId, type);
            }
            setSlashOpen(null);
          }}
          onClose={() => setSlashOpen(null)}
        />
      )}
    </div>
  );

  async function changeBlockType(doc: EditorDoc, blockId: string, type: BlockType) {
    const blocks = doc.blocks.map((b) => (b.id === blockId ? { ...b, type } : b));
    await getDb().editorDocs.update(doc.id, { blocks, updatedAt: new Date().toISOString() });
    triggerRefresh();
  }
}

function DocEditor({ doc }: { doc: EditorDoc }) {
  const [title, setTitle] = useState(doc.title);
  const [blocks, setBlocks] = useState<Block[]>(doc.blocks as Block[]);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    setTitle(doc.title);
    setBlocks(doc.blocks as Block[]);
  }, [doc.id]);

  // Debounced save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await getDb().editorDocs.update(doc.id, {
        title,
        blocks: blocks as any,
        updatedAt: new Date().toISOString(),
      });
      triggerRefresh();
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, blocks]);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function addBlock(afterId?: string) {
    const newB: Block = { id: uid("b"), type: "paragraph", text: "" };
    setBlocks((bs) => {
      if (!afterId) return [...bs, newB];
      const idx = bs.findIndex((b) => b.id === afterId);
      const arr = [...bs];
      arr.splice(idx + 1, 0, newB);
      return arr;
    });
    return newB.id;
  }
  function deleteBlock(id: string) {
    setBlocks((bs) => {
      if (bs.length === 1) return bs;
      return bs.filter((b) => b.id !== id);
    });
  }
  function changeBlockTypeLocal(id: string, type: BlockType) {
    updateBlock(id, { type });
  }

  return (
    <div className="max-w-3xl mx-auto px-12 py-8 h-full overflow-y-auto">
      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Sem título"
        className="w-full text-4xl font-bold bg-transparent outline-none mb-6 placeholder:text-muted-foreground/30"
      />

      {/* AI toolbar */}
      <div className="flex items-center gap-2 mb-6 pb-3 border-b border-border/40">
        <button
          onClick={async () => {
            const res = await fetch(apiUrl("/api/ai"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "glm",
                apiKey: "",
                model: "glm-4.6",
                messages: [
                  {
                    role: "user",
                    content: `Resuma este documento em 3 bullets curtos:\n\nTítulo: ${title}\nConteúdo:\n${blocks.map((b) => b.text).join("\n")}`,
                  },
                ],
              }),
            });
            const data = await res.json();
            if (data.content) {
              const summaryBlocks: Block[] = data.content
                .split("\n")
                .filter((s: string) => s.trim())
                .map((s: string) => ({
                  id: uid("b"),
                  type: "bullet" as BlockType,
                  text: s.replace(/^[-*]\s*/, ""),
                }));
              setBlocks((bs) => [...bs, ...summaryBlocks]);
            }
          }}
          className="h-7 px-2.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition flex items-center gap-1"
          style={{ color: "var(--accent-color)" }}
        >
          <Wand2 className="w-3 h-3" />
          Resumir com IA
        </button>
        <button
          onClick={async () => {
            const last = blocks[blocks.length - 1];
            if (!last || !last.text) return;
            const res = await fetch(apiUrl("/api/ai"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "glm",
                apiKey: "",
                model: "glm-4.6",
                messages: [
                  {
                    role: "user",
                    content: `Continue este parágrafo com 1-2 frases, mantendo o tom:\n\n${last.text}`,
                  },
                ],
              }),
            });
            const data = await res.json();
            if (data.content) {
              updateBlock(last.id, { text: last.text + " " + data.content.trim() });
            }
          }}
          className="h-7 px-2.5 text-xs rounded-md bg-primary/10 hover:bg-primary/20 transition flex items-center gap-1"
          style={{ color: "var(--accent-color)" }}
        >
          <Sparkles className="w-3 h-3" />
          Continuar texto
        </button>
      </div>

      {/* Blocks */}
      <div className="space-y-1">
        {blocks.map((b, i) => (
          <BlockView
            key={b.id}
            block={b}
            isFirst={i === 0}
            onChange={(patch) => updateBlock(b.id, patch)}
            onEnter={() => {
              const newId = addBlock(b.id);
              setTimeout(() => {
                document.getElementById(`block-${newId}`)?.focus();
              }, 30);
            }}
            onBackspaceEmpty={() => deleteBlock(b.id)}
            onChangeType={(type) => changeBlockTypeLocal(b.id, type)}
          />
        ))}
      </div>

      <button
        onClick={() => addBlock()}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        Adicionar bloco
      </button>
    </div>
  );
}

function BlockView({
  block,
  isFirst,
  onChange,
  onEnter,
  onBackspaceEmpty,
  onChangeType,
}: {
  block: Block;
  isFirst: boolean;
  onChange: (patch: Partial<Block>) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onChangeType: (type: BlockType) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    } else if (e.key === "Backspace" && block.text === "") {
      e.preventDefault();
      onBackspaceEmpty();
    } else if (e.key === "/" && block.text === "") {
      e.preventDefault();
      setShowMenu(true);
    }
  }

  const commonProps = {
    id: `block-${block.id}`,
    value: block.text,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ text: e.target.value }),
    onKeyDown: handleKeyDown,
    placeholder: isFirst ? "Comece a escrever... ou digite / para blocos" : "",
    className: "w-full bg-transparent outline-none placeholder:text-muted-foreground/40 text-sm leading-relaxed",
  };

  let content: React.ReactNode;
  switch (block.type) {
    case "heading1":
      content = <input {...commonProps} className={cn(commonProps.className, "text-2xl font-bold mt-4")} />;
      break;
    case "heading2":
      content = <input {...commonProps} className={cn(commonProps.className, "text-lg font-semibold mt-2")} />;
      break;
    case "bullet":
      content = (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground mt-1.5">•</span>
          <input {...commonProps} className={cn(commonProps.className, "flex-1")} />
        </div>
      );
      break;
    case "todo":
      content = (
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={!!block.checked}
            onChange={(e) => onChange({ checked: e.target.checked })}
            className="mt-1.5"
          />
          <input
            {...commonProps}
            className={cn(commonProps.className, "flex-1", block.checked && "line-through text-muted-foreground")}
          />
        </div>
      );
      break;
    case "quote":
      content = (
        <div className="border-l-2 pl-3 italic text-muted-foreground">
          <input {...commonProps} />
        </div>
      );
      break;
    case "code":
      content = (
        <textarea
          {...(commonProps as any)}
          rows={3}
          className={cn(commonProps.className, "font-mono text-xs bg-muted/60 p-2 rounded")}
        />
      );
      break;
    default:
      content = <input {...commonProps} />;
  }

  return (
    <div className="group relative py-0.5">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="absolute -left-6 top-1 w-5 h-5 grid place-items-center text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition"
      >
        <Plus className="w-3 h-3" />
      </button>
      {showMenu && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 rounded-lg border border-border bg-popover shadow-xl p-1">
          {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
            const Icon = { paragraph: Type, heading1: Heading1, heading2: Heading2, bullet: List, todo: List, quote: Quote, code: Code }[t];
            return (
              <button
                key={t}
                onClick={() => {
                  onChangeType(t);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition"
              >
                <Icon className="w-3.5 h-3.5" />
                {BLOCK_LABELS[t]}
              </button>
            );
          })}
        </div>
      )}
      {content}
    </div>
  );
}

function SlashMenu({
  pos,
  onSelect,
  onClose,
}: {
  pos: { x: number; y: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        className="fixed z-[61] w-48 rounded-lg border border-border bg-popover shadow-xl p-1"
        style={{ left: pos.x, top: pos.y }}
      >
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => {
          const Icon = { paragraph: Type, heading1: Heading1, heading2: Heading2, bullet: List, todo: List, quote: Quote, code: Code }[t];
          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition"
            >
              <Icon className="w-3.5 h-3.5" />
              {BLOCK_LABELS[t]}
            </button>
          );
        })}
      </div>
    </>
  );
}
