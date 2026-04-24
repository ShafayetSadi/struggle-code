#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { getModels, loginAntigravity, loginOpenAICodex } from "@mariozechner/pi-ai";
import { DEFAULT_CONFIGS, type Provider, type ProviderConfig } from "@struggle-ai/core";
import { Command, InvalidArgumentError } from "commander";

import {
  AUTH_PATH,
  CONFIG_PATH,
  OAUTH_PROVIDERS,
  attachRuntimeAuth,
  clearSavedAuth,
  getCurrentConfig,
  readAuthStore,
  readConfigFile,
  saveOAuthCredentials,
  writeConfigFile,
} from "./configStore.js";
import { cliIO } from "./ioImpl.js";
import { runRepl } from "./repl.js";

const STARTUP_PROVIDERS: Provider[] = [
  "openai-codex",
  "google-antigravity",
  "openrouter",
  "anthropic",
  "openai",
  "google",
];

function isSupportedProvider(value: string): value is Provider {
  return value in DEFAULT_CONFIGS;
}

function parseProviderOrThrow(value: string): Provider {
  if (!isSupportedProvider(value)) {
    throw new InvalidArgumentError(`Unsupported provider: ${value}`);
  }
  return value;
}

function resolveProviderModels(provider: Provider) {
  return getModels(provider);
}

function providerUsesOAuth(provider: Provider): boolean {
  return OAUTH_PROVIDERS.has(provider);
}

function getProviderLabel(provider: Provider): string {
  switch (provider) {
    case "openai-codex":
      return "OpenAI Codex";
    case "google-antigravity":
      return "Antigravity";
    case "openrouter":
      return "OpenRouter";
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "google":
      return "Google";
  }
}

function assertKnownModel(provider: Provider, modelId: string): void {
  const exists = resolveProviderModels(provider).some((model) => model.id === modelId);
  if (!exists) {
    throw new InvalidArgumentError(`Unknown model for ${provider}: ${modelId}`);
  }
}

function buildProviderConfig(provider: Provider, model?: string): ProviderConfig {
  const base = DEFAULT_CONFIGS[provider];
  const nextModel = model ?? base.model;
  assertKnownModel(provider, nextModel);
  return {
    ...base,
    model: nextModel,
  };
}

function hasUsableProviderAccess(config: ProviderConfig): boolean {
  if (config.auth?.type === "api-key") {
    return config.auth.apiKey.length > 0;
  }

  if (config.auth?.type === "oauth") {
    return true;
  }

  if (process.env[config.apiKeyEnv]) {
    return true;
  }

  return config.provider === "google" && Boolean(process.env.GEMINI_API_KEY);
}

export async function resolveRunConfig(options: {
  provider?: string;
  model?: string;
}): Promise<ProviderConfig> {
  const current = await getCurrentConfig();
  const provider = options.provider ? parseProviderOrThrow(options.provider) : current.provider;
  const model = options.model ?? (provider === current.provider ? current.model : undefined);
  const base = buildProviderConfig(provider, model);

  if (provider !== current.provider) {
    return attachRuntimeAuth(base, await readAuthStore());
  }

  return {
    ...current,
    provider,
    model: base.model,
    apiKeyEnv: base.apiKeyEnv,
  };
}

async function runOAuthLogin(provider: Provider): Promise<void> {
  if (!OAUTH_PROVIDERS.has(provider)) {
    throw new Error(`Provider ${provider} uses API keys, not account login`);
  }

  const prompt = async (message: string): Promise<string> => {
    process.stdout.write(`${message} `);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    return await new Promise<string>((resolve, reject) => {
      const onData = (value: string) => {
        cleanup();
        resolve(value.trim());
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdin.off("error", onError);
      };

      process.stdin.once("data", onData);
      process.stdin.once("error", onError);
    });
  };

  const onAuth = (info: { url: string; instructions?: string }) => {
    process.stdout.write(`Open this URL in your browser:\n${info.url}\n`);
    if (info.instructions) {
      process.stdout.write(`${info.instructions}\n`);
    }
  };
  const onProgress = (message: string) => {
    process.stdout.write(`${message}\n`);
  };

  const credentials =
    provider === "openai-codex"
      ? await loginOpenAICodex({
          onAuth,
          onProgress,
          onPrompt: async (oauthPrompt) => prompt(oauthPrompt.message),
        })
      : await loginAntigravity(onAuth, onProgress, async () => prompt("Paste the redirect URL after account login:"));

  await saveOAuthCredentials(provider, credentials);
  process.stdout.write(`Saved account credentials to ${AUTH_PATH}\n`);
}

