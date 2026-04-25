#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { getModels } from "@mariozechner/pi-ai";
import { DEFAULT_CONFIGS, type Provider, type ProviderConfig } from "@struggle-ai/core";
import { Command, InvalidArgumentError } from "commander";

import { CONFIG_PATH, clearSavedAuth, getCurrentConfig, writeConfigFile } from "./configStore.js";
import { runDaemon } from "./daemon.js";
import { cliIO } from "./ioImpl.js";
import { runProviderLogin } from "./oauthLogin.js";
import { formatPrompt, HELP_TEXT, parseSlashCommand, runRepl } from "./repl.js";

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

export async function ensureReadyConfig(options: { provider?: string; model?: string } = {}): Promise<ProviderConfig> {
  const current = await getCurrentConfig();
  const provider = options.provider ? parseProviderOrThrow(options.provider) : current.provider;

  if (provider === current.provider) {
    return {
      ...current,
      model: options.model ?? current.model,
      apiKeyEnv: DEFAULT_CONFIGS[provider].apiKeyEnv,
    };
  }

  return buildProviderConfig(provider, options.model);
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
    .option("--resume", "Resume the last chat session for this project")
    .action(async (options: { model?: string; project: string; provider?: string; resume?: boolean }) => {
      const configValue = await ensureReadyConfig(options);
      await runRepl({
        projectPath: options.project,
        io: cliIO,
        config: configValue,
        resume: options.resume ?? false,
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
    .argument("<provider>", "Provider to authenticate")
    .action(async (providerInput: string) => {
      const provider = parseProviderOrThrow(providerInput);
      await runProviderLogin(provider);
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
    .command("daemon")
    .description("Start in IPC daemon mode (used by the VS Code extension)")
    .action(async () => {
      await runDaemon();
    });

  program
    .command("repl")
    .description("Start the interactive REPL")
    .option("--project <path>", "Project path for the interactive session", process.cwd())
    .option("--provider <provider>", "Override provider for this run")
    .option("--model <model>", "Override model for this run")
    .option("--resume", "Resume the last chat session for this project")
    .action(async (options: { model?: string; project: string; provider?: string; resume?: boolean }) => {
      const configValue = await ensureReadyConfig(options);
      await runRepl({
        projectPath: options.project,
        io: cliIO,
        config: configValue,
        resume: options.resume ?? false,
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
