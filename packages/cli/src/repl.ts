import { createInterface, type Interface } from "node:readline/promises";

import { getModels } from "@mariozechner/pi-ai";
import { DEFAULT_CONFIGS, type IO, type Provider, type ProviderConfig, startSession } from "@struggle-ai/core";

import { CONFIG_PATH, clearSavedAuth, getCurrentConfig, OAUTH_PROVIDERS, writeConfigFile } from "./configStore.js";
import { cliIO } from "./ioImpl.js";
import { runOAuthLogin } from "./oauthLogin.js";
import { Key, ProcessTerminal, TUI } from "./pi-tui/src/index.js";
import { copyToClipboard } from "./repl/clipboard.js";
import {
  HELP_TEXT,
  handleSlashCommand,
  parseSlashCommand,
  ROOT_MENU_TEXT,
  streamChunks,
  syncHintState,
} from "./repl/commands.js";
import { chalk, formatChunk, formatPrompt, P } from "./repl/formatting.js";
import { HelpMenu } from "./repl/helpMenu.js";
import { createTuiIO } from "./repl/io.js";
import { ModeMenu } from "./repl/modeMenu.js";
import { ModelMenu } from "./repl/modelMenu.js";
import { ReplScreen } from "./repl/screen.js";
import type { ReplState, SlashCommand } from "./repl/types.js";

const COMMAND_HINT = "type / for commands";
type ModelInfo = { id: string };