async function promptText(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function chooseProviderInteractively(): Promise<Provider> {
  process.stdout.write("Choose a provider to continue:\n");
  STARTUP_PROVIDERS.forEach((provider, index) => {
    process.stdout.write(`  ${index + 1}. ${getProviderLabel(provider)}\n`);
  });

  while (true) {
    const answer = await promptText(`Enter number (1-${STARTUP_PROVIDERS.length}): `);
    const choice = Number.parseInt(answer, 10);
    if (Number.isInteger(choice) && choice >= 1 && choice <= STARTUP_PROVIDERS.length) {
      return STARTUP_PROVIDERS[choice - 1] as Provider;
    }
    process.stdout.write("Invalid selection.\n");
  }
}

async function promptForApiKey(provider: Provider): Promise<string> {
  while (true) {
    const apiKey = await promptText(`${getProviderLabel(provider)} API key: `);
    if (apiKey) {
      return apiKey;
    }
    process.stdout.write("API key cannot be empty.\n");
  }
}

async function runInteractiveSetup(requestedProvider?: Provider): Promise<ProviderConfig> {
  const provider = requestedProvider ?? (await chooseProviderInteractively());
  const config = buildProviderConfig(provider);

  if (providerUsesOAuth(provider)) {
    await runOAuthLogin(provider);
    await writeConfigFile(CONFIG_PATH, config);
    return await getCurrentConfig();
  }

  const apiKey = await promptForApiKey(provider);
  const configured: ProviderConfig = {
    ...config,
    auth: {
      type: "api-key",
      apiKey,
    },
  };
  await writeConfigFile(CONFIG_PATH, configured);
  process.stdout.write(`Saved provider config to ${CONFIG_PATH}\n`);
  return configured;
}

export async function ensureReadyConfig(options: { provider?: string; model?: string } = {}): Promise<ProviderConfig> {
  const resolved = await resolveRunConfig(options);
  if (hasUsableProviderAccess(resolved)) {
    return resolved;
  }

  const hasSavedConfig = Boolean(await readConfigFile(CONFIG_PATH));

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `No usable credentials for ${resolved.provider}. Run struggle config login ${resolved.provider} or configure ${resolved.apiKeyEnv}.`
    );
  }

  if (!hasSavedConfig && !options.provider) {
    process.stdout.write("No saved provider config found.\n");
    return await runInteractiveSetup();
  }

  process.stdout.write(`No saved login or API key found for ${getProviderLabel(resolved.provider)}.\n`);
  return await runInteractiveSetup(resolved.provider);
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("struggle")
    .description("Struggle AI CLI")
    .version("0.1.0")
    .option("--project <path>", "Project path for the interactive session", process.cwd())
    .option("--provider <provider>", "Override provider for this run")
    .option("--model <model>", "Override model for this run")
    .action(async (options: { model?: string; project: string; provider?: string }) => {
      const configValue = await ensureReadyConfig(options);
      await runRepl({
        projectPath: options.project,
        io: cliIO,
        config: configValue,
      });
    });

  const config = program.command("config").description("Manage Struggle AI configuration");

  config
    .command("set-provider")
    .argument("<provider>", "Provider to use")
    .option("--model <model>", "Optional model override for the selected provider")
    .action(async (providerInput: string, options: { model?: string }) => {
      const provider = parseProviderOrThrow(providerInput);
      const selected = buildProviderConfig(provider, options.model);
      await writeConfigFile(CONFIG_PATH, selected);
      process.stdout.write(`Saved provider config to ${CONFIG_PATH}\n`);
    });

  config
    .command("set-model")
    .argument("<model>", "Model ID for the current or selected provider")
    .option("--provider <provider>", "Provider to apply the model to")
    .action(async (model: string, options: { provider?: string }) => {
      const current = await getCurrentConfig();
      const provider = options.provider ? parseProviderOrThrow(options.provider) : current.provider;
      const nextConfig =
        provider === current.provider
          ? {
              ...current,
              model,
              apiKeyEnv: DEFAULT_CONFIGS[provider].apiKeyEnv,
            }
          : buildProviderConfig(provider, model);

      assertKnownModel(provider, nextConfig.model);
      await writeConfigFile(CONFIG_PATH, nextConfig);
      process.stdout.write(`Saved model config to ${CONFIG_PATH}\n`);
    });

  config
    .command("list-models")
    .argument("[provider]", "Provider to inspect; defaults to the active provider")
    .action(async (providerInput?: string) => {
      const current = await getCurrentConfig();
      const provider = providerInput ? parseProviderOrThrow(providerInput) : current.provider;
      const models = resolveProviderModels(provider);

      for (const model of models) {
        const marker = model.id === current.model && provider === current.provider ? "*" : " ";
        process.stdout.write(`${marker} ${model.id}\n`);
      }
    });

  config
    .command("login")
    .argument("<provider>", "OAuth provider to authenticate")
    .action(async (providerInput: string) => {
      const provider = parseProviderOrThrow(providerInput);
      await runOAuthLogin(provider);
    });

  config
    .command("logout")
    .argument("[provider]", "Provider to clear saved credentials for; defaults to the active provider")
    .action(async (providerInput?: string) => {
      const current = await getCurrentConfig();
      const provider = providerInput ? parseProviderOrThrow(providerInput) : current.provider;
      await clearSavedAuth(provider);
      process.stdout.write(`Cleared saved credentials for ${provider}\n`);
    });

  config.command("show").action(async () => {
    const configValue = await getCurrentConfig();
    process.stdout.write(`${JSON.stringify(configValue, null, 2)}\n`);
  });

  program
    .command("repl")
    .description("Start the interactive REPL")
    .option("--project <path>", "Project path for the interactive session", process.cwd())
    .option("--provider <provider>", "Override provider for this run")
    .option("--model <model>", "Override model for this run")
    .action(async (options: { model?: string; project: string; provider?: string }) => {
      const configValue = await ensureReadyConfig(options);
      await runRepl({
        projectPath: options.project,
        io: cliIO,
        config: configValue,
      });
    });

  return program;
}

export async function run(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(realpathSync(entry)).href;
}

if (isDirectExecution()) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export { cliIO } from "./ioImpl.js";
export { formatPrompt, HELP_TEXT, parseSlashCommand, runRepl } from "./repl.js";
