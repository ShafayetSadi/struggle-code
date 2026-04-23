import { z } from "zod";

import type { Provider, ProviderConfig } from "./types.js";

export const DEFAULT_CONFIGS: Record<Provider, ProviderConfig> = {
  anthropic: { provider: "anthropic", model: "claude-sonnet-4-5", apiKeyEnv: "ANTHROPIC_API_KEY" },
  google: { provider: "google", model: "gemini-2.5-flash", apiKeyEnv: "GOOGLE_API_KEY" },
  openai: { provider: "openai", model: "gpt-4o", apiKeyEnv: "OPENAI_API_KEY" },
};

const providerConfigSchema = z.object({
  provider: z.enum(["anthropic", "google", "openai"]),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1),
});

export type EnvMap = Record<string, string | undefined>;

export interface LoadConfigOptions {
  env?: EnvMap;
  readText?: (path: string) => Promise<string | undefined>;
}

export function resolveProviderConfig(env: EnvMap = process.env): ProviderConfig {
  if (env.ANTHROPIC_API_KEY) {
    return DEFAULT_CONFIGS.anthropic;
  }
  if (env.GOOGLE_API_KEY || env.GEMINI_API_KEY) {
    return DEFAULT_CONFIGS.google;
  }
  if (env.OPENAI_API_KEY) {
    return DEFAULT_CONFIGS.openai;
  }
  return DEFAULT_CONFIGS.anthropic;
}

export async function loadConfig(
  configPath = "~/.struggle-ai/config.json",
  options: LoadConfigOptions = {}
): Promise<ProviderConfig> {
  const readText = options.readText;
  if (!readText) {
    return resolveProviderConfig(options.env);
  }

  const raw = await readText(configPath);
  if (!raw) {
    return resolveProviderConfig(options.env);
  }

  const parsed = JSON.parse(raw) as unknown;
  return providerConfigSchema.parse(parsed);
}
