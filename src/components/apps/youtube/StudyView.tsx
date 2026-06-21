"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type YouTubeVideo } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { useSettings } from "@/stores/settingsStore";
import { useYouTubePlayer } from "./useYouTubePlayer";
import {
  ArrowLeft,
  Play,
  Pause,
  Rewind,
  FastForward,
  Gauge,
  MessageSquare,
  Sparkles,
  Bookmark,
  PenTool,
  Layers,
  Plus,
  Trash2,
  Clock,
  Copy,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Eraser,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "notes" | "summary" | "bookmarks" | "canvas" | "flashcards";

const TABS: Array<{ id: Tab; icon: any; label: string }> = [
  { id: "notes", icon: MessageSquare, label: "Anotações" },
  { id: "summary", icon: Sparkles, label: "Resumo IA" },
  { id: "bookmarks", icon: Bookmark, label: "Bookmarks" },
  { id: "canvas", icon: PenTool, label: "Quadro" },
  { id: "flashcards", icon: Layers, label: "Flashcards" },
];

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(sec: number): string {
  if (!sec || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StudyView({ video, onBack }: { video: YouTubeVideo; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("notes");
  const [title, setTitle] = useState(video.title);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const containerId = `yt-player-${video.id}`;

  // Auto-save title
  useEffect(() => {
    setTitle(video.title);
  }, [video.id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (title !== video.title) {
        await getDb().youtubeVideos.update(video.id, { title, updatedAt: new Date().toISOString() });
        triggerRefresh();
      }
    }, 600);
    return () => clearTimeout(t);
  }, [title]);

  // Save progress periodically
  const saveProgress = async (sec: number) => {
    await getDb().youtubeVideos.update(video.id, {
      progressSec: sec,
      status: sec > 0 ? "in-progress" : "not-started",
      updatedAt: new Date().toISOString(),
    });
  };

  // Initialize player
  const {
    isReady,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    seekTo,
    setRate,
    skip,
  } = useYouTubePlayer(
    containerId,
    video.videoId,
    () => {
      // On ready, seek to saved position
      if (video.progressSec > 5) {
        setTimeout(() => seekTo(video.progressSec), 200);
      }
    },
    saveProgress,
    async () => {
      // On end, mark as completed
      await getDb().youtubeVideos.update(video.id, {
        status: "completed",
        updatedAt: new Date().toISOString(),
      });
      triggerRefresh();
    },
  );

  // Update duration in DB once known
  useEffect(() => {
    if (duration && duration !== video.durationSec) {
      getDb().youtubeVideos.update(video.id, { durationSec: duration });
    }
  }, [duration]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <button onClick={onBack} className="w-7 h-7 grid place-items-center rounded hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do vídeo"
          className="flex-1 bg-transparent outline-none text-sm font-semibold"
        />
        <a
          href={`https://youtube.com/watch?v=${video.videoId}`}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Abrir no YouTube ↗
        </a>
      </div>

      {/* Content split: video + tools */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video side */}
        <div className="md:w-3/5 md:flex-shrink-0 flex flex-col bg-black">
          <div className="relative w-full pt-[56.25%] md:pt-0 md:h-full md:flex-1">
            <div id={containerId} className="absolute inset-0 w-full h-full" />
          </div>
          {/* Custom controls bar */}
          <div className="bg-card border-t border-border/40 p-2 flex items-center gap-1 flex-wrap">
            <button
              onClick={() => skip(-10)}
              disabled={!isReady}
              className="h-8 w-8 grid place-items-center rounded hover:bg-muted transition disabled:opacity-30"
              title="Voltar 10s"
            >
              <Rewind className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? pause : play}
              disabled={!isReady}
              className="h-8 w-8 grid place-items-center rounded hover:bg-muted transition disabled:opacity-30"
              title={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => skip(10)}
              disabled={!isReady}
              className="h-8 w-8 grid place-items-center rounded hover:bg-muted transition disabled:opacity-30"
              title="Avançar 10s"
            >
              <FastForward className="w-4 h-4" />
            </button>
            <div className="text-xs font-mono tabular-nums px-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-muted-foreground" />
              <select
                value={playbackRate}
                onChange={(e) => setRate(Number(e.target.value))}
                disabled={!isReady}
                className="h-7 text-xs bg-muted/40 border border-border/60 rounded px-1 outline-none"
              >
                {PLAYBACK_RATES.map((r) => (
                  <option key={r} value={r}>{r}x</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tools side */}
        <div className="md:w-2/5 flex-1 flex flex-col bg-muted/10 min-w-0">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-border/40 bg-muted/20 scrollbar-hide">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-shrink-0 h-9 px-3 text-xs flex items-center gap-1.5 transition border-b-2",
                    active
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  style={active ? { color: "var(--accent-color)", borderColor: "var(--accent-color)" } : {}}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {tab === "notes" && <NotesTab video={video} currentTime={currentTime} seekTo={seekTo} />}
            {tab === "summary" && <SummaryTab video={video} />}
            {tab === "bookmarks" && <BookmarksTab video={video} currentTime={currentTime} seekTo={seekTo} />}
            {tab === "canvas" && <CanvasTab video={video} currentTime={currentTime} />}
            {tab === "flashcards" && <FlashcardsTab video={video} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================== NOTES TAB ===================
function NotesTab({
  video,
  currentTime,
  seekTo,
}: {
  video: YouTubeVideo;
  currentTime: number;
  seekTo: (sec: number) => void;
}) {
  const notes = useLiveQuery(async () => {
    return (await getDb().youtubeNotes.where("videoId").equals(video.id).toArray()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [video.id]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  async function addNote(withTimestamp: boolean) {
    const now = new Date().toISOString();
    const note = {
      id: uid("ytn"),
      videoId: video.id,
      timestampSec: withTimestamp ? Math.floor(currentTime) : undefined,
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    await getDb().youtubeNotes.add(note);
    setEditingId(note.id);
    setEditContent("");
    triggerRefresh();
  }

  async function saveNote(id: string) {
    await getDb().youtubeNotes.update(id, {
      content: editContent,
      updatedAt: new Date().toISOString(),
    });
    setEditingId(null);
    triggerRefresh();
  }

  async function deleteNote(id: string) {
    await getDb().youtubeNotes.delete(id);
    triggerRefresh();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border/40 flex gap-1">
        <button
          onClick={() => addNote(true)}
          className="flex-1 h-8 text-xs rounded-md text-white flex items-center justify-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Clock className="w-3 h-3" /> Anotar agora ({formatTime(currentTime)})
        </button>
        <button
          onClick={() => addNote(false)}
          className="h-8 px-3 text-xs rounded-md bg-muted hover:bg-muted/80 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Sem timestamp
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="group p-2.5 rounded-lg bg-card border border-border/40">
            {n.timestampSec !== undefined && (
              <button
                onClick={() => seekTo(n.timestampSec!)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary mb-1.5 hover:bg-primary/20 transition"
                style={{ color: "var(--accent-color)" }}
                title="Pular para este momento"
              >
                ▶ {formatTime(n.timestampSec)}
              </button>
            )}
            {editingId === n.id ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                  rows={4}
                  className="w-full p-2 text-xs rounded bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
                  placeholder="Escreva sua anotação..."
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => saveNote(n.id)}
                    className="flex-1 h-7 text-xs rounded text-white"
                    style={{ background: "var(--accent-color)" }}
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="h-7 px-3 text-xs rounded hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className="text-xs whitespace-pre-wrap cursor-text"
                  onClick={() => { setEditingId(n.id); setEditContent(n.content); }}
                >
                  {n.content || <span className="text-muted-foreground italic">Toque para escrever...</span>}
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="opacity-0 group-hover:opacity-100 mt-1 text-[10px] text-muted-foreground hover:text-destructive"
                >
                  Apagar
                </button>
              </div>
            )}
          </div>
        ))}
        {(!notes || notes.length === 0) && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhuma anotação. Use "Anotar agora" para criar com timestamp do vídeo.
          </div>
        )}
      </div>
    </div>
  );
}

// =================== SUMMARY TAB ===================
function SummaryTab({ video }: { video: YouTubeVideo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);
  const settings = useSettings.getState();

  async function generateSummary() {
    setLoading(true);
    setError("");
    setSummary("");
    try {
      // 1. Fetch transcript
      const trRes = await fetch(`/api/youtube-transcript?videoId=${video.videoId}`);
      const trData = await trRes.json();
      if (!trRes.ok) throw new Error(trData.error || "Erro ao buscar transcrição");
      const transcript = trData.transcript;
      if (!transcript || transcript.length === 0) {
        throw new Error("Vídeo não tem transcrição disponível");
      }
      const fullText = transcript
        .map((t: any) => `[${formatTime(t.start)}] ${t.text}`)
        .join("\n");

      // 2. Truncate if too long (keep under ~25k chars)
      const truncated = fullText.length > 25000
        ? fullText.slice(0, 25000) + "\n[... truncado ...]"
        : fullText;

      // 3. Call AI for summary
      const aiRes = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.aiProvider,
          apiKey: settings.apiKeys[settings.aiProvider],
          model: settings.defaultModel[settings.aiProvider],
          messages: [
            {
              role: "user",
              content: `Resuma este vídeo do YouTube em português brasileiro. Use este formato:

## 📌 Título sugerido
[um título descritivo baseado no conteúdo]

## 🎯 Tópico principal
[1-2 frases sobre o que o vídeo aborda]

## 📋 Pontos-chave
- [ponto 1 com timestamp se relevante]
- [ponto 2]
- [ponto 3]
- [até 8 pontos]

## 💡 Aprendizados principais
- [o que aprender]
- [o que aprender]

## 🔗 Momentos importantes
- [HH:MM:SS] - [descrição do momento]
- [HH:MM:SS] - [descrição do momento]

## ❓ Perguntas pra refletir
- [pergunta 1]
- [pergunta 2]

Transcrição do vídeo (com timestamps):

${truncated}`,
            },
          ],
        }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error || "Erro ao gerar resumo");
      setSummary(aiData.content);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAsNote() {
    if (!summary) return;
    const now = new Date().toISOString();
    await getDb().youtubeNotes.add({
      id: uid("ytn"),
      videoId: video.id,
      timestampSec: undefined,
      content: `## Resumo IA\n\n${summary}`,
      createdAt: now,
      updatedAt: now,
    });
    useSystemBus.getState().notify({ app: "youtube", title: "Resumo salvo como anotação" });
    useSystemBus.getState().triggerRefresh();
  }

  function copy() {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border/40">
        <button
          onClick={generateSummary}
          disabled={loading}
          className="w-full h-9 text-sm rounded-md text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "var(--accent-color)" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Gerando..." : summary ? "Regenerar resumo" : "Gerar resumo com IA"}
        </button>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          A IA busca a transcrição do vídeo e resume em tópicos, momentos importantes e perguntas pra refletir.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div className="text-xs text-destructive p-2 rounded bg-destructive/10 mb-2">{error}</div>
        )}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 rounded bg-muted animate-pulse" style={{ width: `${80 - i * 5}%` }} />
            ))}
          </div>
        )}
        {summary && !loading && (
          <>
            <div className="text-xs whitespace-pre-wrap leading-relaxed">{summary}</div>
            <div className="flex gap-1 mt-3 sticky bottom-0 bg-background/80 backdrop-blur p-2 -mx-3 -mb-3 border-t border-border/40">
              <button
                onClick={copy}
                className="flex-1 h-8 text-xs rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={saveAsNote}
                className="flex-1 h-8 text-xs rounded-md text-white flex items-center justify-center gap-1"
                style={{ background: "var(--accent-color)" }}
              >
                Salvar como anotação
              </button>
            </div>
          </>
        )}
        {!summary && !loading && !error && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Toque em "Gerar resumo" para criar um resumo inteligente do vídeo.
          </div>
        )}
      </div>
    </div>
  );
}

