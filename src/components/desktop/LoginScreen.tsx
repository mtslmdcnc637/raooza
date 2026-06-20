"use client";

import { useSettings } from "@/stores/settingsStore";
import { WALLPAPERS } from "@/stores/settingsStore";

interface Props {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
  const accent = useSettings((s) => s.accent);
  const wallpaperId = useSettings((s) => s.wallpaperId);
  const customWallpaper = useSettings((s) => s.customWallpaper);
  const wp = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];

  const bg = customWallpaper ? `url(${customWallpaper}) center/cover` : wp.css;

  const now = new Date();
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="fixed inset-0 grid place-items-center z-[9999] cursor-pointer"
      style={{ background: bg }}
      onClick={onLogin}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xl" />
      <div className="relative flex flex-col items-center gap-6 text-white">
        <div className="text-center">
          <div className="text-7xl font-light tracking-tight tabular-nums">{time}</div>
          <div className="text-lg mt-2 capitalize opacity-90">{date}</div>
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 animate-in fade-in duration-700">
          <div
            className="w-28 h-28 rounded-full grid place-items-center text-white text-5xl font-bold shadow-2xl ring-4 ring-white/20"
            style={{ background: accent }}
          >
            R
          </div>
          <div className="text-2xl font-light mt-2">Bem-vindo</div>
          <div className="text-sm text-white/70">Clique para entrar</div>
        </div>
      </div>
    </div>
  );
}
