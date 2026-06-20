"use client";

import { useSystemBus } from "@/stores/systemBus";
import { X, Bell } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function NotificationCenter({ onClose }: Props) {
  const notifications = useSystemBus((s) => s.notifications);
  const dismiss = useSystemBus((s) => s.dismissNotification);

  return (
    <>
      <div className="fixed inset-0 z-[8999]" onClick={onClose} />
      <div className="fixed bottom-14 right-2 z-[9000] w-[360px] max-h-[70vh] flex flex-col rounded-2xl border border-border/60 bg-card/85 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="text-sm font-medium">Notificações</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {notifications.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Sem notificações
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="group relative p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition cursor-default"
              >
                <div className="text-xs text-muted-foreground mb-0.5">{n.app}</div>
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                <button
                  onClick={() => dismiss(n.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
