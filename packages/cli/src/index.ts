#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { DEFAULT_CONFIGS, type Provider, type ProviderConfig, loadConfig } from "@struggle-ai/core";
import { Command, InvalidArgumentError } from "commander";

import { cliIO } from "./ioImpl.js";
import { runRepl } from "./repl.js";

const CONFIG_PATH = join(process.env.USERPROFILE ?? process.cwd(), ".struggle-ai", "config.json");

async function writeConfigFile(path: string, config: ProviderConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function getCurrentConfig(): Promise<ProviderConfig> {
  return loadConfig(CONFIG_PATH, {
    env: process.env,
  });
}

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
