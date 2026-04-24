import { loginAntigravity, loginOpenAICodex, type OAuthPrompt } from "@mariozechner/pi-ai/oauth";
import { DEFAULT_CONFIGS, type Provider } from "@struggle-ai/core";
import { InvalidArgumentError } from "commander";

import { AUTH_PATH, OAUTH_PROVIDERS, saveOAuthCredentials, saveProviderAuth } from "./configStore.js";
import { copyToClipboard } from "./repl/clipboard.js";
import type { LoginIO } from "./repl/loginOverlay.js";

interface ConsoleLoginIO extends LoginIO {
  close(): void;
}

async function createConsoleLoginIO(): Promise<ConsoleLoginIO> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    close: () => rl.close(),
    prompt: (message: string) => rl.question(`${message}: `),
    writeLine: (message: string) => {
      process.stdout.write(`${message}\n`);
    },
    writeLink: (_label: string, url: string) => {
      process.stdout.write(`${url}\n`);
    },
  };
}

export async function runProviderLogin(provider: Provider, io?: LoginIO): Promise<void> {
  const loginIO = io ?? (await createConsoleLoginIO());

  const onAuth = (info: { url: string; instructions?: string }) => {
    loginIO.writeLine("Open this URL to continue authentication:");
    loginIO.writeLink("Authentication URL ready.", info.url);
    void copyToClipboard(info.url)
      .then(() => {
        loginIO.writeLine("Authentication URL copied to clipboard.");
      })
      .catch(() => {
        loginIO.writeLine("Clipboard copy unavailable. Use the browser-opened auth page or copy the URL manually.");
      });
    if (info.instructions) {
      loginIO.writeLine(info.instructions);
    }
  };

  const onProgress = (message: string) => {
    loginIO.writeLine(message);
  };

  const onManualCodeInput = async (): Promise<string> => {
    return loginIO.prompt("Paste the redirected URL/code and press Enter");
  };

  try {
    if (!OAUTH_PROVIDERS.has(provider)) {
      const envVar = DEFAULT_CONFIGS[provider].apiKeyEnv;
      const apiKey = (await loginIO.prompt(`Paste API key for ${provider} (${envVar})`)).trim();
      if (!apiKey) {
        throw new InvalidArgumentError(`API key is required for ${provider}`);
      }
      await saveProviderAuth(provider, {
        type: "api-key",
        apiKey,
      });
      loginIO.writeLine(`Saved credentials to ${AUTH_PATH}`);
      return;
    }

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
          return loginIO.prompt(message);
        },
      });
      await saveOAuthCredentials(provider, credentials);
      loginIO.writeLine(`Saved OAuth credentials to ${AUTH_PATH}`);
      return;
    }

    if (provider === "google-antigravity") {
      const credentials = await loginAntigravity(onAuth, onProgress, onManualCodeInput);
      await saveOAuthCredentials(provider, credentials);
      loginIO.writeLine(`Saved OAuth credentials to ${AUTH_PATH}`);
      return;
    }

    throw new InvalidArgumentError(`OAuth login is not implemented for ${provider}`);
  } finally {
    if ("close" in loginIO && typeof loginIO.close === "function") {
      loginIO.close();
    }
  }
}
