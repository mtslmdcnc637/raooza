"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSettings, WALLPAPERS } from "@/stores/settingsStore";
import { useWindowStore } from "@/stores/windowStore";
import { Window } from "./Window";
import { Taskbar } from "./Taskbar";
import { StickyNotesLayer } from "./StickyNotesLayer";
import { DashboardWidget } from "./dashboard/DashboardWidget";
import { FocusMode } from "./focusmode/FocusMode";
import { CommandPalette } from "./commandpalette/CommandPalette";
import { useSystemBus } from "@/stores/systemBus";
import { useSnippetsExpansion } from "@/lib/snippets/useSnippetsExpansion";
import { APP_REGISTRY } from "@/components/apps/registry";

export function Desktop() {
  const wallpaperId = useSettings((s) => s.wallpaperId);
  const customWallpaper = useSettings((s) => s.customWallpaper);
  const accent = useSettings((s) => s.accent);
  const windows = useWindowStore((s) => s.windows);
  const open = useWindowStore((s) => s.open);
  const refreshTick = useSystemBus((s) => s.refreshTick);
  const paletteOpen = useSystemBus((s) => s.paletteOpen);
  const setPaletteOpen = useSystemBus((s) => s.setPaletteOpen);
  const [dragOver, setDragOver] = useState(false);
  void refreshTick;

  // Activate snippet expansion globally
  useSnippetsExpansion();

  const wp = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];
  const bg = customWallpaper ? `url(${customWallpaper}) center/cover` : wp.css;

  // Inject accent CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accent);
    document.documentElement.style.setProperty("--primary", accent);
  }, [accent]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K → toggle command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useSystemBus.getState().paletteOpen);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPaletteOpen]);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".md")) return;
    const content = await file.text();
    open({
      appId: "importer",
      title: "Importar MD",
      icon: null,
      width: 720,
      height: 680,
      payload: { fileName: file.name, content },
    });
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: bg }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[9400] pointer-events-none grid place-items-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary/60 m-4 rounded-2xl">
          <div className="text-center">
            <div className="text-4xl mb-2">📄</div>
            <div className="text-lg font-semibold">Solte o arquivo .md aqui</div>
            <div className="text-sm text-muted-foreground mt-1">A IA vai configurar o ambiente para o projeto</div>
          </div>
        </div>
      )}

      {/* Command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Dashboard widget (above wallpaper, behind windows) */}
      <DashboardWidget />

      {/* Sticky notes layer (behind windows) */}
      <StickyNotesLayer />

      {/* Windows */}
      {windows.map((win) => {
        const manifest = APP_REGISTRY[win.appId];
        if (!manifest) return null;
        const AppComp = manifest.component;
        return (
          <Window key={win.id} win={win}>
            <AppComp win={win} />
          </Window>
        );
      })}

      {/* Focus mode overlay */}
      <FocusMode />

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}
