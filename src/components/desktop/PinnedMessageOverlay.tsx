"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Message, type Peer } from "@/lib/db/db";
import { useSettings } from "@/stores/settingsStore";
import { X, Pin, Reply, ChevronRight, MessageCircle } from "lucide-react";

interface IncomingNote {
  id: string; // message id
  peerId: string;
  peerName: string;
  plaintext: string;
  timestamp: string;
}

const NOTE_COLORS = [
  "#fbbf24", // amber
  "#34d399", // emerald
  "#60a5fa", // blue
  "#f87171", // red
  "#a78bfa", // violet
  "#f9a8d4", // pink
];

export function PinnedMessageOverlay() {
  const [incomingQueue, setIncomingQueue] = useState<IncomingNote[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<IncomingNote[]>([]);
  const accent = useSettings((s) => s.accent);

  // Pinned messages from DB (persist across reloads)
  const pinnedMessages = useLiveQuery(async () => {
    const msgs = await getDb().messages.where("pinned").equals(1 as any).toArray();
    const peers = await getDb().peers.toArray();
    return msgs.map((m) => ({
      message: m,
      peer: peers.find((p) => p.id === m.peerId),
    }));
  }, []);

  // Sync pinned notes from DB to local state
  useEffect(() => {
    if (!pinnedMessages) return;
    setPinnedNotes(
      pinnedMessages.map(({ message, peer }) => ({
        id: message.id,
        peerId: message.peerId,
        peerName: peer?.displayName ?? "Desconhecido",
        plaintext: message.plaintext,
        timestamp: message.createdAt,
      })),
    );
  }, [pinnedMessages]);

  // Listen for incoming messages
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { peerId: string; peerName: string; plaintext: string };
      const note: IncomingNote = {
        id: `incoming-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        peerId: detail.peerId,
        peerName: detail.peerName,
        plaintext: detail.plaintext,
        timestamp: new Date().toISOString(),
      };
      setIncomingQueue((q) => [...q, note]);
    }
    window.addEventListener("raooza:incoming-message", handler);
    return () => window.removeEventListener("raooza:incoming-message", handler);
  }, []);

  async function dismissIncoming(note: IncomingNote) {
    setIncomingQueue((q) => q.filter((n) => n.id !== note.id));
  }

  async function pinIncoming(note: IncomingNote) {
    // Find the actual message in DB by peerId + timestamp proximity, then mark as pinned
    // Since incoming notes have synthetic IDs, find the real message
    const peerMessages = await getDb().messages.where("peerId").equals(note.peerId).toArray();
    const recent = peerMessages
      .filter((m) => m.direction === "in")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (recent) {
      await getDb().messages.update(recent.id, {
        pinned: true,
        pinnedAt: new Date().toISOString(),
      });
    }
    dismissIncoming(note);
  }

  async function unpin(note: IncomingNote) {
    await getDb().messages.update(note.id, {
      pinned: false,
      pinnedAt: undefined,
    });
  }

  function reply(note: IncomingNote) {
    // Open the messages app focused on this peer
    window.dispatchEvent(new CustomEvent("raooza:open-conversation", {
      detail: { peerId: note.peerId },
    }));
    dismissIncoming(note);
  }

  const currentNote = incomingQueue[0];

  return (
    <>
      {/* Incoming message notification (center, single at a time) */}
      {currentNote && (
        <div className="fixed inset-0 z-[9700] pointer-events-none grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={() => dismissIncoming(currentNote)} />
          <div
            className="relative pointer-events-auto rounded-2xl shadow-2xl border-2 max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: NOTE_COLORS[Math.abs(hashCode(currentNote.peerId)) % NOTE_COLORS.length],
              borderColor: "rgba(0,0,0,0.1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/30 grid place-items-center text-white text-xs font-bold">
                  {currentNote.peerName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-900">{currentNote.peerName}</span>
              </div>
              <button
                onClick={() => dismissIncoming(currentNote)}
                className="w-7 h-7 grid place-items-center rounded-full hover:bg-black/10 text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Body */}
            <div className="p-4">
              <p className="text-gray-900 whitespace-pre-wrap break-words text-base leading-relaxed">
                {currentNote.plaintext}
              </p>
              <div className="text-[10px] text-gray-700 mt-2">
                {new Date(currentNote.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            {/* Actions */}
            <div className="flex border-t border-black/10">
              <button
                onClick={() => dismissIncoming(currentNote)}
                className="flex-1 py-2.5 text-xs font-medium text-gray-700 hover:bg-black/5 transition"
              >
                Dispensar
              </button>
              <button
                onClick={() => pinIncoming(currentNote)}
                className="flex-1 py-2.5 text-xs font-medium text-gray-700 hover:bg-black/5 transition border-l border-black/10 flex items-center justify-center gap-1"
              >
                <Pin className="w-3 h-3" /> Fixar
              </button>
              <button
                onClick={() => reply(currentNote)}
                className="flex-1 py-2.5 text-xs font-medium text-white transition flex items-center justify-center gap-1"
                style={{ background: accent }}
              >
                <Reply className="w-3 h-3" /> Responder
              </button>
            </div>
            {incomingQueue.length > 1 && (
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black/50 rounded-full px-2 py-0.5">
                +{incomingQueue.length - 1} próxima(s)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pinned notes (sticky on desktop, behind windows) */}
      <div className="fixed inset-0 bottom-12 pointer-events-none z-[1]">
        {pinnedNotes.map((note, i) => {
          // Stagger position
          const x = 80 + (i * 30) % 200;
          const y = 80 + (i * 25) % 150;
          const color = NOTE_COLORS[Math.abs(hashCode(note.peerId)) % NOTE_COLORS.length];
          return (
            <div
              key={note.id}
              className="absolute pointer-events-auto rounded-lg shadow-xl border border-black/10 w-56 flex flex-col group"
              style={{ left: x, top: y, background: color, zIndex: 2 }}
            >
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-4 h-4 rounded-full bg-white/30 grid place-items-center text-[8px] font-bold text-white flex-shrink-0">
                    {note.peerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-bold truncate text-gray-900">{note.peerName}</span>
                </div>
                <button
                  onClick={() => unpin(note)}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 grid place-items-center rounded hover:bg-black/10 text-gray-700"
                  title="Desafixar"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="px-2 pb-2 text-[11px] text-gray-900 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {note.plaintext}
              </div>
              <div className="px-2 pb-1 text-[9px] text-gray-700 flex items-center gap-1">
                <MessageCircle className="w-2 h-2" />
                {new Date(note.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
