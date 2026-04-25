import { join, resolve } from "node:path";

import type { Mode, Session } from "@struggle-ai/core";

import { formatChunk } from "./formatting.js";
import { chalk, P } from "./palette.js";
import type { ReplState, SlashCommand } from "./types.js";

export const ROOT_MENU_TEXT = `
Commands:
  /help                     Hints & stuck commands
  /login [provider]         Show providers or authenticate one directly
  /providers [provider]     Show providers or switch the active provider
  /logout                   Clear saved credentials for the active provider
  /mode                     Show available learning modes
  /model [model-id]         Show active model or switch models
  /copy                     Copy the latest generated output
  /clear                    Clear the transcript
  /new                      Start a fresh session
  /resume                   Resume the last saved session
  /share <path>             Share a file with the active session
  /trail export [path] [--format md|pdf]
                            Export the learning trail
`.trim();

export const LOGIN_MENU_TEXT = `
Available login providers:
  /login anthropic          Save an Anthropic API key
  /login google             Save a Google Gemini API key
  /login openai             Save an OpenAI API key
  /login openrouter         Save an OpenRouter API key
  /login google-antigravity Authenticate with Google Antigravity
  /login openai-codex       Authenticate with OpenAI Codex
`.trim();

export const PROVIDERS_MENU_TEXT = `
Available providers:
  /providers anthropic          Switch to Anthropic
  /providers google             Switch to Google Gemini
  /providers openai             Switch to OpenAI
  /providers openrouter         Switch to OpenRouter
  /providers google-antigravity Switch to Google Antigravity
  /providers openai-codex       Switch to OpenAI Codex
`.trim();

export function formatProvidersMenu(providers: string[]): string[] {
  if (providers.length === 0) {
    return ["No logged-in providers yet.", "Run /login to authenticate a provider first."];
  }

  return ["Available providers:", ...providers.map((provider) => `  /providers ${provider}`)];
}

export const HELP_TEXT = `
Help commands:
  /hint [1|2|3]             Ask for a hint; defaults to the next level
  /stuck                    Trigger a stuck-session intervention
`.trim();

export const MODE_MENU_TEXT = `
Available modes:
  /mode guided              Guided learning with active nudges
  /mode standard            Balanced mode (default)
  /mode socratic            Questions only, no direct answers
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
  if (trimmed === "/") return { kind: "root-menu" };

  const tokens = trimmed.slice(1).split(/\s+/).filter(Boolean);
  const [command, ...args] = tokens;

  switch (command) {
    case "help":
      return { kind: "help" };
    case "clear":
      return { kind: "clear" };
    case "copy":
      return { kind: "copy" };
    case "new":
      return { kind: "new" };
    case "resume":
      return { kind: "resume" };
    case "exit":
    case "quit":
      return { kind: "exit" };
    case "login":
      return args.length > 0 ? { kind: "login", provider: args.join(" ") } : { kind: "login" };
    case "providers":
    case "provider":
      return args.length > 0 ? { kind: "providers", provider: args.join(" ") } : { kind: "providers-menu" };
    case "logout":
      return { kind: "logout" };
    case "model":
      return args.length > 0 ? { kind: "model", model: args.join(" ") } : { kind: "model" };
    case "mode":
      if (args.length === 0) return { kind: "mode-menu" };
      if (args[0] === "guided" || args[0] === "standard" || args[0] === "socratic") {
        return { kind: "mode", mode: args[0] as Mode };
      }
      return { kind: "mode-menu" };
    case "share":
      if (args.length === 0) return { kind: "root-menu" };
      return { kind: "share", path: args.join(" ") };
    case "stuck":
      return { kind: "stuck" };
    case "hint": {
      const level = normalizeHintLevel(args[0]);
      return level === undefined ? { kind: "hint" } : { kind: "hint", level };
    }
    case "trail": {
      if (args[0] !== "export") return { kind: "root-menu" };
      const path = args.find((v) => !v.startsWith("--") && v !== "export");
      const format = args.includes("--format") && args[args.indexOf("--format") + 1] === "pdf" ? "pdf" : "md";
      return path ? { kind: "trail-export", path, format } : { kind: "trail-export", format };
    }
    default:
      return { kind: "root-menu" };
  }
}

function nextHintLevel(current: 1 | 2 | 3): 1 | 2 | 3 {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return 3;
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
  handleLoginCommand: (provider?: string) => Promise<string[]>,
  handleProviderCommand: (provider?: string) => Promise<string[]>,
  handleLogoutCommand: () => Promise<string[]>,
  writeLine: (value: string) => void,
  writeLines: (values: string[]) => void
): Promise<"continue" | "exit"> {
  switch (command.kind) {
    case "root-menu":
      writeLines(ROOT_MENU_TEXT.split("\n"));
      return "continue";
    case "help":
      writeLines(HELP_TEXT.split("\n"));
      return "continue";
    case "mode-menu":
      writeLines(MODE_MENU_TEXT.split("\n"));
      return "continue";
    case "providers-menu":
      writeLines(await handleProviderCommand());
      return "continue";
    case "model": {
      const modelCmd = command as { kind: "model"; model?: string };
      writeLines(await handleModelCommand(modelCmd.model));
      return "continue";
    }
    case "copy":
    case "clear":
    case "new":
    case "resume":
      return "continue";
    case "exit":
      return "exit";
    case "login":
      writeLines(command.provider ? await handleLoginCommand(command.provider) : LOGIN_MENU_TEXT.split("\n"));
      return "continue";
    case "providers":
      writeLines(await handleProviderCommand(command.provider));
      return "continue";
    case "logout":
      writeLines(await handleLogoutCommand());
      return "continue";
    case "mode":
      session.setMode(command.mode);
      syncHintState(session, replState);
      writeLine(chalk.hex(P.blue)(`mode set to ${command.mode}`));
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

export type { Mode, ReplState, SlashCommand };
