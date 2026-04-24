import type { Mode } from "@struggle-ai/core";

export interface ReplState {
  hintLevel: 1 | 2 | 3;
  lastMilestone: string | undefined;
}

export type SlashCommand =
  | { kind: "help" }
  | { kind: "exit" }
  | { kind: "mode"; mode: Mode }
  | { kind: "model"; model?: string }
  | { kind: "share"; path: string }
  | { kind: "stuck" }
  | { kind: "hint"; level?: 1 | 2 | 3 }
  | { kind: "trail-export"; path?: string; format: "md" | "pdf" };

export type LogKind = "system" | "user" | "assistant" | "error";

export interface LogEntry {
  kind: LogKind;
  lines: string[];
}
