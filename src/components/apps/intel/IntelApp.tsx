"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/stores/settingsStore";
import { useWindowStore } from "@/stores/windowStore";
import { apiUrl } from "@/lib/ai/providers";
import {
  Radar,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Play,
  Youtube,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IntelSource {
  title: string;
  url: string;
  source: string;
}

interface IntelVideo {
  videoId: string;
  title: string;
  url: string;
  thumbnail: string;
  source: string;
}

interface IntelTheme {
  title: string;
  summary: string;
  keywords: string[];
  importance: "alta" | "media" | "baixa";
  sources: IntelSource[];
  videos: IntelVideo[];
}

interface IntelResult {
  themes: IntelTheme[];
  totalSources: number;
  fetchedAt: string;
  cached?: boolean;
}

export function IntelApp({ autoFetch = false }: { autoFetch?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<IntelResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const setLastIntelAt = useSettings((s) => s.setLastIntelAt);
  // Subscribe to provider + apiKey changes so we always use current values
  const aiProvider = useSettings((s) => s.aiProvider);
  const apiKey = useSettings((s) => s.apiKeys[s.aiProvider]);
  const defaultModel = useSettings((s) => s.defaultModel[s.aiProvider]);

  useEffect(() => {
    if (autoFetch) fetchIntel();
  }, [autoFetch]);

  async function fetchIntel(force = false) {
    setLoading(true);
    setError("");
    try {
      // Read fresh state at call time
      const s = useSettings.getState();
      const provider = s.aiProvider;
      const key = s.apiKeys[provider] || "";

      // Pre-check: if no API key for non-GLM provider, show clear error
      if (provider !== "glm" && !key) {
        setError(`Configure sua API key do ${provider === "openrouter" ? "OpenRouter" : "DeepSeek"} em Configurações > IA para usar o AI Radar.`);
        setLoading(false);
        return;
      }

      const res = await fetch(apiUrl("/api/intel"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: key,
          model: s.defaultModel[provider],
          forceRefresh: force,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setLastIntelAt(json.fetchedAt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (selectedIdx !== null && data) {
    const theme = data.themes[selectedIdx];
    if (theme) {
      return <ThemeDetail theme={theme} onBack={() => setSelectedIdx(null)} />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <Radar className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">AI Radar</h2>
          <p className="text-xs text-muted-foreground">
            {data
              ? `${data.themes.length} temas · ${data.totalSources} fontes · ${data.cached ? "cache" : "fresco"} · ${new Date(data.fetchedAt).toLocaleString("pt-BR")}`
              : "Vasculhe a internet por novidades em IA"}
          </p>
        </div>
        <button
          onClick={() => fetchIntel(true)}
          disabled={loading}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1 disabled:opacity-50"
          style={{ background: "var(--accent-color)" }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {loading ? "Buscando..." : "Atualizar"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && !data && (
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" style={{ color: "var(--accent-color)" }} />
              <div className="text-sm font-medium">Vasculhando a internet...</div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div>🔎 Buscando notícias em múltiplas fontes</div>
                <div>🧠 Agrupando em temas com IA</div>
                <div>🎬 Procurando vídeos no YouTube</div>
              </div>
              <div className="text-[10px] text-muted-foreground/70 mt-3">Pode levar 1-3 minutos</div>
            </div>
          </div>
        )}

        {loading && data && (
          <div className="text-center py-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Atualizando...
          </div>
        )}

        {error && !loading && (
          <div className="max-w-md mx-auto mt-8 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <div className="text-sm font-medium mb-1">Erro ao buscar inteligência</div>
            <div className="text-xs text-muted-foreground mb-3">{error}</div>
            <button
              onClick={() => fetchIntel(true)}
              className="h-8 px-4 text-xs rounded-md text-white"
              style={{ background: "var(--accent-color)" }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="h-full grid place-items-center">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
                <Radar className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold mb-1">AI Radar</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Vasculha dezenas de fontes de IA, agrupa as novidades em temas e encontra vídeos em português no YouTube pra cada tema.
              </p>
              <button
                onClick={() => fetchIntel(true)}
                className="h-9 px-4 text-sm rounded-md text-white"
                style={{ background: "var(--accent-color)" }}
              >
                Buscar novidades agora
              </button>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.themes.map((theme, i) => (
              <ThemeCard key={i} theme={theme} index={i} onClick={() => setSelectedIdx(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThemeCard({ theme, index, onClick }: { theme: IntelTheme; index: number; onClick: () => void }) {
  const importanceMeta = {
    alta: { label: "Alta", color: "#EF4444", icon: TrendingUp },
    media: { label: "Média", color: "#F59E0B", icon: Minus },
    baixa: { label: "Baixa", color: "#64748B", icon: TrendingDown },
  };
  const meta = importanceMeta[theme.importance] || importanceMeta.media;
  const Icon = meta.icon;

  return (
    <button
      onClick={onClick}
      className="text-left p-3 rounded-xl bg-card border border-border/40 hover:border-border transition group"
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-md grid place-items-center flex-shrink-0 text-white text-xs font-bold"
          style={{ background: meta.color }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">{theme.title}</div>
          <div className="flex items-center gap-1 mt-1">
            <Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
            <span className="text-[10px] font-medium" style={{ color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3 mb-2">{theme.summary}</p>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <ExternalLink className="w-2.5 h-2.5" />
          {theme.sources?.length || 0} matérias
        </span>
        <span className="flex items-center gap-0.5">
          <Youtube className="w-2.5 h-2.5" />
          {theme.videos?.length || 0} vídeos
        </span>
      </div>
      {theme.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-2">
          {theme.keywords.slice(0, 3).map((k) => (
            <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {k}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function ThemeDetail({ theme, onBack }: { theme: IntelTheme; onBack: () => void }) {
  const open = useWindowStore((s) => s.open);
  const [videos, setVideos] = useState<IntelVideo[]>(theme.videos || []);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Lazy-load YouTube videos when theme detail opens
  useEffect(() => {
    if (videos.length > 0) return; // already have videos
    setLoadingVideos(true);
    const keywords = (theme.keywords || []).slice(0, 3).join(" ") || theme.title;
    fetch(apiUrl(`/api/intel/videos?keywords=${encodeURIComponent(keywords)}`))
      .then((r) => r.json())
      .then((data) => {
        if (data.videos) setVideos(data.videos);
      })
      .catch(() => {})
      .finally(() => setLoadingVideos(false));
  }, [theme.title]);

  function openInYouTube(video: IntelVideo) {
    // Open in YouTube Studio app if available
    open({
      appId: "youtube",
      title: "YouTube Studio",
      icon: null,
      width: 1200,
      height: 760,
      payload: { videoId: video.videoId, videoTitle: video.title },
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <button onClick={onBack} className="w-7 h-7 grid place-items-center rounded hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{theme.title}</div>
          <div className="text-[10px] text-muted-foreground">
            {theme.sources?.length || 0} matérias · {videos.length || 0} vídeos
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Summary */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Resumo</div>
          <p className="text-sm leading-relaxed">{theme.summary}</p>
          {theme.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {theme.keywords.map((k) => (
                <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary" style={{ color: "var(--accent-color)" }}>
                  #{k}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Videos */}
        {loadingVideos && (
          <div className="text-center py-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Buscando vídeos no YouTube...
          </div>
        )}
        {videos.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Youtube className="w-3 h-3" /> Vídeos no YouTube
            </div>
            <div className="space-y-2">
              {videos.map((v) => (
                <button
                  key={v.videoId}
                  onClick={() => openInYouTube(v)}
                  className="group w-full flex gap-2 p-2 rounded-lg bg-card border border-border/40 hover:border-border transition text-left"
                >
                  <div className="relative w-32 h-20 rounded overflow-hidden flex-shrink-0 bg-muted">
                    <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 grid place-items-center opacity-0 group-hover:opacity-100 transition">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <div className="text-xs font-medium line-clamp-2">{v.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Play className="w-2 h-2" />
                      Abrir no YouTube Studio
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Articles */}
        {theme.sources?.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Matérias e fontes
            </div>
            <div className="space-y-1.5">
              {theme.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-2.5 rounded-lg bg-card border border-border/40 hover:border-border transition group"
                >
                  <div className="flex items-start gap-2">
                    <ExternalLink className="w-3 h-3 mt-0.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium line-clamp-2">{s.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.source}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {(!theme.sources || theme.sources.length === 0) && videos.length === 0 && !loadingVideos && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Sem conteúdo detalhado para este tema.
          </div>
        )}
      </div>
    </div>
  );
}
