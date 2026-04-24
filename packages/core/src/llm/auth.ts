import { getOAuthApiKey } from "@mariozechner/pi-ai/oauth";

import type { Provider, ProviderAuth, ProviderConfig } from "../types.js";

type OAuthBackedProvider = Extract<Provider, "openai-codex" | "google-antigravity">;

const OAUTH_PROVIDERS = new Set<OAuthBackedProvider>(["openai-codex", "google-antigravity"]);

function getApiKeyFromEnvironment(config: ProviderConfig): string {
  if (config.auth?.type === "api-key" && config.auth.apiKey) {
    return config.auth.apiKey;
  }

  const direct = process.env[config.apiKeyEnv];
  if (direct) {
    return direct;
  }

  if (config.provider === "google") {
    const fallback = process.env.GEMINI_API_KEY;
    if (fallback) {
      return fallback;
    }
  }

  throw new Error(`Missing API key: set ${config.apiKeyEnv} in your environment`);
}

function requiresOAuth(config: ProviderConfig): config is ProviderConfig & { provider: OAuthBackedProvider } {
  return OAUTH_PROVIDERS.has(config.provider as OAuthBackedProvider);
}

function toOAuthMap(config: ProviderConfig) {
  if (!config.auth || config.auth.type !== "oauth") {
    return undefined;
  }

  return {
    [config.provider]: {
      type: "oauth" as const,
      ...config.auth.credentials,
    },
  };
}

function credentialsChanged(previous: ProviderAuth | undefined, next: ProviderAuth): boolean {
  if (!previous || previous.type !== "oauth" || next.type !== "oauth") {
    return true;
  }

  return JSON.stringify(previous.credentials) !== JSON.stringify(next.credentials);
}

export async function resolveProviderApiKey(config: ProviderConfig): Promise<string> {
  if (!requiresOAuth(config)) {
    return getApiKeyFromEnvironment(config);
  }

  const auth = toOAuthMap(config);
  if (!auth) {
    throw new Error(`Missing account login for ${config.provider}: run struggle config login ${config.provider}`);
  }

  const result = await getOAuthApiKey(config.provider, auth);
  if (!result) {
    throw new Error(`Missing account login for ${config.provider}: run struggle config login ${config.provider}`);
  }

  const refreshedAuth: ProviderAuth = {
    type: "oauth",
    credentials: result.newCredentials,
  };
  if (credentialsChanged(config.auth, refreshedAuth)) {
    config.auth = refreshedAuth;
    await config.onAuthRefresh?.(refreshedAuth);
  }

  return result.apiKey;
}
