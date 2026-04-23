#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { DEFAULT_CONFIGS, type Provider, type ProviderConfig, loadConfig } from "@struggle-ai/core";
import { Command } from "commander";

import { cliIO } from "./ioImpl.js";
import { runRepl } from "./repl.js";

const CONFIG_DIR = join(homedir(), ".struggle-ai");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

async function readConfigFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

async function writeConfigFile(path: string, config: ProviderConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function getCurrentConfig(): Promise<ProviderConfig> {
  return loadConfig(CONFIG_PATH, {
    env: process.env,
    readText: readConfigFile,
  });
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("struggle")
    .description("Struggle AI CLI")
    .version("0.1.0")
    .option("--project <path>", "Project path for the interactive session", process.cwd())
    .action(async (options: { project: string }) => {
      const configValue = await getCurrentConfig();
      await runRepl({
        projectPath: options.project,
        io: cliIO,
        config: configValue,
      });
    });

  const config = program.command("config").description("Manage Struggle AI configuration");

  config
    .command("set-provider")
    .argument("<provider>", "Provider to use (anthropic, google, openai)")
    .action(async (provider: Provider) => {
      if (!(provider in DEFAULT_CONFIGS)) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      const selected = DEFAULT_CONFIGS[provider];
      await writeConfigFile(CONFIG_PATH, selected);
      process.stdout.write(`Saved provider config to ${CONFIG_PATH}\n`);
    });

  config.command("show").action(async () => {
    const configValue = await getCurrentConfig();
    process.stdout.write(`${JSON.stringify(configValue, null, 2)}\n`);
  });

  program
    .command("repl")
    .description("Start the interactive REPL")
    .option("--project <path>", "Project path for the interactive session", process.cwd())
    .action(async (options: { project: string }) => {
      const configValue = await getCurrentConfig();
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
