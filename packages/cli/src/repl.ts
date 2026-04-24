import { join, resolve } from "node:path";
import { type Interface, createInterface } from "node:readline/promises";

import { CURSOR_MARKER, Input, Key, ProcessTerminal, TUI, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import chalk from "chalk";

import {
  type IO,
  type Mode,
  type ProviderConfig,
  type ResponseChunk,
  type Session,
  startSession,
} from "@struggle-ai/core";

import { cliIO } from "./ioImpl.js";

interface ReplState {
  hintLevel: 1 | 2 | 3;
  lastMilestone: string | undefined;
}

type SlashCommand =
  | { kind: "help" }
  | { kind: "exit" }
  | { kind: "mode"; mode: Mode }
  | { kind: "share"; path: string }
  | { kind: "stuck" }
  | { kind: "hint"; level?: 1 | 2 | 3 }
  | { kind: "trail-export"; path?: string; format: "md" | "pdf" };

const HELP_TEXT = `
Available commands:
  /help                     Show this help
  /mode <guided|standard|full-socratic>
                            Switch learning mode
  /share <path>             Share a file with the active session
  /stuck                    Trigger a stuck-session intervention
  /hint [1|2|3]             Ask for a hint; defaults to the next level
  /trail export [path] [--format md|pdf]
                            Export the learning trail
  /exit                     Quit the REPL
`.trim();

function createDivider(label: string): string {
  return `${chalk.dim("=".repeat(14))} ${chalk.bold(label)} ${chalk.dim("=".repeat(14))}`;
}

function formatCodeBlock(language: string, value: string): string[] {
  const lines = value.trimEnd().split("\n");
  return [chalk.cyan(`code - ${language}`), ...lines.map((line) => chalk.green(line))];
}

function formatADRCard(chunk: Extract<ResponseChunk, { kind: "adr" }>): string[] {
  const { adr } = chunk;
  const lines = [
    `${chalk.magenta.bold("ADR")} ${chalk.magenta(adr.title)}`,
    `${chalk.dim("Context:")} ${adr.context}`,
    `${chalk.dim("Decision:")} ${adr.decision}`,
    `${chalk.dim("Consequences:")} ${adr.consequences}`,
  ];
  if (adr.docLinks.length > 0) {
    lines.push(`${chalk.dim("Docs:")} ${adr.docLinks.join(", ")}`);
  }
  return lines;
}

function formatQuestion(text: string): string[] {
  return [`${chalk.yellow("?")} ${chalk.bold(text)}`];
}

function formatSubProblem(chunk: Extract<ResponseChunk, { kind: "sub_problem" }>): string[] {
  const lines = [chalk.blue.bold(`Sub-problem ${chunk.subProblem.order + 1}: ${chunk.subProblem.description}`)];
  for (const question of chunk.subProblem.questions) {
    lines.push(`${chalk.dim("-")} ${question}`);
  }
  return lines;
}

function formatChunk(chunk: ResponseChunk): string[] {
  switch (chunk.kind) {
    case "text":
      return chunk.value.split("\n");
    case "code":
      return formatCodeBlock(chunk.language, chunk.value);
    case "question":
      return formatQuestion(chunk.text);
    case "adr":
      return formatADRCard(chunk);
    case "checkpoint":
      return [createDivider(`checkpoint - ${chunk.kind2}`)];
    case "sub_problem":
      return formatSubProblem(chunk);
  }
}

function normalizeHintLevel(value: string | undefined): 1 | 2 | 3 | undefined {
  if (!value) return undefined;
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as 1 | 2 | 3;
  }
  return undefined;
}

export function parseSlashCommand(input: string): SlashCommand | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }

  const tokens = trimmed.slice(1).split(/\s+/).filter(Boolean);
  const [command, ...args] = tokens;

  switch (command) {
    case "help":
      return { kind: "help" };
    case "exit":
    case "quit":
      return { kind: "exit" };
    case "mode":
      if (args[0] === "guided" || args[0] === "standard" || args[0] === "full-socratic") {
        return { kind: "mode", mode: args[0] };
      }
      return { kind: "help" };
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
      const path = args.find((value) => !value.startsWith("--") && value !== "export");
      const format = args.includes("--format") && args[args.indexOf("--format") + 1] === "pdf" ? "pdf" : "md";
      return path ? { kind: "trail-export", path, format } : { kind: "trail-export", format };
    }
    default:
      return { kind: "help" };
  }
}

export function formatPrompt(mode: Mode): string {
  return chalk.bold(`struggle [${mode}]`) + chalk.dim(" > ");
}

