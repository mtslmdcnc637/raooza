"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type VideoProject, type VideoPrompt, type VideoNote } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import {
  Plus,
  Trash2,
  X,
  Star,
  Video,
  Film,
  Sparkles,
  Copy,
  MessageSquare,
  Lightbulb,
  Camera,
  Image as ImageIcon,
  Music,
  Type,
  Edit3,
  ArrowLeft,
  MoreVertical,
  Check,
  RotateCcw,
  ExternalLink,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type PromptType = "image" | "video" | "audio" | "text" | "thumbnail";
type NoteType = "hook" | "script" | "shot" | "broll" | "idea" | "general";

const PROMPT_TYPE_META: Record<PromptType, { icon: any; label: string; color: string }> = {
  image: { icon: ImageIcon, label: "Imagem", color: "#10B981" },
  video: { icon: Film, label: "Vídeo", color: "#F59E0B" },
  audio: { icon: Music, label: "Áudio", color: "#8B5CF6" },
  text: { icon: Type, label: "Texto", color: "#0078D4" },
  thumbnail: { icon: Camera, label: "Thumbnail", color: "#F43F5E" },
};

const NOTE_TYPE_META: Record<NoteType, { icon: any; label: string; color: string }> = {
  hook: { icon: Sparkles, label: "Hook (3s)", color: "#F43F5E" },
  script: { icon: Type, label: "Roteiro", color: "#0078D4" },
  shot: { icon: Camera, label: "Plano", color: "#10B981" },
  broll: { icon: Film, label: "B-roll", color: "#F59E0B" },
  idea: { icon: Lightbulb, label: "Ideia", color: "#8B5CF6" },
  general: { icon: MessageSquare, label: "Anotação", color: "#64748B" },
};

const PROJECT_STATUS_META: Record<VideoProject["status"], { label: string; color: string }> = {
  idea: { label: "Ideia", color: "#94A3B8" },
  scripting: { label: "Roteirizando", color: "#0078D4" },
  recording: { label: "Gravando", color: "#F59E0B" },
  editing: { label: "Editando", color: "#8B5CF6" },
  published: { label: "Publicado", color: "#10B981" },
  archived: { label: "Arquivado", color: "#64748B" },
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter/X",
  other: "Outro",
};

