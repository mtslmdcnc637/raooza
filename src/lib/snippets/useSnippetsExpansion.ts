"use client";

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Snippet } from "@/lib/db/db";

// Built-in snippets seeded on first run
export const BUILTIN_SNIPPETS: Omit<Snippet, "id" | "createdAt" | "updatedAt">[] = [
  {
    trigger: "/meeting",
    name: "Ata de reunião",
    content: `Reunião em ${new Date().toLocaleDateString("pt-BR")}

Participantes: 
Pauta:
1. 
2. 
3. 

Decisões:
- 

Próximos passos:
- [ ] `,
    isBuiltin: true,
  },
  {
    trigger: "/todo",
    name: "Lista de tarefas",
    content: `- [ ] 
- [ ] 
- [ ] `,
    isBuiltin: true,
  },
  {
    trigger: "/date",
    name: "Data de hoje",
    content: new Date().toLocaleDateString("pt-BR"),
    isBuiltin: true,
  },
  {
    trigger: "/now",
    name: "Data e hora atuais",
    content: new Date().toLocaleString("pt-BR"),
    isBuiltin: true,
  },
  {
    trigger: "/sig",
    name: "Assinatura",
    content: `Atenciosamente,

[Seu nome]`,
    isBuiltin: true,
  },
  {
    trigger: "/pr",
    name: "Template de PR",
    content: `## O que mudou
- 

## Por que
- 

## Como testar
1. 
2. 

## Checklist
- [ ] Testes passando
- [ ] Documentação atualizada
- [ ] Sem conflitos com main`,
    isBuiltin: true,
  },
  {
    trigger: "/bug",
    name: "Relato de bug",
    content: `**Bug:** 

**Como reproduzir:**
1. 
2. 
3. 

**Esperado:** 
**Atual:** 
**Ambiente:** `,
    isBuiltin: true,
  },
  {
    trigger: "/br",
    name: "Quebra de linha duplo",
    content: `\n\n`,
    isBuiltin: true,
  },
];

// Cache of snippets loaded once for fast lookup
let snippetsCache: Snippet[] = [];
let cacheInitialized = false;

async function refreshCache() {
  const all = await getDb().snippets.toArray();
  snippetsCache = all;
  cacheInitialized = true;
}

export function useSnippetsExpansion() {
  const snippets = useLiveQuery(async () => {
    const all = await getDb().snippets.toArray();
    snippetsCache = all;
    cacheInitialized = true;
    return all;
  }, []);

  // Seed built-ins on first run
  useEffect(() => {
    (async () => {
      const existing = await getDb().snippets.toArray();
      const missing = BUILTIN_SNIPPETS.filter(
        (b) => !existing.some((e) => e.trigger === b.trigger && e.isBuiltin),
      );
      if (missing.length > 0) {
        const now = new Date().toISOString();
        await getDb().snippets.bulkAdd(
          missing.map((b) => ({
            ...b,
            id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    })();
  }, []);

  // Listen to keydown globally — if user types a trigger followed by space, expand
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== " " && e.key !== "Tab") return;
      // Only handle space/tab right after typing a trigger
      const target = e.target as HTMLElement;
      if (!target) return;
      const isEditable =
        target.tagName === "TEXTAREA" ||
        (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox" && (target as HTMLInputElement).type !== "radio" && (target as HTMLInputElement).type !== "file") ||
        target.isContentEditable;
      if (!isEditable) return;

      const inputEl = target as HTMLInputElement | HTMLTextAreaElement;
      const text = inputEl.value ?? "";
      const cursorPos = inputEl.selectionStart ?? text.length;
      // Find trigger before cursor — last word ending at cursor
      const before = text.slice(0, cursorPos);
      // Match /\S+$/ but require trigger to start with "/"
      const match = before.match(/\/[a-zA-Z0-9_-]+$/);
      if (!match) return;
      const trigger = match[0];
      const snippet = snippetsCache.find((s) => s.trigger === trigger);
      if (!snippet) return;

      // Prevent default (space/tab)
      e.preventDefault();
      // Replace trigger with snippet content + space (for space key) or just snippet (for tab)
      const after = text.slice(cursorPos);
      const replacement = snippet.content + (e.key === " " ? " " : "");
      const newValue = before.slice(0, match.index) + replacement + after;
      // Update value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputEl, newValue);
      } else {
        inputEl.value = newValue;
      }
      // Place cursor after replacement
      const newCursorPos = (match.index ?? 0) + replacement.length;
      inputEl.setSelectionRange(newCursorPos, newCursorPos);
      // Dispatch input event so React picks it up
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  return { snippets: snippets ?? [] };
}
