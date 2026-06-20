"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { getDb, type KanbanBoard, type KanbanTask } from "@/lib/db/db";
import { useSystemBus } from "@/stores/systemBus";
import { Plus, Trash2, X, GripVertical, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function KanbanApp() {
  // Ensure default board exists (separate from liveQuery to avoid write-in-read error)
  useEffect(() => {
    (async () => {
      const boards = await getDb().kanbanBoards.toArray();
      if (boards.length === 0) {
        const newBoard: KanbanBoard = {
          id: uid("board"),
          title: "Meu Quadro",
          columns: [
            { id: uid("col"), title: "A Fazer", color: "#94a3b8" },
            { id: uid("col"), title: "Em Andamento", color: "#f59e0b" },
            { id: uid("col"), title: "Concluído", color: "#10b981" },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await getDb().kanbanBoards.add(newBoard);
      }
    })();
  }, []);

  const board = useLiveQuery(async () => {
    const boards = await getDb().kanbanBoards.toArray();
    return boards[0];
  }, []);

  const tasks = useLiveQuery(async () => {
    return await getDb().kanbanTasks.toArray();
  }, []);

  const triggerRefresh = useSystemBus((s) => s.triggerRefresh);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (!board) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;

  const tasksByCol = (tasks ?? []).reduce((acc, t) => {
    if (!acc[t.columnId]) acc[t.columnId] = [];
    acc[t.columnId].push(t);
    return acc;
  }, {} as Record<string, KanbanTask[]>);

  function onDragStart(e: DragStartEvent) {
    setActiveTaskId(e.active.id as string);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    const task = (tasks ?? []).find((t) => t.id === taskId);
    if (!task) return;
    // If overId is a column, move to that column
    // If overId is a task, move to that task's column (and reorder)
    let targetColumnId = overId;
    let targetOrder = 0;
    if (task.columnId !== overId && (tasks ?? []).find((t) => t.id === overId)) {
      const overTask = (tasks ?? []).find((t) => t.id === overId)!;
      targetColumnId = overTask.columnId;
      targetOrder = overTask.order;
    } else if (board.columns.find((c) => c.id === overId)) {
      targetColumnId = overId;
      const colTasks = tasksByCol[overId] ?? [];
      targetOrder = colTasks.length;
    } else {
      return;
    }
    // Shift orders
    const colTasks = (tasksByCol[targetColumnId] ?? []).filter((t) => t.id !== taskId);
    colTasks.sort((a, b) => a.order - b.order);
    colTasks.splice(targetOrder, 0, task);
    const updates = colTasks.map((t, i) => ({
      id: t.id,
      changes: { order: i, columnId: targetColumnId, updatedAt: new Date().toISOString() },
    }));
    for (const u of updates) {
      await getDb().kanbanTasks.update(u.id, u.changes);
    }
    triggerRefresh();
  }

  async function createTask(columnId: string, title: string) {
    if (!title.trim()) return;
    const colTasks = tasksByCol[columnId] ?? [];
    const task: KanbanTask = {
      id: uid("task"),
      boardId: board.id,
      columnId,
      title: title.trim(),
      order: colTasks.length,
      tags: [],
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await getDb().kanbanTasks.add(task);
    triggerRefresh();
  }

  async function deleteTask(id: string) {
    await getDb().kanbanTasks.delete(id);
    triggerRefresh();
  }

  async function addColumn() {
    if (!newColName.trim()) return;
    board.columns.push({ id: uid("col"), title: newColName.trim(), color: "#94a3b8" });
    board.updatedAt = new Date().toISOString();
    await getDb().kanbanBoards.put(board);
    setNewColName("");
    setAddingCol(false);
    triggerRefresh();
  }

  const activeTask = (tasks ?? []).find((t) => t.id === activeTaskId);

  return (
    <div className="flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{board.title}</h2>
          <p className="text-xs text-muted-foreground">
            {(tasks ?? []).length} tarefa(s) · {board.columns.length} coluna(s)
          </p>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
          <div className="flex gap-3 h-full items-start">
            {board.columns.map((col) => (
              <Column
                key={col.id}
                col={col}
                tasks={tasksByCol[col.id] ?? []}
                onCreateTask={createTask}
                onDeleteTask={deleteTask}
              />
            ))}
            {/* Add column */}
            <div className="w-72 flex-shrink-0">
              {addingCol ? (
                <div className="p-3 rounded-lg bg-card border border-border/60">
                  <input
                    autoFocus
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addColumn();
                      if (e.key === "Escape") setAddingCol(false);
                    }}
                    placeholder="Nome da coluna"
                    className="w-full h-8 px-2 text-sm bg-transparent border border-border rounded outline-none focus:border-primary"
                  />
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={addColumn}
                      className="flex-1 h-7 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => setAddingCol(false)}
                      className="h-7 px-2 text-xs rounded hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCol(true)}
                  className="w-full h-10 rounded-lg border-2 border-dashed border-border/60 text-sm text-muted-foreground hover:bg-muted/40 hover:border-border transition flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Nova coluna
                </button>
              )}
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="p-3 rounded-lg bg-card border border-border shadow-xl cursor-grabbing w-64">
              <div className="text-sm font-medium">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  col,
  tasks,
  onCreateTask,
  onDeleteTask,
}: {
  col: { id: string; title: string; color?: string };
  tasks: KanbanTask[];
  onCreateTask: (colId: string, title: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 flex-shrink-0 flex flex-col rounded-lg bg-muted/40 border border-border/40 max-h-full",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-2 h-2 rounded-full" style={{ background: col.color ?? "#94a3b8" }} />
        <span className="text-sm font-medium flex-1">{col.title}</span>
        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-background">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onDelete={onDeleteTask} />
        ))}
        {tasks.length === 0 && !adding && (
          <div className="text-center text-[10px] text-muted-foreground/60 py-4">
            Solte tarefas aqui
          </div>
        )}
      </div>
      <div className="p-2">
        {adding ? (
          <div className="p-2 rounded-lg bg-card border border-border">
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onCreateTask(col.id, title);
                  setTitle("");
                  setAdding(false);
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setTitle("");
                }
              }}
              placeholder="Título da tarefa..."
              className="w-full text-sm bg-transparent outline-none resize-none min-h-[40px]"
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => {
                  onCreateTask(col.id, title);
                  setTitle("");
                  setAdding(false);
                }}
                className="flex-1 h-7 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                Adicionar
              </button>
              <button
                onClick={() => { setAdding(false); setTitle(""); }}
                className="h-7 px-2 text-xs rounded hover:bg-muted"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full h-7 text-xs rounded text-muted-foreground hover:bg-muted/60 transition flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar tarefa
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onDelete }: { task: KanbanTask; onDelete: (id: string) => Promise<void> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group p-2.5 rounded-lg bg-card border border-border/60 cursor-grab active:cursor-grabbing hover:shadow-md transition relative",
        isDragging && "opacity-30",
      )}
      onClick={() => setShowMenu(!showMenu)}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight">{task.title}</div>
          {task.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {task.dueDate && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
            )}
            {(task.pomodoroCount ?? 0) > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {task.pomodoroCount}
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
