"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/stores/settingsStore";

export function BootScreen() {
  const setBooted = useSettings((s) => s.setBooted);
  const accent = useSettings((s) => s.accent);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          setTimeout(() => setBooted(true), 300);
          return 100;
        }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(t);
  }, [setBooted]);

  return (
    <div className="fixed inset-0 grid place-items-center bg-black z-[10000]">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-20 h-20 rounded-3xl grid place-items-center text-white text-4xl font-bold shadow-2xl animate-pulse"
            style={{ background: accent }}
          >
            R
          </div>
          <h1 className="text-white text-3xl font-light tracking-wide">Raooza</h1>
        </div>
        <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full transition-all duration-100 rounded-full"
            style={{ width: `${progress}%`, background: accent }}
          />
        </div>
      </div>
    </div>
  );
}
