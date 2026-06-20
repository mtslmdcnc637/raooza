// Raooza OS - Window Manager (Zustand)

import { create } from "zustand";
import type { WindowState, AppId } from "@/lib/os/types";

interface WindowStore {
  windows: WindowState[];
  topZ: number;
  activeId: string | null;

  open: (params: {
    appId: AppId;
    title: string;
    icon: any;
    width?: number;
    height?: number;
    payload?: Record<string, any>;
  }) => string;

  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, width: number, height: number) => void;
  setRect: (id: string, rect: Partial<Pick<WindowState, "x" | "y" | "width" | "height" | "snap">>) => void;
  setTitle: (id: string, title: string) => void;
  updatePayload: (id: string, payload: Record<string, any>) => void;
  restore: (id: string) => void;
  toggleSnap: (id: string, side: "left" | "right" | "top") => void;
}

const DEFAULT_X = 120;
const DEFAULT_Y = 80;

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  topZ: 10,
  activeId: null,

  open: ({ appId, title, icon, width = 800, height = 600, payload }) => {
    const state = get();
    // If app already open and not multi-instance, focus it
    const existing = state.windows.find((w) => w.appId === appId && !w.payload?.multiInstance);
    if (existing) {
      get().focus(existing.id);
      if (payload) get().updatePayload(existing.id, payload);
      return existing.id;
    }
    const id = `${appId}-${Date.now()}`;
    const z = state.topZ + 1;
    // Stagger windows
    const offset = state.windows.length * 28;
    const win: WindowState = {
      id,
      appId,
      title,
      icon,
      x: DEFAULT_X + offset,
      y: DEFAULT_Y + offset,
      width,
      height,
      z,
      minimized: false,
      maximized: false,
      snap: "none",
      payload,
    };
    set({ windows: [...state.windows, win], topZ: z, activeId: id });
    return id;
  },

  close: (id) => {
    set((s) => ({ windows: s.windows.filter((w) => w.id !== id) }));
  },

  focus: (id) => {
    set((s) => {
      const z = s.topZ + 1;
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, z, minimized: false } : w
        ),
        topZ: z,
        activeId: id,
      };
    });
  },

  minimize: (id) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w
      ),
      activeId: s.activeId === id ? null : s.activeId,
    }));
  },

  restore: (id) => {
    get().focus(id);
  },

  toggleMaximize: (id) => {
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          // restore
          const r = w.prevRect ?? { x: 120, y: 80, width: 800, height: 600 };
          return { ...w, maximized: false, snap: "none", ...r };
        }
        return {
          ...w,
          maximized: true,
          snap: "none",
          prevRect: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      }),
    }));
  },

  move: (id, x, y) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, x, y, snap: "none" } : w
      ),
    }));
  },

  resize: (id, width, height) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, width, height } : w
      ),
    }));
  },

  setRect: (id, rect) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, ...rect } : w)),
    }));
  },

  setTitle: (id, title) => {
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)),
    }));
  },

  updatePayload: (id, payload) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, payload: { ...w.payload, ...payload } } : w
      ),
    }));
  },

  toggleSnap: (id, side) => {
    set((s) => {
      const w = s.windows.find((x) => x.id === id);
      if (!w) return s;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
      const vh = typeof window !== "undefined" ? window.innerHeight : 720;
      const taskbarH = 48;
      const usableH = vh - taskbarH;

      let rect: Pick<WindowState, "x" | "y" | "width" | "height" | "snap">;
      if (side === "left") {
        rect = { x: 0, y: 0, width: vw / 2, height: usableH, snap: "left" };
      } else if (side === "right") {
        rect = { x: vw / 2, y: 0, width: vw / 2, height: usableH, snap: "right" };
      } else {
        // top = maximize
        rect = { x: 0, y: 0, width: vw, height: usableH, snap: "top" };
      }
      return {
        windows: s.windows.map((x) =>
          x.id === id
            ? {
                ...x,
                ...rect,
                maximized: side === "top" || x.maximized,
                prevRect: x.prevRect ?? { x: x.x, y: x.y, width: x.width, height: x.height },
              }
            : x
        ),
      };
    });
  },
}));