function nextHintLevel(current: 1 | 2 | 3): 1 | 2 | 3 {
  return current === 1 ? 2 : current === 2 ? 3 : 3;
}

function syncHintState(session: Session, state: ReplState): void {
  if (session.state.activeMilestone !== state.lastMilestone) {
    state.lastMilestone = session.state.activeMilestone;
    state.hintLevel = 1;
  }
}

function defaultTrailPath(projectPath: string, session: Session, format: "md" | "pdf"): string {
  const suffix = format === "pdf" ? "pdf" : "md";
  return join(projectPath, ".struggle-ai", `trail-${session.state.id}.${suffix}`);
}

async function streamChunks(
  iterable: AsyncIterable<ResponseChunk>,
  onChunk: (chunk: ResponseChunk) => void
): Promise<void> {
  for await (const chunk of iterable) {
    onChunk(chunk);
  }
}

export async function handleSlashCommand(
  command: SlashCommand,
  session: Session,
  projectPath: string,
  replState: ReplState,
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
      writeLine(`${chalk.cyan("mode")} ${command.mode}`);
      return "continue";
    case "share": {
      const resolved = resolve(projectPath, command.path);
      await session.shareFile(resolved);
      writeLine(`${chalk.cyan("shared")} ${resolved}`);
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
      writeLine(`${chalk.cyan("trail")} ${outputPath}`);
      return "continue";
    }
  }
}

type LogKind = "system" | "user" | "assistant" | "error";

interface LogEntry {
  kind: LogKind;
  lines: string[];
}

class ReplScreen {
  private _focused = false;
  private readonly entries: LogEntry[] = [];
  private readonly input = new Input();
  private mode: Mode;
  private activeSubProblem: string | undefined;
  private busy = false;
  private footer = chalk.dim("Enter to send, Ctrl+C to quit, /help for commands");
  private readonly onSubmitInput: (value: string) => void;

  constructor(mode: Mode, onSubmitInput: (value: string) => void) {
    this.mode = mode;
    this.onSubmitInput = onSubmitInput;
    this.input.onSubmit = (value) => {
      if (this.busy) {
        return;
      }
      this.onSubmitInput(value);
    };
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  setBusy(value: boolean): void {
    this.busy = value;
    this.footer = value
      ? chalk.dim("Working... submit is temporarily paused")
      : chalk.dim("Enter to send, Ctrl+C to quit, /help for commands");
  }

  setMode(mode: Mode): void {
    this.mode = mode;
  }

  setActiveSubProblem(value: string | undefined): void {
    this.activeSubProblem = value;
  }

  clearInput(): void {
    this.input.setValue("");
  }

  append(kind: LogKind, ...lines: string[]): void {
    const normalized = lines.flatMap((line) => line.split("\n")).filter((line, index, all) => line.length > 0 || index < all.length - 1);
    this.entries.push({ kind, lines: normalized.length > 0 ? normalized : [""] });
  }

  handleInput(data: string): void {
    this.input.handleInput(data);
  }

  invalidate(): void {
    this.input.invalidate();
  }

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    const lines: string[] = [];

    lines.push(truncateToWidth(chalk.bold("Struggle AI") + chalk.dim(" interactive mode"), safeWidth));
    lines.push(truncateToWidth(chalk.dim(`Mode: ${this.mode}`), safeWidth));

    if (this.activeSubProblem) {
      lines.push(...wrapTextWithAnsi(chalk.dim(`Context: ${this.activeSubProblem}`), safeWidth));
    }

    lines.push("");

    for (const entry of this.entries) {
      const prefix =
        entry.kind === "user"
          ? chalk.cyan("> ")
          : entry.kind === "error"
            ? chalk.red("! ")
            : entry.kind === "system"
              ? chalk.dim("- ")
              : "";

      entry.lines.forEach((line, index) => {
        const content = index === 0 ? `${prefix}${line}` : line;
        const wrapped = wrapTextWithAnsi(content, safeWidth);
        lines.push(...(wrapped.length > 0 ? wrapped : [""]));
      });
      lines.push("");
    }

    lines.push(createDivider("input"));
    lines.push(...wrapTextWithAnsi(this.footer, safeWidth));

    const inputPrompt = truncateToWidth(formatPrompt(this.mode), safeWidth);
    lines.push(inputPrompt);
    const inputLines = this.input.render(safeWidth);
    lines.push(...(inputLines.length > 0 ? inputLines : [this.focused ? CURSOR_MARKER : ""]));

    return lines;
  }
}

