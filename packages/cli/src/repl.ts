import { createInterface, type Interface } from "node:readline/promises";

import { getModels } from "@mariozechner/pi-ai";
import { DEFAULT_CONFIGS, type IO, type Provider, type ProviderConfig, startSession } from "@struggle-ai/core";

import {
  CONFIG_PATH,
  clearSavedAuth,
  getConfigForProvider,
  listAuthenticatedProviders,
  OAUTH_PROVIDERS,
  writeConfigFile,
} from "./configStore.js";
import { cliIO } from "./ioImpl.js";
import { loadHistory, saveHistory } from "./historyStore.js";
import { runProviderLogin } from "./oauthLogin.js";
import { Key, ProcessTerminal, TUI } from "./pi-tui/src/index.js";
import { openUrlInBrowser } from "./repl/browser.js";
import { copyToClipboard } from "./repl/clipboard.js";
import { setAvailableProviders } from "./repl/commandMenu.js";
import {
  formatProvidersMenu,
  HELP_TEXT,
  handleSlashCommand,
  parseSlashCommand,
  ROOT_MENU_TEXT,
  streamChunks,
  syncHintState,
} from "./repl/commands.js";
import { chalk, formatChunk, formatPrompt, P } from "./repl/formatting.js";
import { createTuiIO } from "./repl/io.js";
import { LoginOverlay } from "./repl/loginOverlay.js";
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
  resume?: boolean;
}

