"use client";

import { useEffect, useState } from "react";
import {
  useSettings,
  WALLPAPERS,
  ACCENTS,
  type AIProvider,
} from "@/stores/settingsStore";
import { PROVIDERS, apiUrl } from "@/lib/ai/providers";
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

  const [showTutorial, setShowTutorial] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");

  async function loadOpenRouterModels() {
    setLoadingModels(true);
    setModelsError("");
    try {
      // If using backend, fetch from backend's /models/:provider endpoint (proxied, with API key if available)
      // Otherwise fetch directly from OpenRouter's public /models endpoint
      const url = USE_BACKEND
        ? apiUrl("/models/openrouter")
        : "https://openrouter.ai/api/v1/models";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Backend returns { models: string[] }, OpenRouter returns { data: [{id}, ...] }
      const modelIds: string[] = USE_BACKEND
        ? (data.models ?? [])
        : (data.data ?? []).map((m: any) => m.id);
      modelIds.sort();
      setDynamicModels(modelIds);
    } catch (e: any) {
      setModelsError(e?.message ?? "Erro ao carregar modelos");
    } finally {
      setLoadingModels(false);
    }
  }

  // Auto-load OpenRouter models when provider is selected and key is set
  useEffect(() => {
    if (aiProvider === "openrouter" && dynamicModels.length === 0 && !loadingModels) {
      loadOpenRouterModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProvider]);

  // Available models: dynamic list (if loaded) + fallback to static list
  const availableModels = aiProvider === "openrouter" && dynamicModels.length > 0
    ? dynamicModels
    : PROVIDERS[aiProvider].models;

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

      {/* OpenRouter tutorial */}
      {aiProvider === "openrouter" && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <button
            onClick={() => setShowTutorial((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">📖 Como conseguir uma chave OpenRouter (grátis)</span>
            </div>
            <span className="text-xs text-muted-foreground">{showTutorial ? "ocultar" : "ver passo a passo"}</span>
          </button>
          {showTutorial && (
            <div className="mt-3 space-y-3 text-xs">
              <div className="p-3 rounded-md bg-background/60 border border-border/40">
                <div className="font-semibold mb-1">Passo 1 — Criar conta</div>
                <p>Acesse <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primary underline">openrouter.ai</a> e clique em "Sign in". Você pode usar Google ou GitHub — leva 30 segundos.</p>
              </div>
              <div className="p-3 rounded-md bg-background/60 border border-border/40">
                <div className="font-semibold mb-1">Passo 2 — Ir para chaves de API</div>
                <p>No painel, clique em "Keys" no menu lateral (ou acesse <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary underline">openrouter.ai/keys</a>).</p>
              </div>
              <div className="p-3 rounded-md bg-background/60 border border-border/40">
                <div className="font-semibold mb-1">Passo 3 — Criar chave</div>
                <p>Clique em "Create Key". Dê um nome (ex: <code className="font-mono bg-muted px-1 rounded">raooza</code>), clique em Create.</p>
                <p className="mt-1 text-amber-600">⚠️ A chave aparece <strong>uma única vez</strong>. Copie imediatamente — não dá pra ver de novo.</p>
              </div>
              <div className="p-3 rounded-md bg-background/60 border border-border/40">
                <div className="font-semibold mb-1">Passo 4 — Colar aqui</div>
                <p>Cole a chave no campo abaixo. Ela fica salva apenas no seu navegador (localStorage), nunca é enviada para servidor.</p>
              </div>
              <div className="p-3 rounded-md bg-background/60 border border-border/40">
                <div className="font-semibold mb-1">Passo 5 — (Opcional) Adicionar crédito</div>
                <p>O OpenRouter tem modelos gratuitos (ex: <code className="font-mono bg-muted px-1 rounded">meta-llama/llama-3.3-70b-instruct:free</code>) que você pode usar sem pagar. Para modelos pagos (Claude, GPT-4), adicione crédito em "Credits".</p>
              </div>
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
                <div className="font-semibold mb-1">💡 Dica</div>
                <p>A chave fica salva apenas no seu navegador. Você pode usar a mesma chave em quantos dispositivos quiser.</p>
              </div>
            </div>
          )}
        </section>
      )}

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
        {aiProvider === "openrouter" && !apiKeys.openrouter && (
          <div className="text-xs text-amber-600 mb-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
            ⚠️ Sem chave, alguns modelos gratuitos ainda funcionam, mas a maioria requer autenticação.
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={apiKeys[aiProvider]}
            onChange={(e) => setApiKey(aiProvider, e.target.value)}
            placeholder={aiProvider === "glm" ? "(opcional) zai-..." : aiProvider === "openrouter" ? "sk-or-v1-..." : "sk-..."}
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Modelo</h3>
          {aiProvider === "openrouter" && (
            <button
              onClick={loadOpenRouterModels}
              disabled={loadingModels}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {loadingModels ? "Carregando..." : dynamicModels.length > 0 ? `↻ Atualizar (${dynamicModels.length} modelos)` : "↻ Carregar lista dinâmica"}
            </button>
          )}
        </div>
        {modelsError && (
          <div className="text-xs text-destructive mb-2">{modelsError}</div>
        )}
        <select
          value={defaultModel[aiProvider]}
          onChange={(e) => setDefaultModel(aiProvider, e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {aiProvider === "openrouter" && dynamicModels.length > 0 && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            ✓ Lista de modelos carregada dinamicamente da API do OpenRouter ({dynamicModels.length} modelos). Você também pode digitar o ID manualmente abaixo se quiser um que não está na lista.
          </div>
        )}
        {aiProvider === "openrouter" && (
          <input
            type="text"
            value={defaultModel.openrouter}
            onChange={(e) => setDefaultModel("openrouter", e.target.value)}
            placeholder="ou digite um ID de modelo manualmente (ex: anthropic/claude-3.5-sonnet)"
            className="mt-2 w-full h-9 px-3 text-xs font-mono rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
        )}
      </section>

      {/* Privacy note */}
      <section className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground mb-1">🔒 Privacidade</div>
        <p>Sua API key é armazenada apenas no seu navegador (localStorage) e enviada diretamente para o provedor escolhido. Ela nunca passa por servidores do Raooza.</p>
      </section>
    </div>
  );
}
