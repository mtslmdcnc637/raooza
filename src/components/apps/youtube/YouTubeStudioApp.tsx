"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type YouTubeVideo } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { Plus, Trash2, X, Play, GraduationCap, Search, Youtube, ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudyView } from "./StudyView";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Extract YouTube video ID from any URL format
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  // Maybe it's just the ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

const STATUS_META: Record<YouTubeVideo["status"], { label: string; color: string }> = {
  "not-started": { label: "Não começado", color: "#94A3B8" },
  "in-progress": { label: "Em andamento", color: "#F59E0B" },
  completed: { label: "Concluído", color: "#10B981" },
};

export function YouTubeStudioApp() {
  const videos = useLiveQuery(async () => {
    return (await getDb().youtubeVideos.toArray()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);

  const selected = (videos ?? []).find((v) => v.id === selectedId);

  async function addVideo(url: string) {
    const videoId = extractVideoId(url);
    if (!videoId) {
      alert("URL inválido. Cole um link do YouTube (youtube.com/watch?v=... ou youtu.be/...)");
      return;
    }
    // Check duplicate
    const existing = await getDb().youtubeVideos.where("videoId").equals(videoId).first();
    if (existing) {
      setSelectedId(existing.id);
      setShowAdd(false);
      return;
    }
    const now = new Date().toISOString();
    const video: YouTubeVideo = {
      id: uid("yt"),
      videoId,
      title: `Vídeo ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      status: "not-started",
      progressSec: 0,
      addedAt: now,
      updatedAt: now,
    };
    await getDb().youtubeVideos.add(video);
    setShowAdd(false);
    triggerRefresh();
    // Auto-open study view
    setSelectedId(video.id);
  }

  async function deleteVideo(id: string) {
    if (!confirm("Remover este vídeo? Todas as anotações, bookmarks e flashcards serão apagados.")) return;
    await getDb().youtubeNotes.where("videoId").equals(id).delete();
    await getDb().youtubeBookmarks.where("videoId").equals(id).delete();
    await getDb().youtubeFlashcards.where("videoId").equals(id).delete();
    await getDb().youtubeCanvases.where("videoId").equals(id).delete();
    await getDb().youtubeVideos.delete(id);
    if (selectedId === id) setSelectedId(null);
    triggerRefresh();
  }

  if (selected) {
    return <StudyView video={selected} onBack={() => setSelectedId(null)} />;
  }

  const filtered = (videos ?? []).filter((v) =>
    v.title.toLowerCase().includes(query.toLowerCase()) ||
    v.videoId.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <GraduationCap className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">YouTube Studio</h2>
          <p className="text-xs text-muted-foreground">{(videos ?? []).length} vídeo(s) · estude com IA</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Vídeo
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border/40">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted/40 border border-border/60">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar vídeos..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((v) => {
            const meta = STATUS_META[v.status];
            const progress = v.durationSec ? (v.progressSec / v.durationSec) * 100 : 0;
            return (
              <div
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className="group rounded-lg bg-card border border-border/40 hover:border-border transition cursor-pointer overflow-hidden"
              >
                <div className="relative aspect-video bg-muted">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Youtube className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition grid place-items-center">
                    <Play className="w-10 h-10 text-white fill-white" />
                  </div>
                  <div
                    className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: meta.color, color: "white" }}
                  >
                    {meta.label}
                  </div>
                  {v.durationSec && (
                    <div className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white font-mono">
                      {formatTime(v.durationSec)}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{v.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Adicionado {new Date(v.addedAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteVideo(v.id); }}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive transition flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {progress > 0 && (
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${progress}%`, background: meta.color }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Youtube className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-1">Nenhum vídeo ainda</p>
              <p className="text-xs text-muted-foreground/70">Adicione um link do YouTube para começar a estudar</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddVideoDialog onAdd={addVideo} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddVideoDialog({ onAdd, onClose }: { onAdd: (url: string) => Promise<void>; onClose: () => void }) {
  const [url, setUrl] = useState("");

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Adicionar vídeo do YouTube</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link do YouTube aqui..."
          autoFocus
          className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
        />
        <div className="text-[10px] text-muted-foreground mt-1.5">
          Formatos aceitos: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
        </div>
        <button
          onClick={() => onAdd(url)}
          disabled={!url.trim()}
          className="w-full mt-3 h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
          style={{ background: "var(--accent-color)" }}
        >
          Adicionar e começar a estudar
        </button>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