function resolveModelId(requested: string, available: ModelInfo[]): string | undefined {
  const exact = available.find((entry) => entry.id === requested);
  if (exact) return exact.id;

  const lower = requested.toLowerCase();
  const caseInsensitive = available.find((entry) => entry.id.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive.id;

  const prefixMatches = available.filter((entry) => entry.id.toLowerCase().startsWith(lower));
  if (prefixMatches.length === 1) {
    return prefixMatches[0]?.id;
  }

  return undefined;
}

function formatModelOverview(provider: string, currentModel: string, available: ModelInfo[]): string[] {
  const lines = [`active model ${provider}/${currentModel}`, "available models:"];
  const limit = 20;
  for (const model of available.slice(0, limit)) {
    const marker = model.id === currentModel ? "*" : " ";
    lines.push(`${marker} ${model.id}`);
  }
  if (available.length > limit) {
    lines.push(`…and ${available.length - limit} more`);
  }
  return lines;
}

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

function shouldCaptureCommandOutput(command: SlashCommand): boolean {
  return (
    command.kind !== "root-menu" && command.kind !== "help" && command.kind !== "mode-menu" && command.kind !== "copy"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown REPL error";
}

function requiresOAuthLogin(config: ProviderConfig): boolean {
  const auth = (config as ProviderConfig & { auth?: { type?: string } }).auth;
  return OAUTH_PROVIDERS.has(config.provider) && auth?.type !== "oauth";
}

function oauthRecoveryLines(provider: string): string[] {
  return [`Missing account login for ${provider}.`, "Run: /login", `Or: struggle config login ${provider}`];
}

function isModelUnavailableMessage(message: string): boolean {
  return /no longer available|model .* not available|please switch/i.test(message.toLowerCase());
}

export interface RunReplOptions {
  projectPath?: string;
  io?: IO;
  config?: ProviderConfig;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

async function runReadlineFallback(options: RunReplOptions = {}): Promise<void> {
  const projectPath = options.projectPath ?? process.cwd();
  const io = options.io ?? cliIO;
  let currentConfig = options.config ?? DEFAULT_CONFIGS.anthropic;
  let session = await startSession(projectPath, io, currentConfig);
  let lastGeneratedText: string | undefined;
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };

  const rl: Interface = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });

  const handleModelCommand = async (model?: string): Promise<string[]> => {
    const available = getModels(currentConfig.provider) as ModelInfo[];

    if (!model) {
      return formatModelOverview(currentConfig.provider, currentConfig.model, available);
    }

    const resolvedModel = resolveModelId(model, available);
    if (!resolvedModel) {
      const suggestions = available.slice(0, 8).map((entry) => `  - ${entry.id}`);
      return [`Unknown model for ${currentConfig.provider}: ${model}`, "Try one of:", ...suggestions];
    }

    currentConfig = {
      ...currentConfig,
      model: resolvedModel,
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

  const handleLoginCommand = async (providerInput?: string): Promise<string[]> => {
    const provider = (providerInput ?? currentConfig.provider) as Provider;
    if (!OAUTH_PROVIDERS.has(provider)) {
      return [`Provider does not support OAuth login: ${provider}`];
    }

    await runOAuthLogin(provider);
    if (provider === currentConfig.provider) {
      currentConfig = await getCurrentConfig();
      session.setProviderConfig(currentConfig);
    }
    return [`logged in to ${provider}`];
  };

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
            session = await startSession(projectPath, io, currentConfig);
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
            handleModelCommand,
            handleLoginCommand,
            handleLogoutCommand,
            (line) => {
              commandOutput.push(line);
              process.stdout.write(`${line}\n`);
            },
            (values) => {
              commandOutput.push(...values);
              for (const v of values) process.stdout.write(`${v}\n`);
            }
          );

          if (shouldCaptureCommandOutput(command) && commandOutput.length > 0) {
            lastGeneratedText = commandOutput.join("\n").trimEnd();
          }

          if (status === "exit") break;
          continue;
        }

        if (requiresOAuthLogin(currentConfig)) {
          for (const line of oauthRecoveryLines(currentConfig.provider)) {
            process.stdout.write(`${chalk.hex(P.yellow)(line)}\n`);
          }
          continue;
        }

        process.stdout.write(chalk.hex(P.textMuted)("  working...\r"));
        const responseLines: string[] = [];
        await streamChunks(session.sendMessage(trimmed), (chunk) => {
          const lines = formatChunk(chunk);
          responseLines.push(...lines);
          for (const line of lines) process.stdout.write(`${line}\n`);
        });
        lastGeneratedText = responseLines.join("\n").trimEnd();
        syncHintState(session, replState);
        process.stdout.write("\n");
      } catch (error) {
        const message = getErrorMessage(error);
        io.notify("error", message);

        if (message.includes("Missing account login for")) {
          for (const line of oauthRecoveryLines(currentConfig.provider)) {
            process.stdout.write(`${chalk.hex(P.yellow)(line)}\n`);
          }
        } else if (isModelUnavailableMessage(message)) {
          process.stdout.write(`${chalk.hex(P.yellow)("The current model is unavailable.")}\n`);
          process.stdout.write(`${chalk.hex(P.textMuted)("Run /model to select a different model.")}\n`);
        }
      }
    }
  } finally {
    rl.close();
  }
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
  let session = await startSession(projectPath, io, currentConfig);
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

  const screen = new ReplScreen(
    session.state.mode,
    projectPath,
    `${currentConfig.provider}/${currentConfig.model}`,
    (value) => {
      void submitValue(value);
    }
  );

  const handleModelCommand = async (model?: string): Promise<string[]> => {
    const available = getModels(currentConfig.provider) as ModelInfo[];

    if (!model) {
      return formatModelOverview(currentConfig.provider, currentConfig.model, available);
    }

    const resolvedModel = resolveModelId(model, available);
    if (!resolvedModel) {
      const suggestions = available.slice(0, 8).map((entry) => `  - ${entry.id}`);
      return [`Unknown model for ${currentConfig.provider}: ${model}`, "Try one of:", ...suggestions];
    }

    currentConfig = {
      ...currentConfig,
      model: resolvedModel,
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

  const handleLoginCommand = async (providerInput?: string): Promise<string[]> => {
    const provider = (providerInput ?? currentConfig.provider) as Provider;
    if (!OAUTH_PROVIDERS.has(provider)) {
      return [`Provider does not support OAuth login: ${provider}`];
    }

    tui.stop();
    try {
      await runOAuthLogin(provider);
    } finally {
      tui.start();
    }

    if (provider === currentConfig.provider) {
      currentConfig = await getCurrentConfig();
      session.setProviderConfig(currentConfig);
    }
    refreshSessionState();
    return [`logged in to ${provider}`];
  };

  for (const line of pending.splice(0)) screen.append("system", line);
  screen.append("system", COMMAND_HINT);

  tui.addChild(screen);
  tui.setFocus(screen);

  const close = () => {
    tui.stop();
    resolveExit?.();
  };

  let helpMenuOpen = false;
  let modeMenuOpen = false;
  let modelMenuOpen = false;

  const openHelpMenu = () => {
    if (helpMenuOpen) return;
    helpMenuOpen = true;

    const overlay = tui.showOverlay(
      new HelpMenu(
        (item) => {
          overlay.hide();
          helpMenuOpen = false;
          tui.setFocus(screen);
          void submitValue(item.value);
        },
        () => {
          overlay.hide();
          helpMenuOpen = false;
          tui.setFocus(screen);
          tui.requestRender();
        }
      ),
      {
        width: "100%",
        minWidth: 50,
        maxHeight: 11,
        anchor: "bottom-center",
      }
    );
  };

  const openModeMenu = () => {
    if (modeMenuOpen) return;
    modeMenuOpen = true;

    const overlay = tui.showOverlay(
      new ModeMenu(
        session.state.mode,
        (item) => {
          overlay.hide();
          modeMenuOpen = false;
          tui.setFocus(screen);
          void submitValue(`/mode ${item.value}`);
        },
        () => {
          overlay.hide();
          modeMenuOpen = false;
          tui.setFocus(screen);
          tui.requestRender();
        }
      ),
      {
        width: "100%",
        minWidth: 50,
        maxHeight: 10,
        anchor: "bottom-center",
      }
    );
  };

  const openModelMenu = () => {
    if (modelMenuOpen) return;
    modelMenuOpen = true;

    const items = (getModels(currentConfig.provider) as ModelInfo[]).map((model) => ({
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

    try {
      const command = parseSlashCommand(trimmed);
      if (command) {
        if (command.kind === "root-menu") {
          screen.setInputValue("/");
          tui.requestRender();
          return;
        }
        if (command.kind === "help") {
          openHelpMenu();
          return;
        }
        if (command.kind === "mode-menu") {
          openModeMenu();
          return;
        }
        if (command.kind === "model" && (!("model" in command) || !command.model)) {
          openModelMenu();
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
          session = await startSession(projectPath, io, currentConfig);
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
          handleModelCommand,
          handleLoginCommand,
          handleLogoutCommand,
          trackedWriteLine,
          trackedWriteLines
        );

        if (shouldCaptureCommandOutput(command) && commandOutput.length > 0) {
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

      if (requiresOAuthLogin(currentConfig)) {
        for (const line of oauthRecoveryLines(currentConfig.provider)) {
          screen.append("system", line);
        }
        return;
      }

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
      const message = getErrorMessage(error);
      screen.append("error", message);

      if (message.includes("Missing account login for")) {
        for (const line of oauthRecoveryLines(currentConfig.provider)) {
          screen.append("system", line);
        }
      } else if (isModelUnavailableMessage(message)) {
        screen.append("system", "The current model is unavailable.");
        screen.append("system", "Opening model picker…");
        openModelMenu();
      }
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

export { formatPrompt, HELP_TEXT, parseSlashCommand, ROOT_MENU_TEXT };