export function VideoPlannerApp() {
  const projects = useLiveQuery(async () => {
    return (await getDb().videoProjects.toArray()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const selected = (projects ?? []).find((p) => p.id === selectedId);

  async function createProject(data: Partial<VideoProject>) {
    const now = new Date().toISOString();
    const project: VideoProject = {
      id: uid("vid"),
      title: data.title || "Novo vídeo",
      description: data.description,
      status: data.status || "idea",
      platform: data.platform,
      targetDuration: data.targetDuration,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().videoProjects.add(project);
    setSelectedId(project.id);
    setShowCreate(false);
    triggerRefresh();
  }

  async function deleteProject(id: string) {
    if (!confirm("Apagar este projeto de vídeo? Todos os prompts e anotações serão removidos.")) return;
    await getDb().videoPrompts.where("projectId").equals(id).delete();
    await getDb().videoNotes.where("projectId").equals(id).delete();
    await getDb().videoProjects.delete(id);
    if (selectedId === id) setSelectedId(null);
    triggerRefresh();
  }

  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        onBack={() => setSelectedId(null)}
        onDelete={() => deleteProject(selected.id)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <Video className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Vídeos</h2>
          <p className="text-xs text-muted-foreground">{(projects ?? []).length} projeto(s)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(projects ?? []).map((p) => {
            const statusMeta = PROJECT_STATUS_META[p.status];
            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="group p-3 rounded-lg bg-card border border-border/40 hover:border-border transition cursor-pointer"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: statusMeta.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: `${statusMeta.color}20`, color: statusMeta.color }}
                  >
                    {statusMeta.label}
                  </span>
                  {p.platform && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {PLATFORM_LABELS[p.platform]}
                    </span>
                  )}
                  {p.targetDuration && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDuration(p.targetDuration)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(!projects || projects.length === 0) && (
            <div className="col-span-full text-center py-12">
              <Video className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-1">Nenhum projeto de vídeo ainda</p>
              <p className="text-xs text-muted-foreground/70">Crie seu primeiro vídeo para organizar prompts, roteiro e anotações</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateProjectDialog onCreate={createProject} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function ProjectDetail({
  project,
  onBack,
  onDelete,
}: {
  project: VideoProject;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"prompts" | "notes" | "info">("prompts");
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  useEffect(() => {
    setTitle(project.title);
    setDescription(project.description ?? "");
  }, [project.id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (title !== project.title || description !== (project.description ?? "")) {
        await getDb().videoProjects.update(project.id, {
          title,
          description,
          updatedAt: new Date().toISOString(),
        });
        triggerRefresh();
      }
    }, 500);
    return () => clearTimeout(t);
  }, [title, description]);

  async function setStatus(status: VideoProject["status"]) {
    await getDb().videoProjects.update(project.id, { status, updatedAt: new Date().toISOString() });
    triggerRefresh();
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <button onClick={onBack} className="w-7 h-7 grid place-items-center rounded hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm font-semibold"
        />
        <button
          onClick={onDelete}
          className="w-7 h-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-3 py-1.5 gap-1 border-b border-border/40 bg-muted/20">
        <TabButton active={tab === "prompts"} onClick={() => setTab("prompts")} icon={Sparkles} label="Prompts" />
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")} icon={MessageSquare} label="Anotações" />
        <TabButton active={tab === "info"} onClick={() => setTab("info")} icon={MoreVertical} label="Detalhes" />
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-1 overflow-x-auto">
        <span className="text-[10px] uppercase text-muted-foreground font-semibold mr-1">Status:</span>
        {(Object.keys(PROJECT_STATUS_META) as VideoProject["status"][]).map((s) => {
          const meta = PROJECT_STATUS_META[s];
          const active = project.status === s;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "h-6 px-2 rounded-full text-[10px] font-medium whitespace-nowrap transition",
                active ? "text-white" : "hover:bg-muted",
              )}
              style={active ? { background: meta.color } : {}}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "prompts" && <PromptsTab project={project} />}
        {tab === "notes" && <NotesTab project={project} />}
        {tab === "info" && <InfoTab project={project} />}
      </div>
    </div>
  );
}

function PromptsTab({ project }: { project: VideoProject }) {
  const prompts = useLiveQuery(async () => {
    return (await getDb().videoPrompts.where("projectId").equals(project.id).toArray()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [project.id]);
  const [filterType, setFilterType] = useState<PromptType | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const filtered = (prompts ?? []).filter((p) => filterType === "all" || p.type === filterType);

  async function createPrompt(data: { title: string; content: string; type: PromptType }) {
    const now = new Date().toISOString();
    const prompt: VideoPrompt = {
      id: uid("vp"),
      projectId: project.id,
      title: data.title,
      content: data.content,
      type: data.type,
      rating: 0,
      status: "draft",
      tags: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().videoPrompts.add(prompt);
    setShowCreate(false);
    triggerRefresh();
  }

  async function updatePrompt(id: string, patch: Partial<VideoPrompt>) {
    await getDb().videoPrompts.update(id, { ...patch, updatedAt: new Date().toISOString() });
    triggerRefresh();
  }

  async function deletePrompt(id: string) {
    if (!confirm("Apagar este prompt?")) return;
    await getDb().videoPrompts.delete(id);
    triggerRefresh();
  }

  async function iterate(prompt: VideoPrompt) {
    const now = new Date().toISOString();
    const newPrompt: VideoPrompt = {
      ...prompt,
      id: uid("vp"),
      version: prompt.version + 1,
      parentPromptId: prompt.id,
      rating: 0,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await getDb().videoPrompts.add(newPrompt);
    triggerRefresh();
  }

  async function copyPrompt(content: string) {
    await navigator.clipboard.writeText(content);
  }

  return (
    <div className="p-3">
      {/* Filter + add */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <FilterChip active={filterType === "all"} onClick={() => setFilterType("all")}>Todos</FilterChip>
        {(Object.keys(PROMPT_TYPE_META) as PromptType[]).map((t) => {
          const meta = PROMPT_TYPE_META[t];
          const Icon = meta.icon;
          return (
            <FilterChip key={t} active={filterType === t} onClick={() => setFilterType(t)}>
              <Icon className="w-3 h-3 inline mr-1" style={{ color: meta.color }} />
              {meta.label}
            </FilterChip>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => setShowCreate(true)}
          className="h-7 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Prompt
        </button>
      </div>

      {/* Prompts */}
      <div className="space-y-2">
        {filtered.map((p) => {
          const meta = PROMPT_TYPE_META[p.type];
          const Icon = meta.icon;
          return (
            <div key={p.id} className="group p-3 rounded-lg bg-card border border-border/40">
              <div className="flex items-start gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-md grid place-items-center flex-shrink-0"
                  style={{ background: `${meta.color}20`, color: meta.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                    {p.version > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        v{p.version}
                      </span>
                    )}
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {meta.label}
                  </div>
                </div>
                <button
                  onClick={() => deletePrompt(p.id)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Prompt content */}
              <div className="p-2 rounded-md bg-muted/30 mb-2 group/content">
                <pre className="text-xs whitespace-pre-wrap font-mono break-words">{p.content}</pre>
                <button
                  onClick={() => copyPrompt(p.content)}
                  className="opacity-0 group-hover/content:opacity-100 mt-1 text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <Copy className="w-2.5 h-2.5" /> Copiar
                </button>
              </div>

              {/* Result */}
              {p.result && (
                <div className="p-2 rounded-md bg-green-500/5 border border-green-500/20 mb-2">
                  <div className="text-[10px] uppercase font-semibold text-green-700 dark:text-green-300 mb-1">Resultado</div>
                  <div className="text-xs whitespace-pre-wrap">{p.result}</div>
                </div>
              )}

              {/* Notes */}
              {p.notes && (
                <div className="p-2 rounded-md bg-amber-500/5 border border-amber-500/20 mb-2">
                  <div className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-300 mb-1">Anotações</div>
                  <div className="text-xs whitespace-pre-wrap">{p.notes}</div>
                </div>
              )}

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => updatePrompt(p.id, { rating: p.rating === n ? 0 : n })}
                      className="w-5 h-5 grid place-items-center transition hover:scale-110"
                    >
                      <Star
                        className={cn("w-3.5 h-3.5", n <= p.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => iterate(p)}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                  title="Criar nova versão baseada neste prompt"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Iterar
                </button>
              </div>

              {/* Quick status buttons */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => updatePrompt(p.id, { status: "approved" })}
                  className={cn(
                    "flex-1 h-6 text-[10px] rounded transition flex items-center justify-center gap-1",
                    p.status === "approved" ? "bg-green-500 text-white" : "bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20",
                  )}
                >
                  <Check className="w-2.5 h-2.5" /> Aprovado
                </button>
                <button
                  onClick={() => updatePrompt(p.id, { status: "rejected" })}
                  className={cn(
                    "flex-1 h-6 text-[10px] rounded transition flex items-center justify-center gap-1",
                    p.status === "rejected" ? "bg-red-500 text-white" : "bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20",
                  )}
                >
                  <X className="w-2.5 h-2.5" /> Rejeitado
                </button>
                <button
                  onClick={() => updatePrompt(p.id, { status: "testing" })}
                  className={cn(
                    "flex-1 h-6 text-[10px] rounded transition flex items-center justify-center gap-1",
                    p.status === "testing" ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20",
                  )}
                >
                  Testando
                </button>
              </div>

              {/* Edit result/notes */}
              <PromptEditor prompt={p} onUpdate={updatePrompt} />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhum prompt ainda. Crie seu primeiro prompt de IA para este vídeo.
          </div>
        )}
      </div>

      {showCreate && <CreatePromptDialog onCreate={createPrompt} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function PromptEditor({ prompt, onUpdate }: { prompt: VideoPrompt; onUpdate: (id: string, patch: Partial<VideoPrompt>) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState(prompt.result ?? "");
  const [notes, setNotes] = useState(prompt.notes ?? "");

  useEffect(() => {
    setResult(prompt.result ?? "");
    setNotes(prompt.notes ?? "");
  }, [prompt.id]);

  async function save() {
    await onUpdate(prompt.id, { result, notes });
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="mt-2 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <Edit3 className="w-2.5 h-2.5" /> Editar resultado/anotações
      </button>
    );
  }

  return (
    <div className="mt-2 p-2 rounded-md bg-muted/30 space-y-2">
      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground">Resultado gerado / URL</label>
        <textarea
          value={result}
          onChange={(e) => setResult(e.target.value)}
          rows={2}
          placeholder="O que foi gerado, ou URL do resultado..."
          className="w-full mt-1 p-2 text-xs rounded bg-background border border-border/60 outline-none focus:border-primary resize-y"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground">Anotações (o que funcionou, o que não funcionou)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Ex: cores ficaram saturadas, composição boa, próximo teste aumentar contraste..."
          className="w-full mt-1 p-2 text-xs rounded bg-background border border-border/60 outline-none focus:border-primary resize-y"
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={save}
          className="flex-1 h-7 text-xs rounded bg-primary text-primary-foreground"
          style={{ background: "var(--accent-color)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="h-7 px-3 text-xs rounded hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function NotesTab({ project }: { project: VideoProject }) {
  const notes = useLiveQuery(async () => {
    return (await getDb().videoNotes.where("projectId").equals(project.id).toArray()).sort((a, b) => a.order - b.order);
  }, [project.id]);
  const [filterType, setFilterType] = useState<NoteType | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const filtered = (notes ?? []).filter((n) => filterType === "all" || n.type === filterType);

  async function createNote(data: { title: string; content: string; type: NoteType }) {
    const now = new Date().toISOString();
    const order = (notes ?? []).length;
    const note: VideoNote = {
      id: uid("vn"),
      projectId: project.id,
      type: data.type,
      title: data.title,
      content: data.content,
      order,
      createdAt: now,
      updatedAt: now,
    };
    await getDb().videoNotes.add(note);
    setShowCreate(false);
    triggerRefresh();
  }

  async function updateNote(id: string, patch: Partial<VideoNote>) {
    await getDb().videoNotes.update(id, { ...patch, updatedAt: new Date().toISOString() });
    triggerRefresh();
  }

  async function deleteNote(id: string) {
    await getDb().videoNotes.delete(id);
    triggerRefresh();
  }

  return (
    <div className="p-3">
      {/* Filter + add */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <FilterChip active={filterType === "all"} onClick={() => setFilterType("all")}>Todas</FilterChip>
        {(Object.keys(NOTE_TYPE_META) as NoteType[]).map((t) => {
          const meta = NOTE_TYPE_META[t];
          const Icon = meta.icon;
          return (
            <FilterChip key={t} active={filterType === t} onClick={() => setFilterType(t)}>
              <Icon className="w-3 h-3 inline mr-1" style={{ color: meta.color }} />
              {meta.label}
            </FilterChip>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => setShowCreate(true)}
          className="h-7 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Anotação
        </button>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        {filtered.map((n) => {
          const meta = NOTE_TYPE_META[n.type];
          const Icon = meta.icon;
          return (
            <div key={n.id} className="group p-3 rounded-lg bg-card border border-border/40">
              <div className="flex items-start gap-2 mb-1">
                <div
                  className="w-7 h-7 rounded-md grid place-items-center flex-shrink-0"
                  style={{ background: `${meta.color}20`, color: meta.color }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <input
                  value={n.title}
                  onChange={(e) => updateNote(n.id, { title: e.target.value })}
                  className="flex-1 bg-transparent outline-none text-sm font-medium"
                />
                <button
                  onClick={() => deleteNote(n.id)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <textarea
                value={n.content}
                onChange={(e) => updateNote(n.id, { content: e.target.value })}
                placeholder={`Detalhes da ${meta.label.toLowerCase()}...`}
                rows={Math.max(2, Math.ceil(n.content.length / 50))}
                className="w-full p-2 text-xs rounded bg-muted/30 border border-border/40 outline-none focus:border-primary resize-y"
              />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhuma anotação. Adicione hooks, roteiro, planos, ideias de b-roll...
          </div>
        )}
      </div>

      {showCreate && <CreateNoteDialog onCreate={createNote} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function InfoTab({ project }: { project: VideoProject }) {
  const [description, setDescription] = useState(project.description ?? "");
  const [platform, setPlatform] = useState(project.platform ?? "");
  const [targetDuration, setTargetDuration] = useState(project.targetDuration?.toString() ?? "");
  const [publishedUrl, setPublishedUrl] = useState(project.publishedUrl ?? "");
  const [thumbnailIdeas, setThumbnailIdeas] = useState(project.thumbnailIdeas ?? "");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  useEffect(() => {
    setDescription(project.description ?? "");
    setPlatform(project.platform ?? "");
    setTargetDuration(project.targetDuration?.toString() ?? "");
    setPublishedUrl(project.publishedUrl ?? "");
    setThumbnailIdeas(project.thumbnailIdeas ?? "");
  }, [project.id]);

  async function save() {
    await getDb().videoProjects.update(project.id, {
      description,
      platform: (platform || undefined) as VideoProject["platform"],
      targetDuration: targetDuration ? parseInt(targetDuration) : undefined,
      publishedUrl,
      thumbnailIdeas,
      updatedAt: new Date().toISOString(),
    });
    triggerRefresh();
  }

  return (
    <div className="p-4 max-w-2xl space-y-3">
      <div>
        <label className="text-xs font-medium mb-1 block">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Sinopse do vídeo..."
          className="w-full p-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium mb-1 block">Plataforma</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full h-9 px-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          >
            <option value="">—</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter/X</option>
            <option value="other">Outro</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block">Duração alvo (segundos)</label>
          <input
            type="number"
            value={targetDuration}
            onChange={(e) => setTargetDuration(e.target.value)}
            placeholder="60"
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">URL do vídeo publicado</label>
        <div className="flex gap-2">
          <input
            value={publishedUrl}
            onChange={(e) => setPublishedUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          {publishedUrl && (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 grid place-items-center rounded-md hover:bg-muted text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">Ideias de thumbnail</label>
        <textarea
          value={thumbnailIdeas}
          onChange={(e) => setThumbnailIdeas(e.target.value)}
          rows={4}
          placeholder="Descreva ideias de thumbnail:&#10;- Rosto surpreso + texto grande&#10;- Contraste alto, cores vibrantes&#10;- Antes/depois split..."
          className="w-full p-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
        />
      </div>
      <button
        onClick={save}
        className="h-9 px-4 text-sm rounded-md text-white font-medium"
        style={{ background: "var(--accent-color)" }}
      >
        Salvar
      </button>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-md text-xs flex items-center gap-1.5 transition",
        active ? "bg-background shadow-sm font-medium" : "hover:bg-muted/60 text-muted-foreground",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-full text-[10px] transition flex items-center gap-1",
        active ? "text-white" : "bg-muted/60 hover:bg-muted text-muted-foreground",
      )}
      style={active ? { background: "var(--accent-color)" } : {}}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: VideoPrompt["status"] }) {
  const meta: Record<VideoPrompt["status"], { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "#94A3B8" },
    testing: { label: "Testando", color: "#F59E0B" },
    approved: { label: "Aprovado", color: "#10B981" },
    rejected: { label: "Rejeitado", color: "#F43F5E" },
  };
  const m = meta[status];
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: `${m.color}20`, color: m.color }}
    >
      {m.label}
    </span>
  );
}

function CreateProjectDialog({ onCreate, onClose }: { onCreate: (data: Partial<VideoProject>) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<VideoProject["platform"]>("youtube");

  function submit() {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim(), platform });
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Novo projeto de vídeo</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Título do vídeo"
            autoFocus
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição curta (opcional)"
            rows={2}
            className="w-full p-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
          />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as VideoProject["platform"])}
            className="w-full h-9 px-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          >
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter/X</option>
            <option value="other">Outro</option>
          </select>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePromptDialog({ onCreate, onClose }: { onCreate: (data: { title: string; content: string; type: PromptType }) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<PromptType>("image");

  function submit() {
    if (!title.trim() || !content.trim()) return;
    onCreate({ title: title.trim(), content: content.trim(), type });
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Novo prompt</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ex: Cena abertura cyberpunk)"
            autoFocus
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(PROMPT_TYPE_META) as PromptType[]).map((t) => {
              const meta = PROMPT_TYPE_META[t];
              const Icon = meta.icon;
              const active = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs flex items-center gap-1.5 transition",
                    active ? "text-white" : "bg-muted/60 hover:bg-muted",
                  )}
                  style={active ? { background: meta.color } : {}}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite o prompt..."
            rows={6}
            className="w-full p-2 text-xs font-mono rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
          />
          <button
            onClick={submit}
            disabled={!title.trim() || !content.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar prompt
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateNoteDialog({ onCreate, onClose }: { onCreate: (data: { title: string; content: string; type: NoteType }) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("hook");

  function submit() {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), content: content.trim(), type });
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Nova anotação</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(NOTE_TYPE_META) as NoteType[]).map((t) => {
              const meta = NOTE_TYPE_META[t];
              const Icon = meta.icon;
              const active = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs flex items-center gap-1.5 transition",
                    active ? "text-white" : "bg-muted/60 hover:bg-muted",
                  )}
                  style={active ? { background: meta.color } : {}}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            autoFocus
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Detalhes..."
            rows={5}
            className="w-full p-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
          />
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