// =================== BOOKMARKS TAB ===================
function BookmarksTab({
  video,
  currentTime,
  seekTo,
}: {
  video: YouTubeVideo;
  currentTime: number;
  seekTo: (sec: number) => void;
}) {
  const bookmarks = useLiveQuery(async () => {
    return (await getDb().youtubeBookmarks.where("videoId").equals(video.id).toArray()).sort(
      (a, b) => a.timestampSec - b.timestampSec,
    );
  }, [video.id]);
  const [label, setLabel] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  async function addBookmark() {
    if (!label.trim()) return;
    await getDb().youtubeBookmarks.add({
      id: uid("ytb"),
      videoId: video.id,
      timestampSec: Math.floor(currentTime),
      label: label.trim(),
      createdAt: new Date().toISOString(),
    });
    setLabel("");
    triggerRefresh();
  }

  async function deleteBookmark(id: string) {
    await getDb().youtubeBookmarks.delete(id);
    triggerRefresh();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border/40 space-y-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBookmark()}
          placeholder="Descrição do momento..."
          className="w-full h-8 px-2 text-xs rounded bg-muted/40 border border-border/60 outline-none focus:border-primary"
        />
        <button
          onClick={addBookmark}
          disabled={!label.trim()}
          className="w-full h-8 text-xs rounded-md text-white disabled:opacity-50 flex items-center justify-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Bookmark className="w-3 h-3" /> Marcar em {formatTime(currentTime)}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {(bookmarks ?? []).map((b) => (
          <div
            key={b.id}
            className="group flex items-center gap-2 p-2 rounded-lg bg-card border border-border/40 hover:border-border transition"
          >
            <button
              onClick={() => seekTo(b.timestampSec)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition"
              style={{ color: "var(--accent-color)" }}
              title="Pular para este momento"
            >
              ▶ {formatTime(b.timestampSec)}
            </button>
            <span className="text-xs flex-1 truncate">{b.label}</span>
            <button
              onClick={() => deleteBookmark(b.id)}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {(!bookmarks || bookmarks.length === 0) && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhum bookmark. Marque momentos importantes do vídeo.
          </div>
        )}
      </div>
    </div>
  );
}

