"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type ChatMessage, type ChatConversation } from "@/lib/db/db";
import { useSettings } from "@/stores/settingsStore";
import { useSystemBus } from "@/stores/systemBus";
import { executeBatch } from "@/lib/ai/executor";
import { PROVIDERS } from "@/lib/ai/providers";
import { Send, Sparkles, Loader2, Trash2, Plus, Settings as SettingsIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RaoozaBatch } from "@/lib/os/types";
import { useWindowStore } from "@/stores/windowStore";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AssistantApp() {
  const conversations = useLiveQuery(async () => {
    return await getDb().conversations.orderBy("updatedAt").reverse().toArray();
  });
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<{ batch: RaoozaBatch; convId: string } | null>(null);

  const { aiProvider, apiKeys, defaultModel } = useSettings.getState();
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);
  const openSettings = useWindowStore((s) => s.open);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = (conversations ?? []).find((c) => c.id === activeConvId);

  useEffect(() => {
    if (!activeConvId && conversations && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length]);

  async function newConversation() {
    const now = new Date().toISOString();
    const conv: ChatConversation = {
      id: uid("conv"),
      title: "Nova conversa",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().conversations.add(conv);
    setActiveConvId(conv.id);
  }

  async function deleteConv(id: string) {
    await getDb().conversations.delete(id);
    if (activeConvId === id) setActiveConvId(null);
  }

  async function send() {
    if (!input.trim() || busy) return;
    setBusy(true);

    let convId = activeConvId;
    if (!convId) {
      const now = new Date().toISOString();
      const conv: ChatConversation = {
        id: uid("conv"),
        title: input.slice(0, 40),
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      await getDb().conversations.add(conv);
      convId = conv.id;
      setActiveConvId(convId);
    }

    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    };
    const conv = await getDb().conversations.get(convId);
    if (conv) {
      const newMessages = [...conv.messages, userMsg];
      await getDb().conversations.update(convId, {
        messages: newMessages,
        title: conv.messages.length === 0 ? input.slice(0, 40) : conv.title,
        updatedAt: new Date().toISOString(),
      });
    }
    setInput("");

    try {
      const settingsState = useSettings.getState();
      const provider = settingsState.aiProvider;
      const apiKey = settingsState.apiKeys[provider];
      const model = settingsState.defaultModel[provider];

      const allMsgs = (await getDb().conversations.get(convId!))?.messages ?? [];
      const apiMessages = allMsgs.slice(-12).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          model,
          messages: apiMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || "Erro ao chamar IA";
        const errMsg: ChatMessage = {
          id: uid("msg"),
          role: "assistant",
          content: `⚠️ Erro: ${err}`,
          createdAt: new Date().toISOString(),
        };
        const c = await getDb().conversations.get(convId!);
        if (c) {
          await getDb().conversations.update(convId!, {
            messages: [...c.messages, errMsg],
            updatedAt: new Date().toISOString(),
          });
        }
        return;
      }

      const content = data.content as string;

      // Try to parse JSON action batch
      const parsed = tryParseBatch(content);
      if (parsed) {
        // Show assistant message + ask for confirmation
        const assistantMsg: ChatMessage = {
          id: uid("msg"),
          role: "assistant",
          content: parsed.explanation ?? "Vou executar as ações abaixo.",
          actions: parsed.actions,
          createdAt: new Date().toISOString(),
        };
        const c = await getDb().conversations.get(convId!);
        if (c) {
          await getDb().conversations.update(convId!, {
            messages: [...c.messages, assistantMsg],
            updatedAt: new Date().toISOString(),
          });
        }
        setPendingBatch({ batch: parsed, convId: convId! });
      } else {
        const assistantMsg: ChatMessage = {
          id: uid("msg"),
          role: "assistant",
          content,
          createdAt: new Date().toISOString(),
        };
        const c = await getDb().conversations.get(convId!);
        if (c) {
          await getDb().conversations.update(convId!, {
            messages: [...c.messages, assistantMsg],
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e: any) {
      notify({ app: "assistant", title: "Erro de IA", body: e?.message });
    } finally {
      setBusy(false);
      triggerRefresh();
    }
  }

  async function confirmBatch() {
    if (!pendingBatch) return;
    setBusy(true);
    const results = await executeBatch(pendingBatch.batch.actions);
    const resultMsg: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content: "✅ Ações executadas:\n" + results.map((r) => `${r.ok ? "✓" : "✗"} ${r.message}`).join("\n"),
      createdAt: new Date().toISOString(),
    };
    const c = await getDb().conversations.get(pendingBatch.convId);
    if (c) {
      await getDb().conversations.update(pendingBatch.convId, {
        messages: [...c.messages, resultMsg],
        updatedAt: new Date().toISOString(),
      });
    }
    setPendingBatch(null);
    setBusy(false);
    triggerRefresh();
  }

  function cancelBatch() {
    setPendingBatch(null);
  }

  const providerName = PROVIDERS[aiProvider].name;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-48 border-r border-border/40 flex flex-col bg-muted/20">
        <div className="p-2 border-b border-border/40">
          <button
            onClick={newConversation}
            className="w-full h-8 rounded-md text-xs font-medium hover:opacity-90 transition flex items-center justify-center gap-1.5 text-white"
            style={{ background: "var(--accent-color)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Nova conversa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {(conversations ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConvId(c.id)}
              className={cn(
                "w-full text-left p-2 rounded-md text-xs transition group",
                activeConvId === c.id ? "bg-muted/60" : "hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </button>
          ))}
          {(!conversations || conversations.length === 0) && (
            <div className="text-center text-[10px] text-muted-foreground py-4">
              Sem conversas
            </div>
          )}
        </div>
        <div className="p-2 border-t border-border/40">
          <button
            onClick={() => openSettings({ appId: "settings", title: "Configurações", icon: null })}
            className="w-full h-7 rounded-md text-[10px] hover:bg-muted/60 transition flex items-center justify-center gap-1 text-muted-foreground"
          >
            <SettingsIcon className="w-3 h-3" />
            {providerName}
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(!activeConv || activeConv.messages.length === 0) && (
            <div className="h-full grid place-items-center">
              <div className="text-center max-w-xs">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 grid place-items-center text-white shadow-lg"
                  style={{ background: "var(--accent-color)" }}
                >
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-semibold">Assistente Raooza</h3>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Posso criar notas, tarefas, agendar ações e muito mais. Experimente: "Crie uma nota sobre a reunião de amanhã e adicione uma tarefa no kanban".
                </p>
              </div>
            </div>
          )}
          {(activeConv?.messages ?? []).map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {pendingBatch && (
            <div className="border border-primary/40 rounded-lg p-3 bg-primary/5">
              <div className="text-xs font-semibold mb-2">Confirmar ações:</div>
              <div className="space-y-1 mb-3">
                {pendingBatch.batch.actions.map((a, i) => (
                  <div key={i} className="text-xs font-mono p-1.5 rounded bg-background/60 border border-border/40">
                    <span className="text-primary">{a.app}</span>.<span className="text-foreground">{a.action}</span>
                    <span className="text-muted-foreground">({Object.keys(a.payload).join(", ")})</span>
                    {a.schedule?.at && (
                      <span className="text-amber-600 ml-2">⏰ {new Date(a.schedule.at).toLocaleString("pt-BR")}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmBatch}
                  disabled={busy}
                  className="h-7 px-3 rounded text-xs bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1 disabled:opacity-50"
                  style={{ background: "var(--accent-color)" }}
                >
                  <Check className="w-3 h-3" /> Executar
                </button>
                <button
                  onClick={cancelBatch}
                  className="h-7 px-3 rounded text-xs hover:bg-muted flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancelar
                </button>
              </div>
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Pensando...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/40">
          <div className="flex items-end gap-2 p-2 rounded-lg bg-muted/40 border border-border/60 focus-within:border-primary/60 transition">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte ou peça uma ação..."
              rows={1}
              className="flex-1 bg-transparent outline-none text-sm resize-none max-h-32 placeholder:text-muted-foreground"
            />
            <button
              onClick={send}
              disabled={!input.trim() || busy}
              className="w-8 h-8 rounded-md grid place-items-center text-white disabled:opacity-30 transition hover:opacity-90"
              style={{ background: "var(--accent-color)" }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 px-1">
            Provedor: {providerName} · Modelo: {defaultModel[aiProvider]}
            {!apiKeys[aiProvider] && aiProvider !== "glm" && (
              <span className="text-amber-600 ml-2">⚠ Configure a API key nas Configurações</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-3 py-2 rounded-lg text-sm text-white"
          style={{ background: "var(--accent-color)" }}
        >
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-3 py-2 rounded-lg text-sm bg-muted/60 whitespace-pre-wrap">
        {msg.content}
        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
            <div className="text-[10px] uppercase text-muted-foreground font-semibold">Ações:</div>
            {msg.actions.map((a: any, i: number) => (
              <div key={i} className="text-[10px] font-mono">
                → {a.app}.{a.action}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function tryParseBatch(content: string): RaoozaBatch | null {
  // Find first { ... } block that looks like a batch
  let s = content.trim();
  // Strip markdown code fences
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const parsed = JSON.parse(s);
    if (parsed && Array.isArray(parsed.actions)) {
      return parsed as RaoozaBatch;
    }
  } catch {
    // Try to extract the first JSON object
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && Array.isArray(parsed.actions)) return parsed as RaoozaBatch;
      } catch {}
    }
  }
  return null;
}