function createTuiIO(base: IO, writeLine: (value: string) => void): IO {
  return {
    ...base,
    notify(level, message) {
      const prefix =
        level === "info" ? chalk.cyan("[info]") : level === "warn" ? chalk.yellow("[warn]") : chalk.red("[error]");
      writeLine(`${prefix} ${message}`);
    },
    stream() {
      // Response chunks are rendered through the REPL event loop to avoid duplicate output.
    },
  };
}

async function runReadlineFallback(options: RunReplOptions = {}): Promise<void> {
  const projectPath = options.projectPath ?? process.cwd();
  const io = options.io ?? cliIO;
  const session = await startSession(projectPath, io, options.config);
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };

  const rl: Interface = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });

  process.stdout.write(`${chalk.bold("Struggle AI")} ${chalk.dim("interactive mode")}\n`);
  process.stdout.write(`${chalk.dim("Type /help for commands.")}\n`);

  try {
    while (true) {
      const active = session.state.activeSubProblem;
      if (active) {
        process.stdout.write(`${chalk.dim(`Context: ${active}`)}\n`);
      }

      const input = await rl.question(formatPrompt(session.state.mode));
      const trimmed = input.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const command = parseSlashCommand(trimmed);
        if (command) {
          const status = await handleSlashCommand(
            command,
            session,
            projectPath,
            replState,
            (line) => process.stdout.write(`${line}\n`),
            (values) => {
              for (const value of values) {
                process.stdout.write(`${value}\n`);
              }
            }
          );
          if (status === "exit") {
            break;
          }
          continue;
        }

        await streamChunks(session.sendMessage(trimmed), (chunk) => {
          for (const line of formatChunk(chunk)) {
            process.stdout.write(`${line}\n`);
          }
        });
        syncHintState(session, replState);
        process.stdout.write("\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown REPL error";
        io.notify("error", message);
      }
    }
  } finally {
    rl.close();
  }
}

export interface RunReplOptions {
  projectPath?: string;
  io?: IO;
  config?: ProviderConfig;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export async function runRepl(options: RunReplOptions = {}): Promise<void> {
  const usesCustomStreams =
    (options.input !== undefined && options.input !== process.stdin) ||
    (options.output !== undefined && options.output !== process.stdout);

  if (usesCustomStreams) {
    await runReadlineFallback(options);
    return;
  }

  const projectPath = options.projectPath ?? process.cwd();
  const baseIO = options.io ?? cliIO;
  const entries: string[] = [];
  const writeLine = (value: string) => {
    entries.push(value);
  };
  const writeLines = (values: string[]) => {
    for (const value of values) {
      writeLine(value);
    }
  };

  const io = createTuiIO(baseIO, writeLine);
  const session = await startSession(projectPath, io, options.config);
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  let resolveExit: (() => void) | undefined;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  const screen = new ReplScreen(session.state.mode, (value) => {
    void submitValue(value);
  });

  for (const line of entries) {
    screen.append("system", line);
  }
  screen.append("system", "Type /help for commands.");
  tui.addChild(screen);
  tui.setFocus(screen);

  const close = () => {
    tui.stop();
    resolveExit?.();
  };

  const refreshSessionState = () => {
    screen.setMode(session.state.mode);
    screen.setActiveSubProblem(session.state.activeSubProblem);
    screen.invalidate();
    tui.requestRender();
  };

  const flushPendingEntries = () => {
    for (const line of entries.splice(0)) {
      screen.append("system", line);
    }
  };

  const submitValue = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      screen.clearInput();
      tui.requestRender();
      return;
    }

    screen.clearInput();
    screen.append("user", trimmed);
    screen.setBusy(true);
    tui.requestRender();

    try {
      const command = parseSlashCommand(trimmed);
      if (command) {
        const status = await handleSlashCommand(command, session, projectPath, replState, writeLine, writeLines);
        flushPendingEntries();
        refreshSessionState();
        if (status === "exit") {
          close();
          return;
        }
      } else {
        await streamChunks(session.sendMessage(trimmed), (chunk) => {
          screen.append("assistant", ...formatChunk(chunk));
          tui.requestRender();
        });
        syncHintState(session, replState);
        refreshSessionState();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown REPL error";
      screen.append("error", message);
    } finally {
      screen.setBusy(false);
      flushPendingEntries();
      refreshSessionState();
    }
  };

  const removeListener = tui.addInputListener((data) => {
    if (data === Key.ctrl("c") || data === "\u0003") {
      close();
      return { consume: true };
    }
    return undefined;
  });

  try {
    refreshSessionState();
    tui.start();
    await exited;
  } finally {
    removeListener();
  }
}

export { HELP_TEXT };
