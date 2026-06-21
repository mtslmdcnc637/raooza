"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Template } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { useWindowStore } from "@/stores/windowStore";
import {
  Plus,
  Trash2,
  X,
  FileText,
  StickyNote,
  Network,
  Trello,
  Copy,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Built-in templates seeded on first run
const BUILTIN_TEMPLATES: Omit<Template, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Ata de Reunião",
    description: "Template para 1:1 ou sync semanal",
    category: "note",
    icon: "sticky",
    isBuiltin: true,
    tags: ["reuniao"],
    content: `# Reunião — {{data}}

## Participantes
- 

## Pauta
1. 
2. 
3. 

## Discussões


## Decisões
- 

## Próximos Passos
- [ ] @pessoa — ação
- [ ] @pessoa — ação

## Próxima reunião
{{proxima-data}}`,
  },
  {
    name: "Retrospectiva",
    description: "Sprint retro: o que funcionou / melhorar / ações",
    category: "note",
    icon: "sticky",
    isBuiltin: true,
    tags: ["retro", "agile"],
    content: `# Retrospectiva — {{sprint}}

## 🟢 O que funcionou bem
- 

## 🟡 O que pode melhorar
- 

## 🔴 O que não funcionou
- 

## 🎯 Ações para próxima sprint
- [ ] 
- [ ] 
- [ ] 

## Métricas
- Velocidade: 
- Tarefas concluídas: 
- Bugs: `,
  },
  {
    name: "PRD — Requisitos de Produto",
    description: "Documento de PRD estruturado",
    category: "doc",
    icon: "doc",
    isBuiltin: true,
    tags: ["prd", "produto"],
    content: `# PRD: {{nome-da-feature}}

## 1. Resumo
Uma frase descrevendo o que estamos construindo.

## 2. Problema
Qual problema do usuário estamos resolvendo?

## 3. Objetivos
- Objetivo 1
- Objetivo 2

## 4. Não-objetivos
- O que NÃO vamos fazer nesta iteração

## 5. Persona
Para quem estamos construindo?

## 6. Requisitos funcionais
- [ ] RF-1: 
- [ ] RF-2: 

## 7. Requisitos não-funcionais
- Performance: 
- Segurança: 
- Escala: 

## 8. Métricas de sucesso
- Métrica 1: baseline → meta
- Métrica 2: baseline → meta

## 9. Riscos
- Risco 1 → mitigação
- Risco 2 → mitigação

## 10. Timeline
- Semana 1: 
- Semana 2: `,
  },
  {
    name: "Brainstorm de Ideias",
    description: "Estrutura para sessão de brainstorm",
    category: "note",
    icon: "sticky",
    isBuiltin: true,
    tags: ["brainstorm"],
    content: `# Brainstorm — {{tema}}

## Contexto
{{1-2 frases sobre o problema}}

## Divergir (gerar ideias)
- 
- 
- 
- 

## Agrupar (temas)
### Tema 1
- 

### Tema 2
- 

## Convergir (priorizar)
Top 3 ideias:
1. 
2. 
3. 

## Próximos passos
- [ ] Validar ideia 1 com usuários
- [ ] Prototipar ideia 2`,
  },
  {
    name: "Daily Checklist Pessoal",
    description: "Lista de tarefas kanban prontas para o dia",
    category: "kanban-tasks",
    icon: "trello",
    isBuiltin: true,
    content: JSON.stringify([
      "Revisar e-mails e mensagens",
      "Atualizar status no Kanban",
      "15min de leitura técnica",
      "Revisar pull requests da equipe",
      "Atualizar documentação do dia",
      "Planejar tarefas de amanhã",
    ]),
  },
  {
    name: "Onboarding de Projeto",
    description: "Tarefas para começar um novo projeto",
    category: "kanban-tasks",
    icon: "trello",
    isBuiltin: true,
    content: JSON.stringify([
      "Definir objetivo do projeto",
      "Mapear stakeholders",
      "Criar repositório / workspace",
      "Definir stack tecnológica",
      "Configurar CI/CD",
      "Criar README inicial",
      "Agendar kick-off com a equipe",
      "Definir milestones",
    ]),
  },
  {
    name: "Página de Projeto (Wiki)",
    description: "Estrutura inicial de uma página wiki de projeto",
    category: "wiki",
    icon: "wiki",
    isBuiltin: true,
    tags: ["projeto"],
    content: `# {{Nome do Projeto}}

## Visão Geral
Descreva em 1-2 frases o que é o projeto.

## Objetivos
- 

## Stack
- **Frontend:** 
- **Backend:** 
- **Infra:** 

## Arquitetura
Veja [[Arquitetura do Sistema]] para detalhes.

## Roadmap
- [ ] MVP
- [ ] v1.0
- [ ] v2.0

## Equipe
- 

## Links
- Repo: 
- Deploy: 
- Docs: 

## Decisões Importantes
- {{data}} — {{decisão}}`,
  },
];

