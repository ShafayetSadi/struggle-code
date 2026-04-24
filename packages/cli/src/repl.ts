import { type Interface, createInterface } from "node:readline/promises";

import { getModels } from "@mariozechner/pi-ai";
import { DEFAULT_CONFIGS, type IO, type ProviderConfig, startSession } from "@struggle-ai/core";

import { CONFIG_PATH, clearSavedAuth, writeConfigFile } from "./configStore.js";
import { cliIO } from "./ioImpl.js";
import { Key, ProcessTerminal, TUI } from "./pi-tui/src/index.js";
import { CommandMenu } from "./repl/commandMenu.js";
import { HELP_TEXT, handleSlashCommand, parseSlashCommand, streamChunks, syncHintState } from "./repl/commands.js";
import { P, chalk, formatChunk, formatPrompt } from "./repl/formatting.js";
import { createTuiIO } from "./repl/io.js";
import { ModelMenu } from "./repl/modelMenu.js";
import { ReplScreen } from "./repl/screen.js";
import type { ReplState } from "./repl/types.js";

function stripRuntimeAuth(config: ProviderConfig): ProviderConfig {
  const nextConfig: ProviderConfig = {
    ...config,
    apiKeyEnv: DEFAULT_CONFIGS[config.provider].apiKeyEnv,
  };
  if ("auth" in nextConfig) {
    Reflect.deleteProperty(nextConfig, "auth");
  }
  if ("onAuthRefresh" in nextConfig) {
    Reflect.deleteProperty(nextConfig, "onAuthRefresh");
  }
  return nextConfig;
}

async function runReadlineFallback(options: RunReplOptions = {}): Promise<void> {
  const projectPath = options.projectPath ?? process.cwd();
  const io = options.io ?? cliIO;
  let currentConfig = options.config ?? DEFAULT_CONFIGS.anthropic;
  const session = await startSession(projectPath, io, currentConfig);
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
          const handleModelCommand = async (model?: string): Promise<string[]> => {
            const available = getModels(currentConfig.provider);
            if (!model) {
              return available.map((entry) => `${entry.id === currentConfig.model ? "*" : " "} ${entry.id}`);
            }

            if (!available.some((entry) => entry.id === model)) {
              return [`Unknown model for ${currentConfig.provider}: ${model}`];
            }

            currentConfig = {
              ...currentConfig,
              model,
              apiKeyEnv: DEFAULT_CONFIGS[currentConfig.provider].apiKeyEnv,
            };
            session.setProviderConfig(currentConfig);
            await writeConfigFile(CONFIG_PATH, currentConfig);
            return [`model set to ${currentConfig.provider}/${currentConfig.model}`];
          };
          const handleLogoutCommand = async (): Promise<string[]> => {
            const provider = currentConfig.provider;
            await clearSavedAuth(provider);
            currentConfig = stripRuntimeAuth(currentConfig);
            session.setProviderConfig(currentConfig);
            return [`logged out from ${provider}`];
          };
          const status = await handleSlashCommand(
            command,
            session,
            projectPath,
            replState,
            handleModelCommand,
            handleLogoutCommand,
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
  let currentConfig = options.config ?? DEFAULT_CONFIGS.anthropic;
  const pending: string[] = [];
  const writeLine = (value: string) => {
    pending.push(value);
  };
  const writeLines = (values: string[]) => {
    for (const v of values) writeLine(v);
  };

  const io = createTuiIO(baseIO, writeLine);
  const session = await startSession(projectPath, io, currentConfig);
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  let commandMenuOpen = false;
  let modelMenuOpen = false;

  let resolveExit: (() => void) | undefined;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  const modelLabel = `${currentConfig.provider}/${currentConfig.model}`;

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

          const selfExecuting = new Set(["/exit", "/logout", "/stuck", "/hint", "/hint 2", "/hint 3", "/trail export"]);
          if (item.value === "/model") {
            openModelMenu();
            return;
          }
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
        anchor: "bottom-center",
      }
    );
  };

  const openModelMenu = () => {
    if (modelMenuOpen) return;
    modelMenuOpen = true;

    const items = getModels(currentConfig.provider).map((model) => ({
      value: model.id,
      label: model.id,
      ...(model.id === currentConfig.model ? { description: "current" } : {}),
    }));

    const overlay = tui.showOverlay(
      new ModelMenu(
        items,
        currentConfig.model,
        (item) => {
          overlay.hide();
          modelMenuOpen = false;
          tui.setFocus(screen);
          void submitValue(`/model ${item.value}`);
        },
        () => {
          overlay.hide();
          modelMenuOpen = false;
          tui.setFocus(screen);
          tui.requestRender();
        }
      ),
      {
        width: "100%",
        minWidth: 50,
        maxHeight: 16,
        anchor: "bottom-center",
      }
    );
  };

  const refreshSessionState = () => {
    screen.setMode(session.state.mode);
    screen.setActiveSubProblem(session.state.activeSubProblem);
    screen.setModelLabel(`${currentConfig.provider}/${currentConfig.model}`);
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
        const handleModelCommand = async (model?: string): Promise<string[]> => {
          const available = getModels(currentConfig.provider);
          if (!model) {
            openModelMenu();
            return [];
          }

          if (!available.some((entry) => entry.id === model)) {
            return [`Unknown model for ${currentConfig.provider}: ${model}`];
          }

          currentConfig = {
            ...currentConfig,
            model,
            apiKeyEnv: DEFAULT_CONFIGS[currentConfig.provider].apiKeyEnv,
          };
          session.setProviderConfig(currentConfig);
          await writeConfigFile(CONFIG_PATH, currentConfig);
          return [`model set to ${currentConfig.provider}/${currentConfig.model}`];
        };
        const handleLogoutCommand = async (): Promise<string[]> => {
          const provider = currentConfig.provider;
          await clearSavedAuth(provider);
          currentConfig = stripRuntimeAuth(currentConfig);
          session.setProviderConfig(currentConfig);
          return [`logged out from ${provider}`];
        };
        if (command.kind === "help") {
          openCommandMenu();
          return;
        }
        const status = await handleSlashCommand(
          command,
          session,
          projectPath,
          replState,
          handleModelCommand,
          handleLogoutCommand,
          writeLine,
          writeLines
        );
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
