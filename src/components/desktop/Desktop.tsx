"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSettings, WALLPAPERS } from "@/stores/settingsStore";
import { useWindowStore } from "@/stores/windowStore";
import { Window } from "./Window";
import { Taskbar } from "./Taskbar";
import { StickyNotesLayer } from "./StickyNotesLayer";
import { useSystemBus } from "@/stores/systemBus";
import { APP_REGISTRY } from "@/components/apps/registry";

export function Desktop() {
  const wallpaperId = useSettings((s) => s.wallpaperId);
  const customWallpaper = useSettings((s) => s.customWallpaper);
  const accent = useSettings((s) => s.accent);
  const windows = useWindowStore((s) => s.windows);
  const refreshTick = useSystemBus((s) => s.refreshTick);
  void refreshTick;

  const wp = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];
  const bg = customWallpaper ? `url(${customWallpaper}) center/cover` : wp.css;

  // Inject accent CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accent);
    // Also set --primary to accent for shadcn components
    document.documentElement.style.setProperty("--primary", accent);
  }, [accent]);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: bg }}
    >
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

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}