async function runReadlineFallback(options: RunReplOptions = {}): Promise<void> {
  const projectPath = options.projectPath ?? process.cwd();
  const io = options.io ?? cliIO;
  let currentConfig = options.config ?? DEFAULT_CONFIGS.anthropic;
  const initialMessages = options.resume ? (await loadHistory(projectPath)) ?? undefined : undefined;
  let session = await startSession(projectPath, io, currentConfig, initialMessages);
  setAvailableProviders(await listAuthenticatedProviders());
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
    setAvailableProviders(await listAuthenticatedProviders());
    return [`logged out from ${provider}`];
  };

  const handleLoginCommand = async (providerInput?: string): Promise<string[]> => {
    if (!providerInput) {
      return [
        "Available login providers:",
        "  /login anthropic",
        "  /login google",
        "  /login openai",
        "  /login openrouter",
        "  /login google-antigravity",
        "  /login openai-codex",
      ];
    }

    const provider = providerInput as Provider;
    await runProviderLogin(provider);
    currentConfig = await getConfigForProvider(provider);
    session.setProviderConfig(currentConfig);
    await writeConfigFile(CONFIG_PATH, currentConfig);
    setAvailableProviders(await listAuthenticatedProviders());
    return [`logged in to ${provider}`, `active provider set to ${provider}/${currentConfig.model}`];
  };

  const handleProviderCommand = async (providerInput?: string): Promise<string[]> => {
    if (!providerInput) {
      return formatProvidersMenu(await listAuthenticatedProviders());
    }

    const provider = providerInput as Provider;
    currentConfig = await getConfigForProvider(provider);
    session.setProviderConfig(currentConfig);
    await writeConfigFile(CONFIG_PATH, currentConfig);
    return [`active provider set to ${provider}`, `current model ${currentConfig.provider}/${currentConfig.model}`];
  };

  process.stdout.write(chalk.hex(P.textPrimary).bold("Struggle AI") + chalk.hex(P.textMuted)("  interactive\n"));
  process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n\n`));
  if (options.resume) {
    if (initialMessages) {
      process.stdout.write(chalk.hex(P.textMuted)(`resumed ${initialMessages.length} messages from last session\n\n`));
    } else {
      process.stdout.write(chalk.hex(P.textMuted)("no saved history for this project — starting fresh\n\n"));
    }
  }

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
          if (command.kind === "resume") {
            const resumedMessages = (await loadHistory(projectPath)) ?? undefined;
            session = await startSession(projectPath, io, currentConfig, resumedMessages);
            replState.hintLevel = 1;
            replState.lastMilestone = session.state.activeMilestone;
            if (resumedMessages) {
              process.stdout.write(chalk.hex(P.green)(`resumed ${resumedMessages.length} messages from last session\n`));
            } else {
              process.stdout.write(chalk.hex(P.textMuted)("no saved history for this project — starting fresh\n"));
            }
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
            handleProviderCommand,
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
        void saveHistory(projectPath, session.getMessages()).catch((err: unknown) => {
          io.notify("warn", `failed to save history: ${getErrorMessage(err)}`);
        });
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
  const initialMessages = options.resume ? (await loadHistory(projectPath)) ?? undefined : undefined;
  let session = await startSession(projectPath, io, currentConfig, initialMessages);
  setAvailableProviders(await listAuthenticatedProviders());
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
    setAvailableProviders(await listAuthenticatedProviders());
    return [`logged out from ${provider}`];
  };

  const handleLoginCommand = async (providerInput?: string): Promise<string[]> => {
    if (!providerInput) {
      return [
        "Available login providers:",
        "  /login anthropic",
        "  /login google",
        "  /login openai",
        "  /login openrouter",
        "  /login google-antigravity",
        "  /login openai-codex",
      ];
    }

    const provider = providerInput as Provider;
    const loginOverlay = new LoginOverlay(() => tui.requestRender(), {
      copyAuthUrl: copyToClipboard,
      openAuthUrl: openUrlInBrowser,
    });
    loginOverlay.writeLine(`Logging in to ${provider}...`);
    const overlay = tui.showOverlay(loginOverlay, {
      width: "100%",
      minWidth: 64,
      maxHeight: 16,
      anchor: "bottom-center",
    });
    try {
      await runProviderLogin(provider, loginOverlay);
    } finally {
      overlay.hide();
      tui.setFocus(screen);
      tui.requestRender();
    }

    currentConfig = await getConfigForProvider(provider);
    session.setProviderConfig(currentConfig);
    await writeConfigFile(CONFIG_PATH, currentConfig);
    setAvailableProviders(await listAuthenticatedProviders());
    refreshSessionState();
    return [`logged in to ${provider}`, `active provider set to ${provider}/${currentConfig.model}`];
  };

  const handleProviderCommand = async (providerInput?: string): Promise<string[]> => {
    if (!providerInput) {
      return formatProvidersMenu(await listAuthenticatedProviders());
    }

    const provider = providerInput as Provider;
    currentConfig = await getConfigForProvider(provider);
    session.setProviderConfig(currentConfig);
    await writeConfigFile(CONFIG_PATH, currentConfig);
    setAvailableProviders(await listAuthenticatedProviders());
    refreshSessionState();
    return [`active provider set to ${provider}`, `current model ${currentConfig.provider}/${currentConfig.model}`];
  };

  for (const line of pending.splice(0)) screen.append("system", line);
  screen.append("system", COMMAND_HINT);
  if (options.resume) {
    if (initialMessages) {
      screen.append("system", `resumed ${initialMessages.length} messages from last session`);
    } else {
      screen.append("system", "no saved history for this project — starting fresh");
    }
  }

  tui.addChild(screen);
  tui.setFocus(screen);

  const close = () => {
    tui.stop();
    resolveExit?.();
  };

  let modelMenuOpen = false;
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
          screen.setInputValue("/help ");
          tui.requestRender();
          return;
        }
        if (command.kind === "login" && !("provider" in command && command.provider)) {
          screen.setInputValue("/login ");
          tui.requestRender();
          return;
        }
        if (command.kind === "providers-menu") {
          screen.setInputValue("/providers ");
          tui.requestRender();
          return;
        }
        if (command.kind === "mode-menu") {
          screen.setInputValue("/mode ");
          tui.requestRender();
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
        if (command.kind === "resume") {
          screen.clearEntries();
          const resumedMessages = (await loadHistory(projectPath)) ?? undefined;
          session = await startSession(projectPath, io, currentConfig, resumedMessages);
          replState.hintLevel = 1;
          replState.lastMilestone = session.state.activeMilestone;
          screen.setMode(session.state.mode);
          screen.setActiveSubProblem(session.state.activeSubProblem);
          const notice = resumedMessages
            ? `resumed ${resumedMessages.length} messages from last session`
            : "no saved history for this project — starting fresh";
          screen.append("system", notice);
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
          handleProviderCommand,
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
      void saveHistory(projectPath, session.getMessages()).catch((err: unknown) => {
        baseIO.notify("warn", `failed to save history: ${getErrorMessage(err)}`);
      });

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
