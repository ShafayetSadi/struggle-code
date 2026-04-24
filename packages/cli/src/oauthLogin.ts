import { createInterface, type Interface } from "node:readline/promises";

import { loginAntigravity, loginOpenAICodex, type OAuthPrompt } from "@mariozechner/pi-ai/oauth";
import type { Provider } from "@struggle-ai/core";
import { InvalidArgumentError } from "commander";

import { AUTH_PATH, OAUTH_PROVIDERS, saveOAuthCredentials } from "./configStore.js";

export async function runOAuthLogin(provider: Provider): Promise<void> {
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
        onPrompt: async (prompt: string | OAuthPrompt) => {
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
