"use client";

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type ProjectImport } from "@/lib/db/db";
import { useSettings } from "@/stores/settingsStore";
import { useSystemBus } from "@/stores/systemBus";
import { executeBatch } from "@/lib/ai/executor";
import { PROVIDERS, apiUrl } from "@/lib/ai/providers";
import type { WindowState, RaoozaAction } from "@/lib/os/types";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  Trash2,
  AlertCircle,
  Network,
  Trello,
  StickyNote,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "upload" | "analyzing" | "preview" | "executing" | "done" | "error";

interface ImportPreview {
  projectName: string;
  projectDescription?: string;
  tag: string;
  actions: RaoozaAction[];
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function MDImporterApp({ win }: { win: WindowState }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string>("");
  const [importId, setImportId] = useState<string | null>(null);

  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const notify = useSystemBus((s) => s.notify);

  const imports = useLiveQuery(async () => {
    return (await getDb().imports.toArray()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, []);

  // If opened with a file in payload, start analysis immediately
  useEffect(() => {
    if (win.payload?.fileName && win.payload?.content) {
      setFileName(win.payload.fileName as string);
      setFileContent(win.payload.content as string);
      analyzeFile(win.payload.fileName as string, win.payload.content as string);
    }
  }, [win.payload]);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".md") && !file.type.includes("markdown") && !file.type.includes("text")) {
      setError("Apenas arquivos .md são suportados");
      setStage("error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 2MB.`);
      setStage("error");
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setFileContent(text);
    await analyzeFile(file.name, text);
  }

  async function analyzeFile(name: string, content: string) {
    setStage("analyzing");
    setError("");
    try {
      const settingsState = useSettings.getState();
      const provider = settingsState.aiProvider;
      const apiKey = settingsState.apiKeys[provider];
      const model = settingsState.defaultModel[provider];

      // Set a client-side timeout of 4 minutes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);

      const res = await fetch(apiUrl("/api/import-md"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: name,
          content,
          provider,
          apiKey,
          model,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle non-2xx responses gracefully (server may return HTML error page from gateway)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          `Resposta inválida do servidor (${res.status}). ${res.status === 502 ? "Timeout do gateway — tente um arquivo menor." : ""}`,
        );
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || `Erro ${res.status}`);
      }
      setPreview({
        projectName: data.projectName ?? name.replace(/\.md$/i, ""),
        projectDescription: data.projectDescription,
        tag: data.tag,
        actions: data.actions ?? [],
      });
      setStage("preview");
    } catch (e: any) {
      const msg = e?.name === "AbortError"
        ? "Timeout: a IA demorou mais de 4 minutos. Tente um arquivo menor."
        : e?.message ?? String(e);
      setError(msg);
      setStage("error");
    }
  }

  async function executeImport() {
    if (!preview) return;
    setStage("executing");
    try {
      const results = await executeBatch(preview.actions);
      // Collect all created item IDs
      const items: Array<{ app: string; id: string }> = [];
      preview.actions.forEach((action, i) => {
        const result = results[i];
        if (result?.ok && result.data?.id) {
          items.push({ app: action.app, id: result.data.id });
        }
      });
      // Save import record
      const newImportId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: ProjectImport = {
        id: newImportId,
        fileName,
        projectName: preview.projectName,
        projectDescription: preview.projectDescription,
        tag: preview.tag,
        items,
        createdAt: new Date().toISOString(),
      };
      await getDb().imports.add(record);
      setImportId(newImportId);
      setStage("done");
      triggerRefresh();
      notify({
        app: "importer",
        title: `✓ ${preview.projectName} importado`,
        body: `${items.length} itens criados com tag #${preview.tag}`,
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStage("error");
    }
  }

  async function undoImport(id: string) {
    const imp = await getDb().imports.get(id);
    if (!imp) return;
    if (!confirm(`Desfazer importação de "${imp.projectName}"? Isso vai apagar ${imp.items.length} itens.`)) return;
    // Delete all items by app
    for (const item of imp.items) {
      try {
        if (item.app === "notes") await getDb().notes.delete(item.id);
        else if (item.app === "kanban") await getDb().kanbanTasks.delete(item.id);
        else if (item.app === "wiki") await getDb().wikiPages.delete(item.id);
        else if (item.app === "calendar") await getDb().calendarEvents.delete(item.id);
        else if (item.app === "editor") await getDb().editorDocs.delete(item.id);
      } catch {}
    }
    await getDb().imports.delete(id);
    triggerRefresh();
    notify({
      app: "importer",
      title: "Importação desfeita",
      body: `${imp.items.length} itens removidos`,
    });
  }

  function reset() {
    setStage("upload");
    setFileName("");
    setFileContent("");
    setPreview(null);
    setError("");
    setImportId(null);
  }

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
          <Upload className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Importar Markdown</h2>
          <p className="text-xs text-muted-foreground">Configure o ambiente a partir de um arquivo .md</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {stage === "upload" && (
          <UploadZone onFile={handleFile} />
        )}

        {stage === "analyzing" && (
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
              <div className="text-sm font-medium">Analisando {fileName}...</div>
              <div className="text-xs text-muted-foreground mt-1">A IA está extraindo a estrutura do projeto</div>
            </div>
          </div>
        )}

        {stage === "preview" && preview && (
          <PreviewView preview={preview} onCancel={reset} onConfirm={executeImport} />
        )}

        {stage === "executing" && (
          <div className="h-full grid place-items-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-primary" />
              <div className="text-sm font-medium">Criando itens...</div>
            </div>
          </div>
        )}

        {stage === "done" && preview && importId && (
          <DoneView preview={preview} importId={importId} onReset={reset} onUndo={() => undoImport(importId)} />
        )}

        {stage === "error" && (
          <div className="h-full grid place-items-center">
            <div className="text-center max-w-md">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
              <div className="text-sm font-semibold mb-1">Erro</div>
              <div className="text-xs text-muted-foreground mb-4">{error}</div>
              <button onClick={reset} className="h-9 px-4 rounded-md bg-muted hover:bg-muted/80 text-sm">
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {(imports ?? []).length > 0 && stage === "upload" && (
          <div className="mt-6 pt-4 border-t border-border/40">
            <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">Importações anteriores</div>
            <div className="space-y-1.5">
              {(imports ?? []).map((imp) => (
                <div key={imp.id} className="group p-3 rounded-lg bg-card border border-border/40">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{imp.projectName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        #{imp.tag} · {imp.items.length} itens · {new Date(imp.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <button
                      onClick={() => undoImport(imp.id)}
                      className="opacity-0 group-hover:opacity-100 h-7 px-2 rounded text-xs text-destructive hover:bg-destructive/10 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Desfazer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="max-w-md mx-auto">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "block border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
        )}
      >
        <input
          type="file"
          accept=".md,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <div className="text-sm font-medium mb-1">Arraste um arquivo .md aqui</div>
        <div className="text-xs text-muted-foreground">ou clique para selecionar · máx 2MB</div>
      </label>

      <div className="mt-6 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground mb-1.5">Como funciona:</div>
        <ul className="space-y-1 list-disc pl-4">
          <li>A IA lê o markdown e extrai a estrutura do projeto</li>
          <li>Cria 1 página wiki com o conteúdo completo</li>
          <li>Extrai tarefas de checklists, TODOs e roadmaps</li>
          <li>Cria notas com resumos das seções principais</li>
          <li>Adiciona eventos ao calendário se houver datas</li>
          <li>Tudo recebe uma tag unificadora (#nome-do-projeto)</li>
          <li>Você revisa antes de confirmar — pode desfazer a qualquer momento</li>
        </ul>
      </div>
    </div>
  );
}

function PreviewView({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Group actions by app
  const grouped = preview.actions.reduce((acc, a) => {
    if (!acc[a.app]) acc[a.app] = [];
    acc[a.app].push(a);
    return acc;
  }, {} as Record<string, RaoozaAction[]>);

  const appMeta: Record<string, { icon: any; label: string; color: string }> = {
    wiki: { icon: Network, label: "Página wiki", color: "#8B5CF6" },
    kanban: { icon: Trello, label: "Tarefa kanban", color: "#10B981" },
    notes: { icon: StickyNote, label: "Nota", color: "#F59E0B" },
    calendar: { icon: Calendar, label: "Evento", color: "#0078D4" },
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Project header */}
      <div className="p-4 rounded-xl bg-card border border-border/60 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl grid place-items-center text-white text-lg font-bold" style={{ background: "var(--accent-color)" }}>
            {preview.projectName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold">{preview.projectName}</h3>
            {preview.projectDescription && (
              <p className="text-xs text-muted-foreground mt-1">{preview.projectDescription}</p>
            )}
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              #{preview.tag}
            </div>
          </div>
        </div>
      </div>

      {/* Actions preview */}
      <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">
        Será criado ({preview.actions.length} itens)
      </div>
      <div className="space-y-2 mb-6">
        {Object.entries(grouped).map(([app, actions]) => {
          const meta = appMeta[app];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <details key={app} className="rounded-lg bg-card border border-border/40 overflow-hidden">
              <summary className="p-3 cursor-pointer hover:bg-muted/40 transition flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: meta.color }} />
                <span className="text-sm font-medium flex-1">
                  {actions.length} {meta.label}{actions.length > 1 ? "s" : ""}
                </span>
                <span className="text-[10px] text-muted-foreground">ver detalhes</span>
              </summary>
              <div className="px-3 pb-3 space-y-1.5 border-t border-border/40">
                {actions.map((a, i) => (
                  <div key={i} className="text-xs p-2 rounded bg-muted/30">
                    <div className="font-medium">{a.payload?.title ?? "Sem título"}</div>
                    {a.payload?.description && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.payload.description}</div>
                    )}
                    {a.payload?.startAt && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        📅 {new Date(a.payload.startAt).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 sticky bottom-0 bg-background/80 backdrop-blur p-3 -mx-4 border-t border-border/40">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium transition"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 h-10 rounded-md text-white text-sm font-medium transition flex items-center justify-center gap-2"
          style={{ background: "var(--accent-color)" }}
        >
          <CheckCircle2 className="w-4 h-4" />
          Importar {preview.actions.length} itens
        </button>
      </div>
    </div>
  );
}

function DoneView({
  preview,
  importId,
  onReset,
  onUndo,
}: {
  preview: ImportPreview;
  importId: string;
  onReset: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="max-w-md mx-auto text-center py-8">
      <div className="w-16 h-16 rounded-full mx-auto mb-4 grid place-items-center text-white" style={{ background: "var(--accent-color)" }}>
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{preview.projectName} importado!</h3>
      <p className="text-sm text-muted-foreground mb-1">
        {preview.actions.length} itens criados com a tag
      </p>
      <div className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium mb-6">
        #{preview.tag}
      </div>

      <div className="p-4 rounded-lg bg-muted/40 text-left mb-6">
        <div className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Wiki</span>
            <span className="font-medium">{preview.actions.filter(a => a.app === "wiki").length} página(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kanban</span>
            <span className="font-medium">{preview.actions.filter(a => a.app === "kanban").length} tarefa(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Notas</span>
            <span className="font-medium">{preview.actions.filter(a => a.app === "notes").length} nota(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Calendário</span>
            <span className="font-medium">{preview.actions.filter(a => a.app === "calendar").length} evento(s)</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onUndo}
          className="flex-1 h-10 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Desfazer
        </button>
        <button
          onClick={onReset}
          className="flex-1 h-10 rounded-md text-white text-sm font-medium transition flex items-center justify-center gap-2"
          style={{ background: "var(--accent-color)" }}
        >
          <Upload className="w-4 h-4" /> Importar outro
        </button>
      </div>
    </div>
  );
}