// =================== CANVAS TAB ===================
const CANVAS_COLORS = ["#000000", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#FFFFFF"];
const CANVAS_SIZES = [2, 4, 8, 16];

function CanvasTab({ video, currentTime }: { video: YouTubeVideo; currentTime: number }) {
  const canvases = useLiveQuery(async () => {
    return (await getDb().youtubeCanvases.where("videoId").equals(video.id).toArray()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [video.id]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [color, setColor] = useState(CANVAS_COLORS[0]);
  const [size, setSize] = useState(CANVAS_SIZES[1]);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [strokes, setStrokes] = useState<any[]>([]);
  const [drawing, setDrawing] = useState(false);
  const currentStrokeRef = useRef<any>(null);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const activeCanvas = (canvases ?? []).find((c) => c.id === activeId);

  useEffect(() => {
    if (activeCanvas) {
      setStrokes(activeCanvas.strokes);
    } else {
      setStrokes([]);
    }
  }, [activeId]);

  // Redraw on strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      s.points.forEach((p: [number, number], i: number) => {
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.stroke();
    }
  }, [strokes]);

  async function createCanvas() {
    const now = new Date().toISOString();
    const c = {
      id: uid("ytc"),
      videoId: video.id,
      title: `Quadro ${(canvases ?? []).length + 1}`,
      timestampSec: Math.floor(currentTime),
      strokes: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().youtubeCanvases.add(c);
    setActiveId(c.id);
    triggerRefresh();
  }

  async function saveCanvas() {
    if (!activeId) return;
    await getDb().youtubeCanvases.update(activeId, {
      strokes,
      updatedAt: new Date().toISOString(),
    });
    useSystemBus.getState().notify({ app: "youtube", title: "Quadro salvo" });
    triggerRefresh();
  }

  async function deleteCanvas(id: string) {
    if (!confirm("Apagar este quadro?")) return;
    await getDb().youtubeCanvases.delete(id);
    if (activeId === id) setActiveId(null);
    triggerRefresh();
  }

  function clearCanvas() {
    setStrokes([]);
  }

  function getPos(e: React.PointerEvent): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!activeId) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrawing(true);
    const pos = getPos(e);
    currentStrokeRef.current = {
      color: tool === "eraser" ? "#ffffff" : color,
      size: tool === "eraser" ? Math.max(size * 3, 12) : size,
      points: [pos],
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drawing || !currentStrokeRef.current) return;
    const pos = getPos(e);
    currentStrokeRef.current.points.push(pos);
    setStrokes((s) => [...s.slice(0, -1), { ...currentStrokeRef.current }]);
  }
  function onPointerUp() {
    if (currentStrokeRef.current && activeId) {
      setStrokes((s) => [...s, currentStrokeRef.current]);
    }
    currentStrokeRef.current = null;
    setDrawing(false);
    if (activeId) saveCanvas();
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-2 border-b border-border/40 space-y-2">
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setTool("brush")}
            className={cn("h-7 w-7 grid place-items-center rounded transition", tool === "brush" ? "bg-primary/20 text-primary" : "hover:bg-muted")}
            style={tool === "brush" ? { color: "var(--accent-color)" } : {}}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={cn("h-7 w-7 grid place-items-center rounded transition", tool === "eraser" ? "bg-primary/20 text-primary" : "hover:bg-muted")}
            style={tool === "eraser" ? { color: "var(--accent-color)" } : {}}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-0.5 ml-1">
            {CANVAS_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool("brush"); }}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition",
                  color === c && tool === "brush" ? "border-foreground scale-110" : "border-border",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex-1" />
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-7 text-xs bg-muted/40 border border-border/60 rounded px-1 outline-none"
          >
            {CANVAS_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
          <button
            onClick={clearCanvas}
            disabled={!activeId}
            className="h-7 w-7 grid place-items-center rounded hover:bg-muted transition disabled:opacity-30"
            title="Limpar"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Canvas selector */}
        <div className="flex items-center gap-1">
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value || null)}
            className="flex-1 h-7 text-xs bg-muted/40 border border-border/60 rounded px-1 outline-none"
          >
            <option value="">(novo quadro)</option>
            {(canvases ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} {c.timestampSec !== undefined ? `· ${formatTime(c.timestampSec)}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={createCanvas}
            className="h-7 px-2 text-xs rounded text-white flex items-center gap-1"
            style={{ background: "var(--accent-color)" }}
          >
            <Plus className="w-3 h-3" /> Novo
          </button>
          {activeId && (
            <button
              onClick={() => deleteCanvas(activeId)}
              className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {/* Canvas */}
      <div className="flex-1 p-2 bg-muted/20">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="w-full h-full bg-white rounded-md cursor-crosshair touch-none"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
}

// =================== FLASHCARDS TAB ===================
function FlashcardsTab({ video }: { video: YouTubeVideo }) {
  const flashcards = useLiveQuery(async () => {
    return (await getDb().youtubeFlashcards.where("videoId").equals(video.id).toArray()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [video.id]);
  const [showCreate, setShowCreate] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  async function createCard() {
    if (!front.trim() || !back.trim()) return;
    await getDb().youtubeFlashcards.add({
      id: uid("ytf"),
      videoId: video.id,
      front: front.trim(),
      back: back.trim(),
      correctCount: 0,
      incorrectCount: 0,
      createdAt: new Date().toISOString(),
    });
    setFront("");
    setBack("");
    setShowCreate(false);
    triggerRefresh();
  }

  async function deleteCard(id: string) {
    await getDb().youtubeFlashcards.delete(id);
    triggerRefresh();
  }

  async function review(result: "correct" | "incorrect") {
    const card = (flashcards ?? [])[reviewIdx];
    if (!card) return;
    await getDb().youtubeFlashcards.update(card.id, {
      lastReviewedAt: new Date().toISOString(),
      correctCount: card.correctCount + (result === "correct" ? 1 : 0),
      incorrectCount: card.incorrectCount + (result === "incorrect" ? 1 : 0),
    });
    setShowAnswer(false);
    if (reviewIdx + 1 >= (flashcards ?? []).length) {
      setReviewing(false);
      setReviewIdx(0);
    } else {
      setReviewIdx(reviewIdx + 1);
    }
    triggerRefresh();
  }

  if (reviewing && flashcards && flashcards.length > 0) {
    const card = flashcards[reviewIdx];
    return (
      <div className="h-full flex flex-col p-3">
        <div className="text-xs text-muted-foreground mb-2 text-center">
          Card {reviewIdx + 1} de {flashcards.length}
        </div>
        <div
          onClick={() => setShowAnswer(!showAnswer)}
          className="flex-1 grid place-items-center p-4 rounded-lg bg-card border border-border/60 cursor-pointer hover:border-primary transition"
        >
          <div className="text-center">
            <div className="text-[10px] uppercase text-muted-foreground mb-2">
              {showAnswer ? "Resposta" : "Pergunta"}
            </div>
            <div className="text-sm whitespace-pre-wrap">{showAnswer ? card.back : card.front}</div>
            {!showAnswer && (
              <div className="text-[10px] text-muted-foreground mt-3">Toque para ver resposta</div>
            )}
          </div>
        </div>
        {showAnswer && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => review("incorrect")}
              className="flex-1 h-10 text-sm rounded-md bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20"
            >
              Errei
            </button>
            <button
              onClick={() => review("correct")}
              className="flex-1 h-10 text-sm rounded-md bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20"
            >
              Acertei
            </button>
          </div>
        )}
        <button
          onClick={() => { setReviewing(false); setShowAnswer(false); setReviewIdx(0); }}
          className="mt-2 h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          Sair da revisão
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border/40 flex gap-1">
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 h-8 text-xs rounded-md text-white flex items-center justify-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3 h-3" /> Novo card
        </button>
        {flashcards && flashcards.length > 0 && (
          <button
            onClick={() => { setReviewing(true); setReviewIdx(0); setShowAnswer(false); }}
            className="h-8 px-3 text-xs rounded-md bg-muted hover:bg-muted/80 flex items-center gap-1"
          >
            <Layers className="w-3 h-3" /> Revisar ({flashcards.length})
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {(flashcards ?? []).map((c) => (
          <div key={c.id} className="group p-2.5 rounded-lg bg-card border border-border/40">
            <div className="text-xs font-medium mb-1">{c.front}</div>
            <div className="text-[11px] text-muted-foreground italic">{c.back}</div>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
              <span className="text-green-600">✓ {c.correctCount}</span>
              <span className="text-red-600">✗ {c.incorrectCount}</span>
              {c.lastReviewedAt && (
                <span>· revisado {new Date(c.lastReviewedAt).toLocaleDateString("pt-BR")}</span>
              )}
              <div className="flex-1" />
              <button
                onClick={() => deleteCard(c.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {(!flashcards || flashcards.length === 0) && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhum flashcard. Crie perguntas e respostas para revisão ativa.
          </div>
        )}
      </div>
      {showCreate && (
        <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Novo flashcard</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Pergunta (frente)</label>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full p-2 text-sm rounded bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Resposta (verso)</label>
                <textarea
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  rows={2}
                  className="w-full p-2 text-sm rounded bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
                />
              </div>
              <button
                onClick={createCard}
                disabled={!front.trim() || !back.trim()}
                className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
                style={{ background: "var(--accent-color)" }}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
