import { type Interface, createInterface } from "node:readline/promises";

import { type IO, type ProviderConfig, startSession } from "@struggle-ai/core";

import { copyToClipboard } from "./repl/clipboard.js";
import { HELP_TEXT, ROOT_MENU_TEXT, handleSlashCommand, parseSlashCommand, streamChunks, syncHintState } from "./repl/commands.js";
import { formatChunk, formatPrompt, P, chalk } from "./repl/formatting.js";
import { createTuiIO } from "./repl/io.js";
import { ProcessTerminal, TUI, Key } from "./pi-tui/src/index.js";
import { ReplScreen } from "./repl/screen.js";
import type { ReplState } from "./repl/types.js";
import { cliIO } from "./ioImpl.js";

const COMMAND_HINT = "type / for commands";

function shouldCaptureCommandOutput(kind: ReplState extends never ? never : { kind: string }["kind"]): boolean {
  return kind !== "root-menu" && kind !== "help" && kind !== "mode-menu" && kind !== "copy";
}

async function runReadlineFallback(options: RunReplOptions = {}): Promise<void> {
  const projectPath = options.projectPath ?? process.cwd();
  const io = options.io ?? cliIO;
  let session = await startSession(projectPath, io, options.config);
  let lastGeneratedText: string | undefined;
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };

  const rl: Interface = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });

  process.stdout.write(chalk.hex(P.textPrimary).bold("Struggle AI") + chalk.hex(P.textMuted)("  interactive\n"));
  process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n\n`));

  try {
    while (true) {
      const active = session.state.activeSubProblem;
      if (active) {
        process.stdout.write(chalk.hex(P.textMuted)(`context  ${active}\n`));
      }

      const input = await rl.question(formatPrompt(session.state.mode));
      const trimmed = input.trim();
      if (!trimmed) continue;

      try {
        const command = parseSlashCommand(trimmed);
        if (command) {
          if (command.kind === "copy") {
            if (!lastGeneratedText) {
              process.stdout.write(chalk.hex(P.yellow)("nothing to copy yet\n"));
              continue;
            }
            await copyToClipboard(lastGeneratedText);
            process.stdout.write(chalk.hex(P.green)("copied latest output to clipboard\n"));
            continue;
          }
          if (command.kind === "clear") {
            process.stdout.write("\x1b[2J\x1b[H");
            process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n`));
            continue;
          }
          if (command.kind === "new") {
            session = await startSession(projectPath, io, options.config);
            replState.hintLevel = 1;
            replState.lastMilestone = session.state.activeMilestone;
            process.stdout.write(chalk.hex(P.green)("started a fresh session\n"));
            process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n`));
            continue;
          }

          const commandOutput: string[] = [];
          const status = await handleSlashCommand(
            command,
            session,
            projectPath,
            replState,
            (line) => {
              commandOutput.push(line);
              process.stdout.write(`${line}\n`);
            },
            (values) => {
              commandOutput.push(...values);
              for (const v of values) process.stdout.write(`${v}\n`);
            }
          );

          if (shouldCaptureCommandOutput(command.kind) && commandOutput.length > 0) {
            lastGeneratedText = commandOutput.join("\n").trimEnd();
          }

          if (status === "exit") break;
          continue;
        }

        process.stdout.write(chalk.hex(P.textMuted)("  working...\r"));
        const responseLines: string[] = [];
        await streamChunks(session.sendMessage(trimmed), (chunk) => {
          const lines = formatChunk(chunk);
          responseLines.push(...lines);
          for (const line of lines) {
            process.stdout.write(`${line}\n`);
          }
        });
        lastGeneratedText = responseLines.join("\n").trimEnd();
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
  const pending: string[] = [];
  const writeLine = (value: string) => {
    pending.push(value);
  };
  const writeLines = (values: string[]) => {
    for (const v of values) writeLine(v);
  };

  const io = createTuiIO(baseIO, writeLine);
  let session = await startSession(projectPath, io, options.config);
  let lastGeneratedText: string | undefined;
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

  const modelLabel = options.config ? `${options.config.provider}/${options.config.model}` : "default model";

  const screen = new ReplScreen(session.state.mode, projectPath, modelLabel, (value) => {
    void submitValue(value);
  });

  for (const line of pending.splice(0)) screen.append("system", line);
  screen.append("system", COMMAND_HINT);

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

  const flushPending = () => {
    for (const line of pending.splice(0)) screen.append("system", line);
  };

  const submitValue = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      screen.clearInput();
      tui.requestRender();
      return;
    }

    try {
      const command = parseSlashCommand(trimmed);
      if (command) {
        if (command.kind === "root-menu" || command.kind === "help" || command.kind === "mode-menu") {
          screen.setInputValue(
            command.kind === "root-menu"
              ? "/"
              : command.kind === "help"
                ? "/help "
                : "/mode "
          );
          tui.requestRender();
          return;
        }

        screen.clearInput();
        screen.setBusy(true);
        tui.requestRender();

        if (command.kind === "copy") {
          if (!lastGeneratedText) {
            screen.append("system", "nothing to copy yet");
            return;
          }
          await copyToClipboard(lastGeneratedText);
          screen.append("system", "copied latest output to clipboard");
          return;
        }
        if (command.kind === "clear") {
          screen.clearEntries();
          screen.append("system", "transcript cleared");
          screen.append("system", COMMAND_HINT);
          return;
        }
        if (command.kind === "new") {
          screen.clearEntries();
          session = await startSession(projectPath, io, options.config);
          replState.hintLevel = 1;
          replState.lastMilestone = session.state.activeMilestone;
          screen.setMode(session.state.mode);
          screen.setActiveSubProblem(session.state.activeSubProblem);
          screen.append("system", "started a fresh session");
          screen.append("system", COMMAND_HINT);
          return;
        }

        const commandOutput: string[] = [];
        const trackedWriteLine = (line: string) => {
          commandOutput.push(line);
          writeLine(line);
        };
        const trackedWriteLines = (values: string[]) => {
          commandOutput.push(...values);
          writeLines(values);
        };

        const status = await handleSlashCommand(
          command,
          session,
          projectPath,
          replState,
          trackedWriteLine,
          trackedWriteLines
        );

        if (shouldCaptureCommandOutput(command.kind) && commandOutput.length > 0) {
          lastGeneratedText = commandOutput.join("\n").trimEnd();
        }

        flushPending();
        refreshSessionState();
        if (status === "exit") {
          close();
        }
        return;
      }

      screen.clearInput();
      screen.append("user", trimmed);
      screen.setBusy(true);
      screen.startThinking(() => tui.requestRender());
      tui.requestRender();

      let firstChunk = true;
      const responseLines: string[] = [];
      await streamChunks(session.sendMessage(trimmed), (chunk) => {
        if (firstChunk) {
          firstChunk = false;
          screen.stopThinking();
          screen.startStreaming(() => tui.requestRender());
        }

        const chunkLines = formatChunk(chunk);
        responseLines.push(...chunkLines);
        screen.appendStreamChunk(chunkLines.join("\n"));
        tui.requestRender();
      });

      if (firstChunk) {
        screen.stopThinking();
      }
      screen.stopStreaming();
      lastGeneratedText = responseLines.join("\n").trimEnd();

      syncHintState(session, replState);
      refreshSessionState();
    } catch (error) {
      screen.stopThinking();
      screen.stopStreaming();
      const message = error instanceof Error ? error.message : "Unknown REPL error";
      screen.append("error", message);
    } finally {
      screen.setBusy(false);
      flushPending();
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

export { HELP_TEXT, ROOT_MENU_TEXT, formatPrompt, parseSlashCommand };
