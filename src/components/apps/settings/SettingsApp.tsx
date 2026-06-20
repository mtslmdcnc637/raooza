"use client";

import { useState } from "react";
import {
  useSettings,
  WALLPAPERS,
  ACCENTS,
  type AIProvider,
} from "@/stores/settingsStore";
import { PROVIDERS } from "@/lib/ai/providers";
import { Palette, ImageIcon, Bot, Sun, Moon, Check, ExternalLink, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "appearance" | "wallpaper" | "ai";

export function SettingsApp() {
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-52 border-r border-border/40 bg-muted/20 p-3">
        <div className="text-xs uppercase font-semibold text-muted-foreground mb-2 px-2">Configurações</div>
        <nav className="space-y-1">
          <button
            onClick={() => setTab("appearance")}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition",
              tab === "appearance" ? "bg-muted/80 font-medium" : "hover:bg-muted/40",
            )}
          >
            <Palette className="w-4 h-4" /> Aparência
          </button>
          <button
            onClick={() => setTab("wallpaper")}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition",
              tab === "wallpaper" ? "bg-muted/80 font-medium" : "hover:bg-muted/40",
            )}
          >
            <ImageIcon className="w-4 h-4" /> Wallpaper
          </button>
          <button
            onClick={() => setTab("ai")}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition",
              tab === "ai" ? "bg-muted/80 font-medium" : "hover:bg-muted/40",
            )}
          >
            <Bot className="w-4 h-4" /> IA
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "appearance" && <AppearanceTab />}
        {tab === "wallpaper" && <WallpaperTab />}
        {tab === "ai" && <AiTab />}
      </div>
    </div>
  );
}

function AppearanceTab() {
  const mode = useSettings((s) => s.mode);
  const setMode = useSettings((s) => s.setMode);
  const accent = useSettings((s) => s.accent);
  const setAccent = useSettings((s) => s.setAccent);

  return (
    <div className="max-w-xl space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Tema</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("light")}
            className={cn(
              "p-4 rounded-xl border-2 transition flex flex-col items-center gap-2",
              mode === "light" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <Sun className="w-6 h-6" />
            <span className="text-sm font-medium">Claro</span>
          </button>
          <button
            onClick={() => setMode("dark")}
            className={cn(
              "p-4 rounded-xl border-2 transition flex flex-col items-center gap-2",
              mode === "dark" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
            )}
          >
            <Moon className="w-6 h-6" />
            <span className="text-sm font-medium">Escuro</span>
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Cor de acento</h3>
        <div className="grid grid-cols-6 gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.value)}
              className={cn(
                "h-12 rounded-lg flex items-center justify-center transition border-2",
                accent === a.value ? "border-foreground scale-105" : "border-transparent hover:scale-105",
              )}
              style={{ background: a.value }}
              title={a.name}
            >
              {accent === a.value && <Check className="w-5 h-5 text-white" />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function WallpaperTab() {
  const wallpaperId = useSettings((s) => s.wallpaperId);
  const setWallpaper = useSettings((s) => s.setWallpaper);
  const customWallpaper = useSettings((s) => s.customWallpaper);
  const setCustomWallpaper = useSettings((s) => s.setCustomWallpaper);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomWallpaper(reader.result as string);
      setWallpaper("custom");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Wallpapers</h3>
        <div className="grid grid-cols-3 gap-3">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                setWallpaper(w.id);
                setCustomWallpaper(undefined);
              }}
              className={cn(
                "aspect-video rounded-lg overflow-hidden border-2 transition relative",
                wallpaperId === w.id && !customWallpaper ? "border-primary scale-[1.02]" : "border-border hover:border-foreground/30",
              )}
              style={{ background: w.css }}
            >
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/40 text-white text-[10px] font-medium">
                {w.name}
              </div>
              {wallpaperId === w.id && !customWallpaper && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary grid place-items-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Wallpaper personalizado</h3>
        <label className="block">
          <div className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40 transition">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm font-medium">Enviar imagem</div>
            <div className="text-xs text-muted-foreground mt-1">
              {customWallpaper ? "Substituir imagem atual" : "PNG, JPG até ~5MB"}
            </div>
          </div>
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </label>
        {customWallpaper && (
          <div className="mt-3 flex items-center gap-3">
            <img src={customWallpaper} alt="" className="w-20 h-12 object-cover rounded border border-border" />
            <button
              onClick={() => setCustomWallpaper(undefined)}
              className="text-xs text-destructive hover:underline"
            >
              Remover
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AiTab() {
  const aiProvider = useSettings((s) => s.aiProvider);
  const setAiProvider = useSettings((s) => s.setAiProvider);
  const apiKeys = useSettings((s) => s.apiKeys);
  const setApiKey = useSettings((s) => s.setApiKey);
  const defaultModel = useSettings((s) => s.defaultModel);
  const setDefaultModel = useSettings((s) => s.setDefaultModel);

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">Provedor de IA</h3>
        <div className="space-y-2">
          {(Object.keys(PROVIDERS) as AIProvider[]).map((id) => {
            const p = PROVIDERS[id];
            return (
              <button
                key={id}
                onClick={() => setAiProvider(id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition flex items-start gap-3",
                  aiProvider === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <div className="w-10 h-10 rounded-lg grid place-items-center text-white text-xs font-bold" style={{ background: "var(--accent-color)" }}>
                  {p.name[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.description}</div>
                </div>
                {aiProvider === id && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          API Key — {PROVIDERS[aiProvider].name}
        </h3>
        {aiProvider === "glm" && (
          <div className="text-xs text-muted-foreground mb-2 p-2 rounded bg-muted/40">
            💡 Para GLM, você pode usar a chave padrão do ambiente (deixe vazio) ou fornecer sua própria API key da Z.ai.
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={apiKeys[aiProvider]}
            onChange={(e) => setApiKey(aiProvider, e.target.value)}
            placeholder={aiProvider === "glm" ? "(opcional) zai-..." : "sk-..."}
            className="flex-1 h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <a
            href={PROVIDERS[aiProvider].apiKeyUrl}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 grid place-items-center rounded-md hover:bg-muted text-xs flex-shrink-0"
            title="Obter API key"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">Modelo</h3>
        <select
          value={defaultModel[aiProvider]}
          onChange={(e) => setDefaultModel(aiProvider, e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
        >
          {PROVIDERS[aiProvider].models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>
    </div>
  );
}
