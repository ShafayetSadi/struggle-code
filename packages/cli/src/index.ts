#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { type Interface, createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

import { getModels, loginAntigravity, loginOpenAICodex } from "@mariozechner/pi-ai";
import { DEFAULT_CONFIGS, type Provider, type ProviderConfig } from "@struggle-ai/core";
import { Command, InvalidArgumentError } from "commander";

import {
  AUTH_PATH,
  CONFIG_PATH,
  OAUTH_PROVIDERS,
  clearSavedAuth,
  getCurrentConfig,
  saveOAuthCredentials,
  writeConfigFile,
} from "./configStore.js";
import { cliIO } from "./ioImpl.js";
import { HELP_TEXT, formatPrompt, parseSlashCommand, runRepl } from "./repl.js";

function isSupportedProvider(value: string): value is Provider {
  return value in DEFAULT_CONFIGS;
}

function parseProviderOrThrow(value: string): Provider {
  if (!isSupportedProvider(value)) {
    throw new InvalidArgumentError(`Unsupported provider: ${value}`);
  }
  return value;
}

function buildProviderConfig(provider: Provider, model?: string): ProviderConfig {
  const base = DEFAULT_CONFIGS[provider];
  return {
    ...base,
    model: model ?? base.model,
  };
}

type ProviderModel = { id: string };

function resolveProviderModels(provider: Provider): ProviderModel[] {
  return getModels(provider) as ProviderModel[];
}

async function runOAuthLogin(provider: Provider): Promise<void> {
  if (!OAUTH_PROVIDERS.has(provider)) {
    throw new InvalidArgumentError(`Provider does not support OAuth login: ${provider}`);
  }

  const rl: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const onAuth = (info: { url: string; instructions?: string }) => {
    process.stdout.write(`Open this URL to continue authentication:\n${info.url}\n`);
    if (info.instructions) {
      process.stdout.write(`${info.instructions}\n`);
    }
  };

  const onProgress = (message: string) => {
    process.stdout.write(`${message}\n`);
  };

  const onManualCodeInput = async (): Promise<string> => {
    return rl.question("Paste the redirected URL/code and press Enter: ");
  };

  try {
    if (provider === "openai-codex") {
      const credentials = await loginOpenAICodex({
        onAuth,
        onProgress,
        onManualCodeInput,
        onPrompt: async (prompt) => {
          let message = "Enter value";
          if (typeof prompt === "string") {
            message = prompt;
          } else if ("message" in prompt && typeof prompt.message === "string") {
            message = prompt.message;
          }
          return rl.question(`${message}: `);
        },
      });
      await saveOAuthCredentials(provider, credentials);
      process.stdout.write(`Saved OAuth credentials to ${AUTH_PATH}\n`);
      return;
    }

    if (provider === "google-antigravity") {
      const credentials = await loginAntigravity(onAuth, onProgress, onManualCodeInput);
      await saveOAuthCredentials(provider, credentials);
      process.stdout.write(`Saved OAuth credentials to ${AUTH_PATH}\n`);
      return;
    }

    throw new InvalidArgumentError(`OAuth login is not implemented for ${provider}`);
  } finally {
    rl.close();
  }
}

export async function ensureReadyConfig(options: { provider?: string; model?: string } = {}): Promise<ProviderConfig> {
  const current = await getCurrentConfig();
  const provider = options.provider ? parseProviderOrThrow(options.provider) : current.provider;
  const model = options.model ?? (provider === current.provider ? current.model : undefined);
  return buildProviderConfig(provider, model);
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

export { cliIO, formatPrompt, HELP_TEXT, parseSlashCommand, runRepl };
