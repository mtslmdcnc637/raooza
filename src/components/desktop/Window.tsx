"use client";

import { useRef, useState, useEffect, type ReactNode, type PointerEvent } from "react";
import { Minus, X, Square, Copy } from "lucide-react";
import type { WindowState } from "@/lib/os/types";
import { useWindowStore } from "@/stores/windowStore";
import { cn } from "@/lib/utils";

interface WindowProps {
  win: WindowState;
  children: ReactNode;
}

export function Window({ win, children }: WindowProps) {
  const { focus, close, minimize, toggleMaximize, move, resize, toggleSnap } = useWindowStore();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; dir: string } | null>(null);
  const [snapPreview, setSnapPreview] = useState<"left" | "right" | "top" | null>(null);

  function onTitlePointerDown(e: PointerEvent) {
    if (win.maximized) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: win.x, origY: win.y };
  }

  function onTitlePointerMove(e: PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const nx = dragRef.current.origX + dx;
    const ny = Math.max(0, dragRef.current.origY + dy);
    move(win.id, nx, ny);

    // Snap preview
    const vw = window.innerWidth;
    const edge = 8;
    if (e.clientX <= edge) setSnapPreview("left");
    else if (e.clientX >= vw - edge) setSnapPreview("right");
    else if (e.clientY <= 4) setSnapPreview("top");
    else setSnapPreview(null);
  }

  function onTitlePointerUp(e: PointerEvent) {
    if (dragRef.current) {
      dragRef.current = null;
      if (snapPreview) {
        toggleSnap(win.id, snapPreview);
        setSnapPreview(null);
      }
    }
  }

  function onResizePointerDown(e: PointerEvent, dir: string) {
    if (win.maximized) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: win.width,
      origH: win.height,
      dir,
    };
  }

  function onResizePointerMove(e: PointerEvent) {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    const dir = resizeRef.current.dir;
    let newW = resizeRef.current.origW;
    let newH = resizeRef.current.origH;
    if (dir.includes("e")) newW = Math.max(320, resizeRef.current.origW + dx);
    if (dir.includes("s")) newH = Math.max(240, resizeRef.current.origH + dy);
    if (dir.includes("w")) {
      newW = Math.max(320, resizeRef.current.origW - dx);
      move(win.id, dragRef.current?.origX ?? win.x, win.y);
    }
    resize(win.id, newW, newH);
  }

  function onResizePointerUp() {
    resizeRef.current = null;
  }

  if (win.minimized) return null;

  const isActive = useWindowStore.getState().activeId === win.id;

  const rect = win.maximized
    ? {
        left: 0,
        top: 0,
        width: "100vw",
        height: "calc(100vh - 48px)",
      }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
      };

  return (
    <>
      {snapPreview && (
        <div
          className="fixed z-[9998] pointer-events-none rounded-xl border-2 border-primary/60 bg-primary/15 backdrop-blur-sm transition-all duration-150"
          style={{
            left: snapPreview === "right" ? "50vw" : 0,
            top: 0,
            width: snapPreview === "top" ? "100vw" : "50vw",
            height: snapPreview === "top" ? "calc(100vh - 48px)" : "calc(100vh - 48px)",
          }}
        />
      )}
      <div
        className={cn(
          "absolute flex flex-col overflow-hidden rounded-xl border bg-card/95 backdrop-blur-xl shadow-2xl",
          isActive ? "border-primary/40 shadow-primary/5" : "border-border",
        )}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          zIndex: win.z,
        }}
        onPointerDown={() => focus(win.id)}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 h-9 px-3 select-none cursor-default bg-muted/30 border-b border-border/60"
          onPointerDown={onTitlePointerDown}
          onPointerMove={onTitlePointerMove}
          onPointerUp={onTitlePointerUp}
          onDoubleClick={() => toggleMaximize(win.id)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-4 h-4 flex items-center justify-center text-muted-foreground">
              {win.icon}
            </div>
            <span className="text-xs font-medium truncate">{win.title}</span>
          </div>
          <div className="flex items-center gap-1" data-no-drag>
            <button
              className="w-8 h-7 grid place-items-center rounded hover:bg-muted text-muted-foreground transition"
              onClick={() => minimize(win.id)}
              title="Minimizar"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              className="w-8 h-7 grid place-items-center rounded hover:bg-muted text-muted-foreground transition"
              onClick={() => toggleMaximize(win.id)}
              title="Maximizar"
            >
              {win.maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>
            <button
              className="w-8 h-7 grid place-items-center rounded hover:bg-red-500 hover:text-white text-muted-foreground transition"
              onClick={() => close(win.id)}
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">{children}</div>

        {/* Resize handles */}
        {!win.maximized && (
          <>
            <div className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize" onPointerDown={(e) => onResizePointerDown(e, "n")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize" onPointerDown={(e) => onResizePointerDown(e, "s")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize" onPointerDown={(e) => onResizePointerDown(e, "w")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize" onPointerDown={(e) => onResizePointerDown(e, "e")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute top-0 left-0 w-2 h-2 cursor-nwse-resize" onPointerDown={(e) => onResizePointerDown(e, "nw")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute top-0 right-0 w-2 h-2 cursor-nesw-resize" onPointerDown={(e) => onResizePointerDown(e, "ne")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute bottom-0 left-0 w-2 h-2 cursor-nesw-resize" onPointerDown={(e) => onResizePointerDown(e, "sw")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div className="absolute bottom-0 right-0 w-2 h-2 cursor-nwse-resize" onPointerDown={(e) => onResizePointerDown(e, "se")} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
          </>
        )}
      </div>
    </>
  );
}
