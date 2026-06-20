"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type WikiPage } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import { Plus, Search, Trash2, X, Link2, FileText, Tag, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindowState } from "@/lib/os/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Extract [[links]] from content
function extractLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return Array.from(matches).map((m) => m[1].trim());
}

// Render content with [[links]] as clickable spans
function renderContent(content: string, onLinkClick: (title: string) => void) {
  const parts: React.ReactNode[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const title = match[1].trim();
    parts.push(
      <button
        key={key++}
        onClick={() => onLinkClick(title)}
        className="text-primary underline decoration-dotted hover:decoration-solid"
      >
        {title}
      </button>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts;
}

export function WikiApp({ win }: { win: WindowState }) {
  const pages = useLiveQuery(async () => await getDb().wikiPages.toArray(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showGraph, setShowGraph] = useState(false);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const setTitle = useWindowStore((s) => s.setTitle);

  useEffect(() => {
    if (win.payload?.pageId) setSelectedId(win.payload.pageId as string);
  }, [win.payload?.pageId]);

  const filtered = (pages ?? []).filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase()) ||
    p.content.toLowerCase().includes(query.toLowerCase()),
  );

  async function createPage() {
    const now = new Date().toISOString();
    const page: WikiPage = {
      id: uid("wiki"),
      title: "Nova página",
      content: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().wikiPages.add(page);
    setSelectedId(page.id);
    triggerRefresh();
  }

  async function deletePage(id: string) {
    if (!confirm("Apagar esta página?")) return;
    await getDb().wikiPages.delete(id);
    if (selectedId === id) setSelectedId(null);
    triggerRefresh();
  }

  const selected = (pages ?? []).find((p) => p.id === selectedId);

  // Compute backlinks
  const backlinks = useMemo(() => {
    if (!selected) return [];
    return (pages ?? []).filter((p) =>
      p.id !== selected.id && extractLinks(p.content).some((l) => l.toLowerCase() === selected.title.toLowerCase()),
    );
  }, [selected, pages]);

  // Forward links
  const forwardLinks = useMemo(() => {
    if (!selected) return [];
    const linkTitles = extractLinks(selected.content);
    return (pages ?? []).filter((p) =>
      linkTitles.some((t) => t.toLowerCase() === p.title.toLowerCase()),
    );
  }, [selected, pages]);

  useEffect(() => {
    if (selected) setTitle(win.id, `Wiki - ${selected.title}`);
  }, [selected?.title, setTitle, win.id]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 border-r border-border/40 flex flex-col bg-muted/20">
        <div className="p-3 border-b border-border/40 space-y-2">
          <button
            onClick={createPage}
            className="w-full h-8 rounded-md text-xs font-medium hover:opacity-90 transition flex items-center justify-center gap-1.5 text-white"
            style={{ background: "var(--accent-color)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Nova página
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
          <button
            onClick={() => setShowGraph((v) => !v)}
            className={cn(
              "w-full h-7 text-[10px] rounded-md flex items-center justify-center gap-1 transition",
              showGraph ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <Network className="w-3 h-3" />
            {showGraph ? "Ver lista" : "Ver grafo"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "w-full text-left p-2 rounded-md text-xs transition group cursor-pointer",
                selectedId === p.id ? "bg-muted/60" : "hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{p.title || "Sem título"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {p.tags.length > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {p.tags.join(", ")}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Nenhuma página
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showGraph ? (
          <GraphView pages={pages ?? []} onOpen={(id) => { setSelectedId(id); setShowGraph(false); }} />
        ) : selected ? (
          <PageEditor
            key={selected.id}
            page={selected}
            backlinks={backlinks}
            forwardLinks={forwardLinks}
            onLinkClick={(title) => {
              const target = (pages ?? []).find((p) => p.title.toLowerCase() === title.toLowerCase());
              if (target) setSelectedId(target.id);
              else {
                // Create page on the fly
                (async () => {
                  const now = new Date().toISOString();
                  const newPage: WikiPage = {
                    id: uid("wiki"),
                    title,
                    content: "",
                    tags: [],
                    createdAt: now,
                    updatedAt: now,
                  };
                  await getDb().wikiPages.add(newPage);
                  setSelectedId(newPage.id);
                  triggerRefresh();
                })();
              }
            }}
          />
        ) : (
          <div className="h-full grid place-items-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div className="text-sm">Selecione ou crie uma página</div>
              <div className="text-xs mt-1">Use [[duplo colchete]] para criar links</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageEditor({
  page,
  backlinks,
  forwardLinks,
  onLinkClick,
}: {
  page: WikiPage;
  backlinks: WikiPage[];
  forwardLinks: WikiPage[];
  onLinkClick: (title: string) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [tagsInput, setTagsInput] = useState(page.tags.join(", "));
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  useEffect(() => {
    setTitle(page.title);
    setContent(page.content);
    setTagsInput(page.tags.join(", "));
  }, [page.id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (title !== page.title || content !== page.content || tagsInput !== page.tags.join(", ")) {
        await getDb().wikiPages.update(page.id, {
          title,
          content,
          tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        });
        triggerRefresh();
      }
    }, 500);
    return () => clearTimeout(t);
  }, [title, content, tagsInput]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-10 py-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da página"
            className="w-full text-3xl font-bold bg-transparent outline-none mb-4 placeholder:text-muted-foreground/30"
          />
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
            <Tag className="w-3 h-3" />
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tags separadas por vírgula"
              className="flex-1 bg-transparent outline-none"
            />
          </div>
          <div className="text-xs text-muted-foreground mb-3 italic">
            Use [[Nome da página]] para criar links. Salva automaticamente.
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comece a escrever... Use [[links]] para conectar páginas."
            className="w-full min-h-[400px] bg-transparent outline-none text-sm leading-relaxed resize-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Backlinks panel */}
      <div className="w-56 border-l border-border/40 bg-muted/20 p-3 overflow-y-auto">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Links de saída
        </div>
        <div className="space-y-1 mb-4">
          {forwardLinks.length === 0 ? (
            <div className="text-[10px] text-muted-foreground/60 px-1">Nenhum</div>
          ) : (
            forwardLinks.map((p) => (
              <button
                key={p.id}
                onClick={() => onLinkClick(p.title)}
                className="block w-full text-left text-xs p-1.5 rounded hover:bg-muted/60 truncate"
              >
                → {p.title}
              </button>
            ))
          )}
        </div>
        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Link2 className="w-3 h-3 rotate-180" /> Backlinks
        </div>
        <div className="space-y-1">
          {backlinks.length === 0 ? (
            <div className="text-[10px] text-muted-foreground/60 px-1">Nenhum</div>
          ) : (
            backlinks.map((p) => (
              <button
                key={p.id}
                onClick={() => onLinkClick(p.title)}
                className="block w-full text-left text-xs p-1.5 rounded hover:bg-muted/60 truncate"
              >
                ← {p.title}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function GraphView({ pages, onOpen }: { pages: WikiPage[]; onOpen: (id: string) => void }) {
  // Simple SVG graph: each page is a node, links are edges
  const nodes = useMemo(() => {
    return pages.map((p, i) => {
      const angle = (i / Math.max(1, pages.length)) * 2 * Math.PI;
      const r = Math.min(180, pages.length * 12);
      return {
        id: p.id,
        title: p.title,
        x: 250 + r * Math.cos(angle),
        y: 200 + r * Math.sin(angle),
        links: extractLinks(p.content),
      };
    });
  }, [pages]);

  const edges = useMemo(() => {
    const e: { from: string; to: string }[] = [];
    nodes.forEach((n) => {
      n.links.forEach((linkTitle) => {
        const target = pages.find((p) => p.title.toLowerCase() === linkTitle.toLowerCase());
        if (target) e.push({ from: n.id, to: target.id });
      });
    });
    return e;
  }, [nodes, pages]);

  const nodeById = (id: string) => nodes.find((n) => n.id === id);

  return (
    <div className="flex-1 overflow-hidden bg-muted/10">
      <svg viewBox="0 0 500 400" className="w-full h-full">
        {edges.map((edge, i) => {
          const from = nodeById(edge.from);
          const to = nodeById(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground/40"
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} onClick={() => onOpen(n.id)} className="cursor-pointer">
            <circle
              cx={n.x}
              cy={n.y}
              r={6}
              fill="var(--accent-color)"
              className="hover:opacity-80"
            />
            <text
              x={n.x}
              y={n.y - 12}
              textAnchor="middle"
              className="fill-foreground text-[10px] pointer-events-none"
            >
              {n.title.length > 18 ? n.title.slice(0, 18) + "…" : n.title}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground">
        {pages.length} páginas · {edges.length} conexões · clique em um nó para abrir
      </div>
    </div>
  );
}
