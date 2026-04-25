import { z } from "zod";

import type { Provider, ProviderConfig } from "./types.js";

export const DEFAULT_CONFIGS: Record<Provider, ProviderConfig> = {
  anthropic: { provider: "anthropic", model: "claude-sonnet-4-5", apiKeyEnv: "ANTHROPIC_API_KEY" },
  google: { provider: "google", model: "gemini-2.5-flash", apiKeyEnv: "GOOGLE_API_KEY" },
  openai: { provider: "openai", model: "gpt-4o", apiKeyEnv: "OPENAI_API_KEY" },
  openrouter: { provider: "openrouter", model: "openai/gpt-oss-20b", apiKeyEnv: "OPENROUTER_API_KEY" },
  "openai-codex": {
    provider: "openai-codex",
    model: "gpt-5.2-codex",
    apiKeyEnv: "OPENAI_CODEX_OAUTH",
  },
  "google-antigravity": {
    provider: "google-antigravity",
    model: "claude-sonnet-4-5",
    apiKeyEnv: "GOOGLE_ANTIGRAVITY_OAUTH",
  },
};

const oauthCredentialsSchema = z.object({
  refresh: z.string().min(1),
  access: z.string().min(1),
  expires: z.number(),
  enterpriseUrl: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
});

const providerConfigSchema = z.object({
  provider: z.enum(["anthropic", "google", "openai", "openrouter", "openai-codex", "google-antigravity"]),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1),
  auth: z
    .union([
      z.object({
        type: z.literal("oauth"),
        credentials: oauthCredentialsSchema,
      }),
      z.object({
        type: z.literal("api-key"),
        apiKey: z.string().min(1),
      }),
    ])
    .optional(),
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
  if (env.OPENROUTER_API_KEY) {
    return DEFAULT_CONFIGS.openrouter;
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
  const config = providerConfigSchema.parse(parsed);
  if (config.auth) {
    if (config.auth.type === "api-key") {
      return {
        provider: config.provider,
        model: config.model,
        apiKeyEnv: config.apiKeyEnv,
        auth: {
          type: "api-key",
          apiKey: config.auth.apiKey,
        },
      };
    }

    const credentials = config.auth.credentials;
    return {
      provider: config.provider,
      model: config.model,
      apiKeyEnv: config.apiKeyEnv,
      auth: {
        type: "oauth",
        credentials: {
          refresh: credentials.refresh,
          access: credentials.access,
          expires: credentials.expires,
          ...(credentials.enterpriseUrl ? { enterpriseUrl: credentials.enterpriseUrl } : {}),
          ...(credentials.projectId ? { projectId: credentials.projectId } : {}),
          ...(credentials.email ? { email: credentials.email } : {}),
          ...(credentials.accountId ? { accountId: credentials.accountId } : {}),
        },
      },
    };
  }
  return {
    provider: config.provider,
    model: config.model,
    apiKeyEnv: config.apiKeyEnv,
  };
}
