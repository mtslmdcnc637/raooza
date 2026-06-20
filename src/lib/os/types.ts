// Raooza OS - Core Types

import type { ReactNode } from "react";

export type AppId =
  | "notes"
  | "pomodoro"
  | "kanban"
  | "editor"
  | "assistant"
  | "settings"
  | "fileexplorer"
  | string;

export interface WindowState {
  id: string; // unique instance id
  appId: AppId;
  title: string;
  icon: ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  prevRect?: { x: number; y: number; width: number; height: number };
  snap?: "left" | "right" | "top" | "none";
  payload?: Record<string, any>; // open with specific doc, etc
}

export interface ActionSchema {
  action: string;
  description: string;
  payloadSchema: Record<string, ActionFieldSchema>;
}

export interface ActionFieldSchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface AppManifest {
  id: AppId;
  name: string;
  icon: ReactNode;
  description: string;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  resizable?: boolean;
  // actions exposed to AI
  actions?: ActionSchema[];
  // can this app be pinned to taskbar?
  pinnable?: boolean;
  // does it show on the desktop as a sticky widget?
  hasStickyMode?: boolean;
  category?: "productivity" | "system" | "ai";
}

// AI Protocol
export interface RaoozaAction {
  app: string;
  action: string;
  payload: Record<string, any>;
  schedule?: {
    type: "now" | "once";
    at?: string; // ISO 8601
  };
}

export interface RaoozaBatch {
  actions: RaoozaAction[];
  explanation?: string;
}

// Scheduled action record (persisted)
export interface ScheduledAction {
  id: string;
  action: RaoozaAction;
  at: string; // ISO 8601
  executed: boolean;
  createdAt: string;
}
