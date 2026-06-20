// Raooza OS - System Bus for cross-app actions
// Allows AI executor and apps to talk to each other without prop drilling.

import { create } from "zustand";
import { toast } from "sonner";

interface SystemBus {
  // signals for apps to refresh
  refreshTick: number;
  triggerRefresh: () => void;
  // notifications
  notifications: NotificationItem[];
  notify: (n: Omit<NotificationItem, "id" | "createdAt">) => void;
  dismissNotification: (id: string) => void;
  // AI assistant open signal
  openAssistant: (msg?: string) => void;
  assistantOpener: ((msg?: string) => void) | null;
  registerAssistantOpener: (fn: (msg?: string) => void) => void;
  // Focus mode
  focusMode: boolean;
  focusTaskId?: string;
  enterFocusMode: (taskId?: string) => void;
  exitFocusMode: () => void;
  // Time tracker signal (for global timer indicator)
  trackerActive: boolean;
  setTrackerActive: (b: boolean) => void;
  // Dashboard refresh
  dashboardTick: number;
  triggerDashboard: () => void;
}

export interface NotificationItem {
  id: string;
  app: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
}

export const useSystemBus = create<SystemBus>((set, get) => ({
  refreshTick: 0,
  triggerRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

  notifications: [],
  notify: (n) => {
    const item: NotificationItem = {
      ...n,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    set((s) => ({ notifications: [item, ...s.notifications].slice(0, 100) }));
    toast(item.title, { description: item.body });
  },
  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) })),

  openAssistant: (msg) => {
    const fn = get().assistantOpener;
    if (fn) fn(msg);
  },
  assistantOpener: null,
  registerAssistantOpener: (fn) => set({ assistantOpener: fn }),

  focusMode: false,
  focusTaskId: undefined,
  enterFocusMode: (taskId) => set({ focusMode: true, focusTaskId: taskId }),
  exitFocusMode: () => set({ focusMode: false, focusTaskId: undefined }),

  trackerActive: false,
  setTrackerActive: (b) => set({ trackerActive: b }),

  dashboardTick: 0,
  triggerDashboard: () => set((s) => ({ dashboardTick: s.dashboardTick + 1 })),
}));
