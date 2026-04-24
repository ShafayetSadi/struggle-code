import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  DEFAULT_CONFIGS,
  type OAuthCredentials,
  type Provider,
  type ProviderAuth,
  type ProviderConfig,
  loadConfig,
} from "@struggle-ai/core";

export const CONFIG_DIR = join(homedir(), ".struggle-ai");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const AUTH_PATH = join(CONFIG_DIR, "auth.json");
export const OAUTH_PROVIDERS = new Set<Provider>(["openai-codex", "google-antigravity"]);

type StoredOAuthMap = Partial<Record<Provider, { type: "oauth" } & OAuthCredentials>>;

export async function readConfigFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeConfigFile(path: string, config: ProviderConfig): Promise<void> {
  const { onAuthRefresh: _ignored, ...serializable } = config;
  await writeJsonFile(path, serializable);
}

export async function readAuthStore(): Promise<StoredOAuthMap> {
  const raw = await readConfigFile(AUTH_PATH);
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as StoredOAuthMap;
}

async function writeAuthStore(store: StoredOAuthMap): Promise<void> {
  await writeJsonFile(AUTH_PATH, store);
}

export async function saveOAuthCredentials(provider: Provider, credentials: OAuthCredentials): Promise<void> {
  const store = await readAuthStore();
  store[provider] = { type: "oauth", ...credentials };
  await writeAuthStore(store);
}

export function attachRuntimeAuth(config: ProviderConfig, authStore: StoredOAuthMap): ProviderConfig {
  const storedAuth = authStore[config.provider];
  if (!storedAuth) {
    return config;
  }

  return {
    ...config,
    auth: {
      type: "oauth",
      credentials: {
        refresh: storedAuth.refresh,
        access: storedAuth.access,
        expires: storedAuth.expires,
        ...(storedAuth.enterpriseUrl ? { enterpriseUrl: storedAuth.enterpriseUrl } : {}),
        ...(storedAuth.projectId ? { projectId: storedAuth.projectId } : {}),
        ...(storedAuth.email ? { email: storedAuth.email } : {}),
        ...(storedAuth.accountId ? { accountId: storedAuth.accountId } : {}),
      },
    },
    onAuthRefresh: async (auth: ProviderAuth) => {
      if (auth.type === "oauth") {
        await saveOAuthCredentials(config.provider, auth.credentials);
      }
    },
  };
}

export async function getCurrentConfig(): Promise<ProviderConfig> {
  const [configValue, authStore] = await Promise.all([
    loadConfig(CONFIG_PATH, {
      env: process.env,
      readText: readConfigFile,
    }),
    readAuthStore(),
  ]);

  return attachRuntimeAuth(configValue, authStore);
}

export async function clearSavedAuth(provider: Provider): Promise<void> {
  const [currentConfig, authStore] = await Promise.all([getCurrentConfig(), readAuthStore()]);

  if (provider in authStore) {
    delete authStore[provider];
    await writeAuthStore(authStore);
  }

  if (currentConfig.provider !== provider) {
    return;
  }

  const nextConfig: ProviderConfig = {
    ...currentConfig,
    provider,
    model: currentConfig.model,
    apiKeyEnv: DEFAULT_CONFIGS[provider].apiKeyEnv,
  };
  if ("auth" in nextConfig) {
    Reflect.deleteProperty(nextConfig, "auth");
  }
  if ("onAuthRefresh" in nextConfig) {
    Reflect.deleteProperty(nextConfig, "onAuthRefresh");
  }

  await writeConfigFile(CONFIG_PATH, nextConfig);
}
