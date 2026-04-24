import { type Interface, createInterface } from "node:readline/promises";

import { type IO, type ProviderConfig, startSession } from "@struggle-ai/core";

import { CommandMenu } from "./repl/commandMenu.js";
import { HELP_TEXT, handleSlashCommand, parseSlashCommand, streamChunks, syncHintState } from "./repl/commands.js";
import { formatChunk, formatPrompt, P, chalk } from "./repl/formatting.js";
import { createTuiIO } from "./repl/io.js";
import { ProcessTerminal, TUI, Key } from "./pi-tui/src/index.js";
import { ReplScreen } from "./repl/screen.js";
import type { ReplState } from "./repl/types.js";
import { cliIO } from "./ioImpl.js";

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

  process.stdout.write(chalk.hex(P.textPrimary).bold("Struggle AI") + chalk.hex(P.textMuted)("  interactive\n"));
  process.stdout.write(chalk.hex(P.textMuted)("type /help for commands\n\n"));

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
          const status = await handleSlashCommand(
            command,
            session,
            projectPath,
            replState,
            (line) => process.stdout.write(`${line}\n`),
            (values) => {
              for (const v of values) process.stdout.write(`${v}\n`);
            }
          );
          if (status === "exit") break;
          continue;
        }

        process.stdout.write(chalk.hex(P.textMuted)("  ◌  thinking…\r"));
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
  const pending: string[] = [];
  const writeLine = (value: string) => {
    pending.push(value);
  };
  const writeLines = (values: string[]) => {
    for (const v of values) writeLine(v);
  };

  const io = createTuiIO(baseIO, writeLine);
  const session = await startSession(projectPath, io, options.config);
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  let commandMenuOpen = false;

  let resolveExit: (() => void) | undefined;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  const modelLabel = options.config ? `${options.config.provider}/${options.config.model}` : "default model";

  const screen = new ReplScreen(session.state.mode, projectPath, modelLabel, (value) => {
    void submitValue(value);
  });

  for (const line of pending.splice(0)) screen.append("system", line);
  screen.append("system", "type /help for commands");

  tui.addChild(screen);
  tui.setFocus(screen);

  const close = () => {
    tui.stop();
    resolveExit?.();
  };

  const openCommandMenu = () => {
    if (commandMenuOpen) return;
    commandMenuOpen = true;

    const overlay = tui.showOverlay(
      new CommandMenu(
        (item) => {
          overlay.hide();
          commandMenuOpen = false;
          tui.setFocus(screen);

          const selfExecuting = new Set(["/exit", "/stuck", "/hint", "/hint 2", "/hint 3", "/trail export"]);
          if (selfExecuting.has(item.value) || item.value.startsWith("/mode ")) {
            void submitValue(item.value);
            return;
          }
          screen.setInputValue(item.value);
          tui.requestRender();
        },
        () => {
          overlay.hide();
          commandMenuOpen = false;
          tui.setFocus(screen);
          tui.requestRender();
        }
      ),
      {
        width: "100%",
        minWidth: 50,
        maxHeight: 18,
        anchor: "top-center",
        offsetY: -8,
      }
    );
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

    screen.clearInput();
    screen.append("user", trimmed);
    screen.setBusy(true);
    tui.requestRender();

    try {
      const command = parseSlashCommand(trimmed);
      if (command) {
        if (command.kind === "help") {
          openCommandMenu();
          return;
        }
        const status = await handleSlashCommand(command, session, projectPath, replState, writeLine, writeLines);
        flushPending();
        refreshSessionState();
        if (status === "exit") {
          close();
          return;
        }
      } else {
        screen.startThinking(() => tui.requestRender());
        tui.requestRender();

        let firstChunk = true;

        await streamChunks(session.sendMessage(trimmed), (chunk) => {
          if (firstChunk) {
            firstChunk = false;
            screen.stopThinking();
            screen.startStreaming(() => tui.requestRender());
          }

          const chunkLines = formatChunk(chunk);
          screen.appendStreamChunk(chunkLines.join("\n"));
          tui.requestRender();
        });

        if (firstChunk) {
          screen.stopThinking();
        }
        screen.stopStreaming();

        syncHintState(session, replState);
        refreshSessionState();
      }
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

export { HELP_TEXT, formatPrompt, parseSlashCommand };
