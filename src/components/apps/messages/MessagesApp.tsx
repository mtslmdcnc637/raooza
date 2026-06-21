"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Peer, type Message } from "@/lib/db/db";
import {
  useIdentity,
  publishPublicKey,
  fetchPublicKey,
  sendEncryptedMessage,
  pollMessages,
  acknowledgeMessage,
  decryptFromSender,
  saveMessage,
  addPeer,
} from "@/lib/messaging/crypto";
import {
  Send,
  Plus,
  Copy,
  Check,
  Users,
  MessageCircle,
  ArrowLeft,
  Trash2,
  UserPlus,
  Pin,
  PinOff,
  Check as CheckIcon,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MessagesApp() {
  const { identity, loading } = useIdentity();
  const peers = useLiveQuery(async () => await getDb().peers.toArray(), []);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Publish our pubkey on mount
  useEffect(() => {
    if (identity) {
      publishPublicKey(identity).catch(() => {
        setError("Backend de mensagens não configurado. Defina NEXT_PUBLIC_MSG_BACKEND_URL ou NEXT_PUBLIC_BACKEND_URL nas variáveis de ambiente.");
      });
    }
  }, [identity]);

  // Poll for incoming messages every 5s
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      try {
        const incoming = await pollMessages(identity);
        for (const m of incoming) {
          // Check if we have this peer in our list (whitelist)
          const peer = await getDb().peers.get(m.fromId);
          if (!peer) {
            // Unknown sender — skip (don't auto-add; user must add manually)
            // Still ack so it doesn't pile up forever in the relay
            await acknowledgeMessage(m.messageId);
            continue;
          }
          // Decrypt
          try {
            const plaintext = await decryptFromSender(m.fromPublicKey, m.ciphertext, m.nonce);
            await saveMessage(m.fromId, "in", plaintext, false);
            // Notify via system bus (so desktop overlay can show)
            // We'll handle this via a custom event
            window.dispatchEvent(new CustomEvent("raooza:incoming-message", {
              detail: { peerId: m.fromId, peerName: peer.displayName, plaintext },
            }));
          } catch (e) {
            // Decryption failed — skip
          }
          // Ack (delete from backend)
          await acknowledgeMessage(m.messageId);
        }
      } catch {}
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [identity]);

  if (loading) {
    return (
      <div className="h-full grid place-items-center text-xs text-muted-foreground">
        Carregando identidade...
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="h-full grid place-items-center text-xs text-muted-foreground">
        Falha ao carregar identidade criptográfica
      </div>
    );
  }

  function copyId() {
    if (!identity) return;
    navigator.clipboard.writeText(identity.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedPeer = (peers ?? []).find((p) => p.id === selectedPeerId);

  if (selectedPeer) {
    return <Conversation peer={selectedPeer} identity={identity} onBack={() => setSelectedPeerId(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <MessageCircle className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Mensagens</h2>
          <p className="text-xs text-muted-foreground">{(peers ?? []).length} contato(s) · E2E</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <UserPlus className="w-3.5 h-3.5" /> Contato
        </button>
      </div>

      {/* My ID card */}
      <div className="p-3 border-b border-border/40">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Seu ID</div>
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border/40">
          <code className="flex-1 text-xs font-mono break-all">{identity.id}</code>
          <button
            onClick={copyId}
            className="w-7 h-7 grid place-items-center rounded hover:bg-muted transition flex-shrink-0"
            title="Copiar ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Compartilhe este ID com quem quer te mandar mensagens. Eles vão precisar adicionar você como contato.
        </p>
      </div>

      {error && (
        <div className="p-3 border-b border-amber-500/30 bg-amber-500/10">
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Peers list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1.5">Conversas</div>
        {(peers ?? []).length === 0 ? (
          <div className="text-center py-8 px-4">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground mb-1">Nenhum contato ainda</p>
            <p className="text-[10px] text-muted-foreground/70">Adicione pelo ID de alguém para começar uma conversa</p>
          </div>
        ) : (
          <div className="space-y-1">
            {(peers ?? []).map((p) => (
              <PeerRow key={p.id} peer={p} onClick={() => setSelectedPeerId(p.id)} />
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddPeerDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function PeerRow({ peer, onClick }: { peer: Peer; onClick: () => void }) {
  const lastMessage = useLiveQuery(async () => {
    const msgs = await getDb().messages.where("peerId").equals(peer.id).toArray();
    return msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [peer.id]);

  const unread = useLiveQuery(async () => {
    const msgs = await getDb().messages.where("peerId").equals(peer.id).toArray();
    return msgs.filter((m) => !m.read).length;
  }, [peer.id]);

  return (
    <div
      onClick={onClick}
      className="group p-2.5 rounded-lg hover:bg-muted/40 cursor-pointer transition flex items-center gap-2"
    >
      <div
        className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold flex-shrink-0"
        style={{ background: "var(--accent-color)" }}
      >
        {peer.displayName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{peer.displayName}</span>
          {unread > 0 && (
            <span
              className="text-[10px] text-white rounded-full w-4 h-4 grid place-items-center font-bold flex-shrink-0"
              style={{ background: "var(--accent-color)" }}
            >
              {unread}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {lastMessage ? lastMessage.plaintext : "Toque para conversar"}
        </div>
      </div>
      {lastMessage && (
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {new Date(lastMessage.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function Conversation({
  peer,
  identity,
  onBack,
}: {
  peer: Peer;
  identity: { id: string; publicKey: string };
  onBack: () => void;
}) {
  const messages = useLiveQuery(async () => {
    const msgs = await getDb().messages.where("peerId").equals(peer.id).toArray();
    return msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [peer.id]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editName, setEditName] = useState(false);
  const [displayName, setDisplayName] = useState(peer.displayName);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  // Mark as read when opening
  useEffect(() => {
    (async () => {
      const msgs = await getDb().messages.where("peerId").equals(peer.id).toArray();
      for (const m of msgs) {
        if (!m.read) {
          await getDb().messages.update(m.id, { read: true });
        }
      }
    })();
  }, [peer.id]);

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    setError("");
    const text = input.trim();
    setInput("");
    try {
      const result = await sendEncryptedMessage(peer.id, peer.publicKey, text);
      if (!result.ok) {
        setError(result.error || "Erro ao enviar");
        setInput(text); // restore input so user can retry
        return;
      }
      await saveMessage(peer.id, "out", text);
    } catch (e: any) {
      setError(e.message);
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function saveName() {
    if (displayName.trim()) {
      await getDb().peers.update(peer.id, { displayName: displayName.trim() });
    }
    setEditName(false);
  }

  async function deletePeer() {
    if (!confirm(`Remover ${peer.displayName}? Todo o histórico desta conversa será apagado.`)) return;
    await getDb().messages.where("peerId").equals(peer.id).delete();
    await getDb().peers.delete(peer.id);
    onBack();
  }

  async function togglePin(msg: Message) {
    await getDb().messages.update(msg.id, {
      pinned: !msg.pinned,
      pinnedAt: !msg.pinned ? new Date().toISOString() : undefined,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <button onClick={onBack} className="w-7 h-7 grid place-items-center rounded hover:bg-muted transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-8 h-8 rounded-full grid place-items-center text-white text-sm font-semibold flex-shrink-0"
          style={{ background: "var(--accent-color)" }}
        >
          {peer.displayName.charAt(0).toUpperCase()}
        </div>
        {editName ? (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm font-semibold border-b border-primary"
          />
        ) : (
          <button
            onClick={() => setEditName(true)}
            className="flex-1 text-left text-sm font-semibold hover:bg-muted/40 rounded px-1 py-0.5 -mx-1 transition"
            title="Editar nome"
          >
            {peer.displayName}
          </button>
        )}
        <button
          onClick={deletePeer}
          className="w-7 h-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
          title="Remover contato"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/5">
        {(messages ?? []).length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        )}
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={cn(
              "group flex flex-col gap-1 max-w-[80%]",
              m.direction === "out" ? "ml-auto items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
                m.direction === "out"
                  ? "text-white rounded-br-md"
                  : "bg-card border border-border/40 rounded-bl-md",
              )}
              style={m.direction === "out" ? { background: "var(--accent-color)" } : {}}
            >
              {m.plaintext}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
              <span>{new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button
                onClick={() => togglePin(m)}
                className="opacity-0 group-hover:opacity-100 hover:text-primary transition"
                title={m.pinned ? "Desafixar" : "Fixar na tela"}
              >
                {m.pinned ? <PinOff className="w-2.5 h-2.5" /> : <Pin className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border/40">
        {error && (
          <div className="text-[10px] text-destructive mb-1 px-2">{error}</div>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Mensagem..."
            rows={1}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-muted/40 border border-border/60 outline-none focus:border-primary resize-none max-h-32"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-lg grid place-items-center text-white disabled:opacity-30 transition flex-shrink-0"
            style={{ background: "var(--accent-color)" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPeerDialog({ onClose }: { onClose: () => void }) {
  const [peerId, setPeerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (!peerId.trim() || !displayName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const id = peerId.trim();
      // Check if already exists
      const existing = await getDb().peers.get(id);
      if (existing) {
        setError("Este contato já existe");
        return;
      }
      // Fetch pubkey from backend
      const pubkey = await fetchPublicKey(id);
      if (!pubkey) {
        setError("Contato não encontrado. Verifique o ID ou peça para a pessoa publicar a chave pública.");
        return;
      }
      await addPeer(displayName.trim(), id, pubkey);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Adicionar contato</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">ID do contato</label>
            <input
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="raooza-x7f9k2m4q8b"
              autoFocus
              className="w-full h-9 px-3 text-sm font-mono rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Nome (apenas você vê)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Barbara, Vini, João..."
              className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">O nome fica salvo apenas no seu navegador</p>
          </div>
          {error && (
            <div className="text-xs text-destructive p-2 rounded bg-destructive/10">{error}</div>
          )}
          <button
            onClick={add}
            disabled={!peerId.trim() || !displayName.trim() || loading}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            {loading ? "Buscando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
