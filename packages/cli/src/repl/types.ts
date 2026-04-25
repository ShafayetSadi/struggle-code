import type { Mode } from "@struggle-ai/core";

export interface ReplState {
  lastMilestone: string | undefined;
}

export type SlashCommand =
  | { kind: "root-menu" }
  | { kind: "help" }
  | { kind: "mode-menu" }
  | { kind: "providers-menu" }
  | { kind: "copy" }
  | { kind: "clear" }
  | { kind: "new" }
  | { kind: "resume"; historyId?: string }
  | { kind: "exit" }
  | { kind: "login"; provider?: string }
  | { kind: "providers"; provider?: string }
  | { kind: "logout" }
  | { kind: "mode"; mode: Mode }
  | { kind: "model"; model?: string }
  | { kind: "stuck" }
  | { kind: "trail-export"; path?: string; format: "md" | "pdf" };

export type LogKind = "system" | "user" | "assistant" | "error";

export interface LogEntry {
  kind: LogKind;
  lines: string[];
}
