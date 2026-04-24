import { join, resolve } from "node:path";

import type { Mode, Session } from "@struggle-ai/core";

import { formatChunk } from "./formatting.js";
import { P, chalk } from "./palette.js";
import type { ReplState, SlashCommand } from "./types.js";

export const HELP_TEXT = `
Available commands:
  /help                     Show this help
  /mode <guided|standard|socratic>
                            Switch learning mode
  /model [model-id]         Show models or switch the current model
  /share <path>             Share a file with the active session
  /stuck                    Trigger a stuck-session intervention
  /hint [1|2|3]             Ask for a hint; defaults to the next level
  /trail export [path] [--format md|pdf]
                            Export the learning trail
  /exit                     Quit the REPL
`.trim();

function normalizeHintLevel(value: string | undefined): 1 | 2 | 3 | undefined {
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as 1 | 2 | 3;
  }
  return undefined;
}

export function parseSlashCommand(input: string): SlashCommand | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return undefined;

  const tokens = trimmed.slice(1).split(/\s+/).filter(Boolean);
  const [command, ...args] = tokens;

  switch (command) {
    case "help":
      return { kind: "help" };
    case "exit":
    case "quit":
      return { kind: "exit" };
    case "mode":
      if (args[0] === "guided" || args[0] === "standard" || args[0] === "socratic") {
        return { kind: "mode", mode: args[0] };
      }
      return { kind: "help" };
    case "model":
      return args.length > 0 ? { kind: "model", model: args.join(" ") } : { kind: "model" };
    case "share":
      if (args.length === 0) return { kind: "help" };
      return { kind: "share", path: args.join(" ") };
    case "stuck":
      return { kind: "stuck" };
    case "hint": {
      const level = normalizeHintLevel(args[0]);
      return level === undefined ? { kind: "hint" } : { kind: "hint", level };
    }
    case "trail": {
      if (args[0] !== "export") return { kind: "help" };
      const path = args.find((v) => !v.startsWith("--") && v !== "export");
      const format = args.includes("--format") && args[args.indexOf("--format") + 1] === "pdf" ? "pdf" : "md";
      return path ? { kind: "trail-export", path, format } : { kind: "trail-export", format };
    }
    default:
      return { kind: "help" };
  }
}

function nextHintLevel(current: 1 | 2 | 3): 1 | 2 | 3 {
  return current === 1 ? 2 : current === 2 ? 3 : 3;
}

export function syncHintState(session: Session, state: ReplState): void {
  if (session.state.activeMilestone !== state.lastMilestone) {
    state.lastMilestone = session.state.activeMilestone;
    state.hintLevel = 1;
  }
}

function defaultTrailPath(projectPath: string, session: Session, format: "md" | "pdf"): string {
  const suffix = format === "pdf" ? "pdf" : "md";
  return join(projectPath, ".struggle-ai", `trail-${session.state.id}.${suffix}`);
}

export async function streamChunks<T>(iterable: AsyncIterable<T>, onChunk: (chunk: T) => void): Promise<void> {
  for await (const chunk of iterable) {
    onChunk(chunk);
  }
}

export async function handleSlashCommand(
  command: SlashCommand,
  session: Session,
  projectPath: string,
  replState: ReplState,
  handleModelCommand: (model?: string) => Promise<string[]>,
  writeLine: (value: string) => void,
  writeLines: (values: string[]) => void
): Promise<"continue" | "exit"> {
  switch (command.kind) {
    case "help":
      writeLines(HELP_TEXT.split("\n"));
      return "continue";
    case "exit":
      return "exit";
    case "mode":
      session.setMode(command.mode);
      syncHintState(session, replState);
      writeLine(chalk.hex(P.blue)(`mode set to ${command.mode}`));
      return "continue";
    case "model":
      writeLines(await handleModelCommand(command.model));
      return "continue";
    case "share": {
      const resolved = resolve(projectPath, command.path);
      await session.shareFile(resolved);
      writeLine(chalk.hex(P.green)(`shared  ${resolved}`));
      return "continue";
    }
    case "stuck":
      await streamChunks(session.invokeStuck(), (chunk) => writeLines(formatChunk(chunk)));
      syncHintState(session, replState);
      return "continue";
    case "hint": {
      const level = command.level ?? replState.hintLevel;
      await streamChunks(session.invokeHint(level), (chunk) => writeLines(formatChunk(chunk)));
      replState.hintLevel = command.level ?? nextHintLevel(level);
      syncHintState(session, replState);
      return "continue";
    }
    case "trail-export": {
      const outputPath = command.path
        ? resolve(projectPath, command.path)
        : defaultTrailPath(projectPath, session, command.format);
      await session.exportTrail(outputPath, command.format);
      writeLine(chalk.hex(P.green)(`trail exported  ${outputPath}`));
      return "continue";
    }
  }
}

export type { ReplState, SlashCommand };
export type { Mode };