const CATEGORY_META: Record<string, { icon: any; label: string; color: string }> = {
  note: { icon: StickyNote, label: "Nota", color: "#F59E0B" },
  doc: { icon: FileText, label: "Documento", color: "#0078D4" },
  wiki: { icon: Network, label: "Wiki", color: "#8B5CF6" },
  "kanban-tasks": { icon: Trello, label: "Tarefas", color: "#10B981" },
};

export function TemplatesApp() {
  const templates = useLiveQuery(async () => await getDb().templates.toArray(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);
  const open = useWindowStore((s) => s.open);

  // Seed built-in templates on first run
  useEffect(() => {
    (async () => {
      const existing = await getDb().templates.toArray();
      const builtinsMissing = BUILTIN_TEMPLATES.filter(
        (bt) => !existing.some((e) => e.name === bt.name && e.isBuiltin),
      );
      if (builtinsMissing.length > 0) {
        const now = new Date().toISOString();
        await getDb().templates.bulkAdd(
          builtinsMissing.map((bt) => ({
            ...bt,
            id: uid("tpl"),
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    })();
  }, []);

  async function applyTemplate(t: Template) {
    const now = new Date().toISOString();
    if (t.category === "kanban-tasks") {
      // Create multiple tasks
      try {
        const taskTitles = JSON.parse(t.content) as string[];
        const boards = await getDb().kanbanBoards.toArray();
        if (boards.length === 0) {
          notify({ app: "templates", title: "Abra o Kanban primeiro para criar o board" });
          open({ appId: "kanban", title: "Kanban", icon: null });
          return;
        }
        const board = boards[0];
        const firstCol = board.columns[0];
        if (!firstCol) return;
        let order = await getDb().kanbanTasks.where({ boardId: board.id, columnId: firstCol.id }).count();
        for (const title of taskTitles) {
          await getDb().kanbanTasks.add({
            id: uid("task"),
            boardId: board.id,
            columnId: firstCol.id,
            title: title.replace(/\{\{[^}]+\}\}/g, ""),
            order: order++,
            tags: t.tags ?? [],
            pomodoroCount: 0,
            createdAt: now,
            updatedAt: now,
          });
        }
        notify({ app: "templates", title: `✓ ${taskTitles.length} tarefas adicionadas ao Kanban` });
        open({ appId: "kanban", title: "Kanban", icon: null });
      } catch (e: any) {
        notify({ app: "templates", title: "Erro ao aplicar template", body: e.message });
      }
    } else if (t.category === "note") {
      const note = {
        id: uid("note"),
        title: t.name,
        content: t.content.replace(/\{\{[^}]+\}\}/g, ""),
        color: "#fbbf24",
        pinned: false,
        tags: t.tags ?? [],
        createdAt: now,
        updatedAt: now,
      };
      await getDb().notes.add(note);
      notify({ app: "templates", title: `Nota criada: ${t.name}` });
      open({ appId: "notes", title: "Notas", icon: null, width: 900, height: 640, payload: { noteId: note.id } });
    } else if (t.category === "doc") {
      const doc = {
        id: uid("doc"),
        title: t.name,
        blocks: [{ id: uid("b"), type: "paragraph", text: t.content }],
        createdAt: now,
        updatedAt: now,
      };
      await getDb().editorDocs.add(doc);
      notify({ app: "templates", title: `Documento criado: ${t.name}` });
      open({ appId: "editor", title: "Editor", icon: null, width: 1000, height: 720, payload: { docId: doc.id } });
    } else if (t.category === "wiki") {
      const page = {
        id: uid("wiki"),
        title: t.name,
        content: t.content.replace(/\{\{[^}]+\}\}/g, "Nome do Projeto"),
        tags: t.tags ?? [],
        createdAt: now,
        updatedAt: now,
      };
      await getDb().wikiPages.add(page);
      notify({ app: "templates", title: `Página wiki criada: ${t.name}` });
      open({ appId: "wiki", title: "Wiki", icon: null, width: 1100, height: 720, payload: { pageId: page.id } });
    }
    triggerRefresh();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Apagar este template?")) return;
    await getDb().templates.delete(id);
    triggerRefresh();
  }

  const filtered = (templates ?? []).filter((t) => filter === "all" || t.category === filter);

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Templates</h2>
          <p className="text-xs text-muted-foreground">{(templates ?? []).length} templates disponíveis</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-8 px-3 text-xs rounded-md text-white flex items-center gap-1"
          style={{ background: "var(--accent-color)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-border/40 flex items-center gap-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterChip>
        <FilterChip active={filter === "note"} onClick={() => setFilter("note")}>Notas</FilterChip>
        <FilterChip active={filter === "doc"} onClick={() => setFilter("doc")}>Docs</FilterChip>
        <FilterChip active={filter === "wiki"} onClick={() => setFilter("wiki")}>Wiki</FilterChip>
        <FilterChip active={filter === "kanban-tasks"} onClick={() => setFilter("kanban-tasks")}>Tarefas</FilterChip>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((t) => {
            const meta = CATEGORY_META[t.category];
            const Icon = meta?.icon ?? FileText;
            return (
              <div
                key={t.id}
                className="group p-4 rounded-xl bg-card border border-border/40 hover:border-border transition flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg grid place-items-center flex-shrink-0"
                    style={{ background: `${meta?.color}20`, color: meta?.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                    )}
                  </div>
                  {!t.isBuiltin && (
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {meta?.label}
                  </span>
                  {t.tags?.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      #{tag}
                    </span>
                  ))}
                  {t.isBuiltin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      built-in
                    </span>
                  )}
                </div>
                <button
                  onClick={() => applyTemplate(t)}
                  className="mt-auto h-8 rounded-md bg-muted hover:bg-muted/80 text-xs font-medium transition flex items-center justify-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Usar template
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
              Nenhum template nesta categoria
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateTemplateDialog onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-full text-xs transition",
        active ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted",
      )}
      style={active ? { background: "var(--accent-color)" } : {}}
    >
      {children}
    </button>
  );
}

function CreateTemplateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Template["category"]>("note");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);

  async function save() {
    if (!name.trim() || !content.trim()) return;
    const now = new Date().toISOString();
    await getDb().templates.add({
      id: uid("tpl"),
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      content,
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    });
    triggerRefresh();
    notify({ app: "templates", title: `Template criado: ${name}` });
    onCreated();
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Novo template</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do template"
            autoFocus
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full h-9 px-2 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          >
            <option value="note">Nota</option>
            <option value="doc">Documento (Editor)</option>
            <option value="wiki">Página Wiki</option>
            <option value="kanban-tasks">Tarefas Kanban (JSON array de títulos)</option>
          </select>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              category === "kanban-tasks"
                ? '["Tarefa 1", "Tarefa 2", "Tarefa 3"]'
                : "Conteúdo markdown... use {{placeholders}} para variáveis"
            }
            rows={10}
            className="w-full p-2 text-xs font-mono rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary resize-y"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="tags separadas por vírgula (opcional)"
            className="w-full h-9 px-3 text-sm rounded-md bg-muted/40 border border-border/60 outline-none focus:border-primary"
          />
          <button
            onClick={save}
            disabled={!name.trim() || !content.trim()}
            className="w-full h-9 text-sm font-medium rounded-md text-white disabled:opacity-50"
            style={{ background: "var(--accent-color)" }}
          >
            Criar template
          </button>
        </div>
      </div>
    </div>
  );
}
