// Raooza OS - Settings Store (theme, wallpaper, accent, AI provider, API keys)

import { create } from "zustand";

export type ThemeMode = "light" | "dark";
export type AIProvider = "glm" | "openrouter" | "deepseek";

export interface WallpaperDef {
  id: string;
  name: string;
  // CSS background value
  css: string;
  thumb: string;
}

export const WALLPAPERS: WallpaperDef[] = [
  {
    id: "aurora",
    name: "Aurora",
    css: "radial-gradient(at 20% 20%, #1e3a8a 0px, transparent 50%), radial-gradient(at 80% 0%, #6d28d9 0px, transparent 50%), radial-gradient(at 80% 100%, #db2777 0px, transparent 50%), radial-gradient(at 0% 80%, #0891b2 0px, transparent 50%), #0f172a",
    thumb: "linear-gradient(135deg, #1e3a8a, #6d28d9, #db2777)",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    css: "radial-gradient(at 0% 0%, #fbbf24 0px, transparent 50%), radial-gradient(at 100% 0%, #fb7185 0px, transparent 50%), radial-gradient(at 50% 100%, #c084fc 0px, transparent 50%), #fef3c7",
    thumb: "linear-gradient(135deg, #fbbf24, #fb7185, #c084fc)",
  },
  {
    id: "forest",
    name: "Forest",
    css: "radial-gradient(at 0% 100%, #064e3b 0px, transparent 50%), radial-gradient(at 100% 50%, #047857 0px, transparent 50%), radial-gradient(at 50% 0%, #065f46 0px, transparent 50%), #022c22",
    thumb: "linear-gradient(135deg, #064e3b, #047857, #065f46)",
  },
  {
    id: "mono",
    name: "Mono",
    css: "radial-gradient(at 50% 0%, #475569 0px, transparent 60%), radial-gradient(at 50% 100%, #1e293b 0px, transparent 60%), #0f172a",
    thumb: "linear-gradient(135deg, #475569, #1e293b)",
  },
  {
    id: "light-bloom",
    name: "Bloom",
    css: "radial-gradient(at 20% 30%, #fbcfe8 0px, transparent 50%), radial-gradient(at 80% 70%, #bfdbfe 0px, transparent 50%), radial-gradient(at 50% 50%, #fef9c3 0px, transparent 50%), #ffffff",
    thumb: "linear-gradient(135deg, #fbcfe8, #bfdbfe, #fef9c3)",
  },
  {
    id: "midnight",
    name: "Midnight",
    css: "radial-gradient(at 30% 10%, #312e81 0px, transparent 60%), radial-gradient(at 70% 90%, #1e1b4b 0px, transparent 60%), #0b0b1f",
    thumb: "linear-gradient(135deg, #312e81, #1e1b4b)",
  },
];

export const ACCENTS = [
  { id: "blue", name: "Azure", value: "#0078D4" },
  { id: "violet", name: "Violet", value: "#8B5CF6" },
  { id: "emerald", name: "Emerald", value: "#10B981" },
  { id: "rose", name: "Rose", value: "#F43F5E" },
  { id: "amber", name: "Amber", value: "#F59E0B" },
  { id: "cyan", name: "Cyan", value: "#06B6D4" },
];

interface SettingsStore {
  mode: ThemeMode;
  accent: string; // hex
  wallpaperId: string;
  customWallpaper?: string; // data URL
  aiProvider: AIProvider;
  apiKeys: Record<AIProvider, string>;
  defaultModel: Record<AIProvider, string>;
  booted: boolean;
  showIntelOnBoot: boolean; // show AI Radar after boot
  lastIntelAt?: string; // ISO timestamp of last intel fetch
  // setters
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setAccent: (hex: string) => void;
  setWallpaper: (id: string) => void;
  setCustomWallpaper: (dataUrl?: string) => void;
  setAiProvider: (p: AIProvider) => void;
  setApiKey: (p: AIProvider, key: string) => void;
  setDefaultModel: (p: AIProvider, model: string) => void;
  setBooted: (b: boolean) => void;
  setShowIntelOnBoot: (b: boolean) => void;
  setLastIntelAt: (s: string) => void;
  hydrate: () => void;
}

const LS_KEY = "raooza.settings.v1";

function loadFromStorage(): Partial<SettingsStore> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const useSettings = create<SettingsStore>((set, get) => ({
  mode: "dark",
  accent: "#0078D4",
  wallpaperId: "aurora",
  aiProvider: "glm",
  apiKeys: { glm: "", openrouter: "", deepseek: "" },
  defaultModel: {
    glm: "glm-4.6",
    openrouter: "anthropic/claude-3.5-sonnet",
    deepseek: "deepseek-chat",
  },
  booted: false,
  showIntelOnBoot: false,
  lastIntelAt: undefined,

  setMode: (mode) => {
    set({ mode });
    persist();
  },
  toggleMode: () => {
    const mode = get().mode === "dark" ? "light" : "dark";
    set({ mode });
    persist();
  },
  setAccent: (accent) => {
    set({ accent });
    persist();
  },
  setWallpaper: (wallpaperId) => {
    set({ wallpaperId });
    persist();
  },
  setCustomWallpaper: (customWallpaper) => {
    set({ customWallpaper });
    persist();
  },
  setAiProvider: (aiProvider) => {
    set({ aiProvider });
    persist();
  },
  setApiKey: (p, key) => {
    set({ apiKeys: { ...get().apiKeys, [p]: key } });
    persist();
  },
  setDefaultModel: (p, model) => {
    set({ defaultModel: { ...get().defaultModel, [p]: model } });
    persist();
  },
  setBooted: (booted) => {
    set({ booted });
    persist();
  },
  setShowIntelOnBoot: (showIntelOnBoot) => {
    set({ showIntelOnBoot });
    persist();
  },
  setLastIntelAt: (lastIntelAt) => {
    set({ lastIntelAt });
    persist();
  },

  hydrate: () => {
    const data = loadFromStorage();
    set({ ...data, booted: get().booted });
  },
}));

function persist() {
  if (typeof window === "undefined") return;
  const s = useSettings.getState();
  const slice = {
    mode: s.mode,
    accent: s.accent,
    wallpaperId: s.wallpaperId,
    customWallpaper: s.customWallpaper,
    aiProvider: s.aiProvider,
    apiKeys: s.apiKeys,
    defaultModel: s.defaultModel,
    booted: s.booted,
    showIntelOnBoot: s.showIntelOnBoot,
    lastIntelAt: s.lastIntelAt,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(slice));
}
