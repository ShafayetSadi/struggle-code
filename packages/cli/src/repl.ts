import { join, resolve } from "node:path";
import { type Interface, createInterface } from "node:readline/promises";

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

function printDivider(label: string): void {
  process.stdout.write(`\n${chalk.dim("=".repeat(14))} ${chalk.bold(label)} ${chalk.dim("=".repeat(14))}\n`);
}

function printCodeBlock(language: string, value: string): void {
  const header = chalk.cyan(`code · ${language}`);
  process.stdout.write(`\n${header}\n`);
  process.stdout.write(`${chalk.green(value.trimEnd())}\n`);
}

function printADRCard(chunk: Extract<ResponseChunk, { kind: "adr" }>): void {
  const { adr } = chunk;
  process.stdout.write(`\n${chalk.magenta.bold("ADR")} ${chalk.magenta(adr.title)}\n`);
  process.stdout.write(`${chalk.dim("Context:")} ${adr.context}\n`);
  process.stdout.write(`${chalk.dim("Decision:")} ${adr.decision}\n`);
  process.stdout.write(`${chalk.dim("Consequences:")} ${adr.consequences}\n`);
  if (adr.docLinks.length > 0) {
    process.stdout.write(`${chalk.dim("Docs:")} ${adr.docLinks.join(", ")}\n`);
  }
}

function printQuestion(text: string): void {
  process.stdout.write(`\n${chalk.yellow("?")} ${chalk.bold(text)}\n`);
}

function printSubProblem(chunk: Extract<ResponseChunk, { kind: "sub_problem" }>): void {
  process.stdout.write(
    `\n${chalk.blue.bold("Sub-problem")} ${chunk.subProblem.order + 1}: ${chunk.subProblem.description}\n`
  );
  if (chunk.subProblem.questions.length > 0) {
    for (const question of chunk.subProblem.questions) {
      process.stdout.write(`${chalk.dim("-")} ${question}\n`);
    }
  }
}

function renderChunk(chunk: ResponseChunk): void {
  switch (chunk.kind) {
    case "text":
      break;
    case "code":
      printCodeBlock(chunk.language, chunk.value);
      break;
    case "question":
      printQuestion(chunk.text);
      break;
    case "adr":
      printADRCard(chunk);
      break;
    case "checkpoint":
      printDivider(`checkpoint · ${chunk.kind2}`);
      break;
    case "sub_problem":
      printSubProblem(chunk);
      break;
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
  return chalk.bold(`struggle [${mode}]`) + chalk.dim(" › ");
}

function renderPromptContext(session: Session): void {
  const active = session.state.activeSubProblem;
  if (!active) return;

  const match = /^Design question (\d+) of (\d+)$/i.exec(active.trim());
  if (match) {
    process.stdout.write(`${chalk.dim(`Question ${match[1]} of ${match[2]}`)}\n`);
  }
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
  replState: ReplState
): Promise<"continue" | "exit"> {
  switch (command.kind) {
    case "help":
      process.stdout.write(`${HELP_TEXT}\n`);
      return "continue";
    case "exit":
      return "exit";
    case "mode":
      session.setMode(command.mode);
      syncHintState(session, replState);
      process.stdout.write(`${chalk.cyan("mode")} ${command.mode}\n`);
      return "continue";
    case "share": {
      const resolved = resolve(projectPath, command.path);
      await session.shareFile(resolved);
      process.stdout.write(`${chalk.cyan("shared")} ${resolved}\n`);
      return "continue";
    }
    case "stuck":
      await streamChunks(session.invokeStuck(), renderChunk);
      syncHintState(session, replState);
      return "continue";
    case "hint": {
      const level = command.level ?? replState.hintLevel;
      await streamChunks(session.invokeHint(level), renderChunk);
      replState.hintLevel = command.level ?? nextHintLevel(level);
      syncHintState(session, replState);
      return "continue";
    }
    case "trail-export": {
      const outputPath = command.path
        ? resolve(projectPath, command.path)
        : defaultTrailPath(projectPath, session, command.format);
      await session.exportTrail(outputPath, command.format);
      process.stdout.write(`${chalk.cyan("trail")} ${outputPath}\n`);
      return "continue";
    }
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
      renderPromptContext(session);
      const input = await rl.question(formatPrompt(session.state.mode));
      const trimmed = input.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const command = parseSlashCommand(trimmed);
        if (command) {
          const status = await handleSlashCommand(command, session, projectPath, replState);
          if (status === "exit") {
            break;
          }
          continue;
        }

        await streamChunks(session.sendMessage(trimmed), renderChunk);
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

export { HELP_TEXT };
