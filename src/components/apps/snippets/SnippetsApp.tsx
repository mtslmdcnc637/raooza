"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Snippet } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { useSnippetsExpansion, BUILTIN_SNIPPETS } from "@/lib/snippets/useSnippetsExpansion";
import { Plus, Trash2, X, Zap, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SnippetsApp() {
  // Activate the global expansion listener
  useSnippetsExpansion();

  const snippets = useLiveQuery(async () => await getDb().snippets.toArray(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const filtered = (snippets ?? []).filter(
    (s) =>
      s.trigger.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.content.toLowerCase().includes(query.toLowerCase()),
  );

  async function deleteSnippet(id: string) {
    if (!confirm("Apagar este snippet?")) return;
    await getDb().snippets.delete(id);
    triggerRefresh();
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <Zap className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Snippets</h2>
          <p className="text-xs text-muted-foreground">
            Digite um trigger + espaço em qualquer campo de texto para expandir
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

      {/* Search */}
      <div className="p-3 border-b border-border/40">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted/40 border border-border/60">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar snippets..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="group p-3 rounded-lg bg-card border border-border/40 hover:border-border transition"
          >
            <div className="flex items-start gap-2">
              <code
                className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono flex-shrink-0"
              >
                {s.trigger}
              </code>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono whitespace-pre-wrap">
                  {s.content}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {s.isBuiltin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    built-in
                  </span>
                )}
                {!s.isBuiltin && (
                  <button
                    onClick={() => deleteSnippet(s.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum snippet encontrado
          </div>
        )}
      </div>

      {/* Help footer */}
      <div className="p-3 border-t border-border/40 bg-muted/20">
        <div className="text-[10px] text-muted-foreground">
          💡 Em qualquer campo de texto do Raooza, digite o trigger (ex: <code className="font-mono">/meeting</code>) seguido de espaço para expandir.
        </div>
      </div>

      {showCreate && <CreateSnippetDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateSnippetDialog({ onClose }: { onClose: () => void }) {
  const [trigger, setTrigger] = useState("/");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);

  useEffect(() => {
    // Ensure trigger starts with /
    if (!trigger.startsWith("/")) setTrigger("/" + trigger);
  }, [trigger]);

  async function save() {
    if (!trigger.trim() || !name.trim() || !content.trim()) return;
    if (!trigger.startsWith("/")) {
      notify({ app: "snippets", title: "Trigger deve começar com /" });
      return;
    }
    // Check if trigger exists
    const existing = await getDb().snippets.where("trigger").equals(trigger).first();
    if (existing) {
      notify({ app: "snippets", title: `Trigger "${trigger}" já existe` });
      return;
    }
    const now = new Date().toISOString();
    await getDb().snippets.add({
      id: uid("snip"),
      trigger: trigger.trim(),
      name: name.trim(),
      content,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    });
    triggerRefresh();
    notify({ app: "snippets", title: `Snippet criado: ${trigger}` });
    onClose();
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Novo snippet</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Trigger</label>
              <input
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="/reuniao"
                autoFocus
                className="w-full h-9 px-3 text-sm font-mono rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ata de reunião"
                className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Conteúdo expandido</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Texto que será inserido quando o trigger for digitado..."
              rows={8}
              className="w-full p-2 text-xs font-mono rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
            />
          </div>
          <button
            onClick={save}
            disabled={!trigger.trim() || !name.trim() || !content.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar snippet
          </button>
        </div>
      </div>
    </div>
  );
}
