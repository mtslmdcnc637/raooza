"use client";

import type { ComponentType } from "react";
import type { WindowState } from "@/lib/os/types";
import { NotesApp } from "./notes/NotesApp";
import { PomodoroApp } from "./pomodoro/PomodoroApp";
import { KanbanApp } from "./kanban/KanbanApp";
import { EditorApp } from "./editor/EditorApp";
import { AssistantApp } from "./assistant/AssistantApp";
import { SettingsApp } from "./settings/SettingsApp";
import { FileExplorerApp } from "./fileexplorer/FileExplorerApp";
import { CalendarApp } from "./calendar/CalendarApp";
import { TimeTrackerApp } from "./timetracker/TimeTrackerApp";
import { HabitsApp } from "./habits/HabitsApp";
import { WikiApp } from "./wiki/WikiApp";
import { MDImporterApp } from "./importer/MDImporterApp";
import { MyDayApp } from "./myday/MyDayApp";
import { TemplatesApp } from "./templates/TemplatesApp";
import { SnippetsApp } from "./snippets/SnippetsApp";
import { VideoPlannerApp } from "./video/VideoPlannerApp";
import { MessagesApp } from "./messages/MessagesApp";
import { YouTubeStudioApp } from "./youtube/YouTubeStudioApp";
import { IntelApp } from "./intel/IntelApp";

export interface AppComponentProps {
  win: WindowState;
}

export const APP_REGISTRY: Record<string, { component: ComponentType<AppComponentProps> }> = {
  notes: { component: NotesApp as any },
  pomodoro: { component: PomodoroApp as any },
  kanban: { component: KanbanApp as any },
  editor: { component: EditorApp as any },
  assistant: { component: AssistantApp as any },
  settings: { component: SettingsApp as any },
  fileexplorer: { component: FileExplorerApp as any },
  calendar: { component: CalendarApp as any },
  timetracker: { component: TimeTrackerApp as any },
  habits: { component: HabitsApp as any },
  wiki: { component: WikiApp as any },
  importer: { component: MDImporterApp as any },
  myday: { component: MyDayApp as any },
  templates: { component: TemplatesApp as any },
  snippets: { component: SnippetsApp as any },
  video: { component: VideoPlannerApp as any },
  messages: { component: MessagesApp as any },
  youtube: { component: YouTubeStudioApp as any },
  intel: { component: IntelApp as any },
};
