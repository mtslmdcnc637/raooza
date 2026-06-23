"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/stores/settingsStore";
import { IntelApp } from "@/components/apps/intel/IntelApp";
import { Radar, Loader2, X } from "lucide-react";

interface Props {
  onDismiss: () => void;
}

const STAGES = [
  "Inicializando radar...",
  "🔎 Buscando notícias em fontes globais...",
  "📰 Coletando matérias de portais de IA...",
  "🧠 Agrupando novidades em temas...",
  "🎬 Procurando vídeos em português no YouTube...",
  "✨ Finalizando...",
];

export function IntelBootOverlay({ onDismiss }: Props) {
  const [stage, setStage] = useState(0);
  const [showApp, setShowApp] = useState(false);
  const accent = useSettings((s) => s.accent);

  // Cycle through stages while loading
  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleReady() {
    setShowApp(true);
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-background grid place-items-center">
      {/* Dismiss button (top-right) */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full hover:bg-muted transition text-muted-foreground"
        title="Pular"
      >
        <X className="w-5 h-5" />
      </button>

      {!showApp ? (
        <div className="text-center max-w-md px-6">
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-6 grid place-items-center text-white shadow-2xl"
            style={{ background: accent }}
          >
            <Radar className="w-10 h-10 animate-pulse" />
          </div>

          <h1 className="text-2xl font-light tracking-wide mb-2">AI Radar</h1>
          <p className="text-xs text-muted-foreground mb-8">
            Vasculhando a internet por novidades em IA
          </p>

          {/* Progress */}
          <div className="space-y-2 mb-8">
            {STAGES.map((label, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs transition ${
                  i < stage ? "text-muted-foreground" : i === stage ? "text-foreground font-medium" : "text-muted-foreground/40"
                }`}
              >
                {i < stage ? (
                  <div className="w-3 h-3 rounded-full bg-green-500 grid place-items-center text-[8px] text-white">✓</div>
                ) : i === stage ? (
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: accent }} />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                )}
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Hidden IntelApp that fetches in background and calls onReady when done */}
          <div className="hidden">
            <IntelAppAutoFetch onReady={handleReady} />
          </div>

          <button
            onClick={onDismiss}
            className="text-[10px] text-muted-foreground hover:text-foreground transition"
          >
            Pular e ir para o desktop →
          </button>
        </div>
      ) : (
        <div className="w-full h-full">
          <IntelApp />
          <button
            onClick={onDismiss}
            className="fixed top-4 right-4 z-10 h-10 px-4 rounded-md bg-card border border-border hover:bg-muted transition text-xs font-medium flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Ir para o desktop
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper that auto-fetches intel and signals readiness
function IntelAppAutoFetch({ onReady }: { onReady: () => void }) {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (triggered) return;

    // Wait for settings to be hydrated from localStorage before reading
    const settings = useSettings.getState();
    if (!settings.apiKeys) {
      // Settings not hydrated yet — retry in 500ms
      const t = setTimeout(() => setTriggered(false), 500);
      return () => clearTimeout(t);
    }

    setTriggered(true);
    async function fetchIntel() {
      const s = useSettings.getState();
      const provider = s.aiProvider;
      const apiKey = s.apiKeys[provider] || "";

      // Skip if no valid configuration
      if (provider !== "glm" && !apiKey) {
        onReady();
        return;
      }

      try {
        const res = await fetch("/api/intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey,
            model: s.defaultModel[provider],
            forceRefresh: false,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          s.setLastIntelAt(data.fetchedAt);
        }
      } catch (e) {
        // ignore — user can retry from app
      } finally {
        onReady();
      }
    }
    fetchIntel();
  }, [triggered, onReady]);

  return null;
}
