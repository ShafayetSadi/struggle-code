import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIGS, loadConfig, resolveProviderConfig } from "../src/config.js";

describe("provider config", () => {
  it("detects OpenRouter from environment when API-key providers are available", () => {
    expect(
      resolveProviderConfig({
        OPENROUTER_API_KEY: "sk-or-test",
      })
    ).toEqual(DEFAULT_CONFIGS.openrouter);
  });

  it("parses config files with OAuth auth payloads", async () => {
    const config = await loadConfig("ignored", {
      env: {},
      readText: async () =>
        JSON.stringify({
          provider: "openai-codex",
          model: "gpt-5.2-codex",
          apiKeyEnv: "OPENAI_CODEX_OAUTH",
          auth: {
            type: "oauth",
            credentials: {
              refresh: "refresh-1",
              access: "access-1",
              expires: 123,
              accountId: "acct_123",
            },
          },
        }),
    });

    expect(config).toEqual({
      provider: "openai-codex",
      model: "gpt-5.2-codex",
      apiKeyEnv: "OPENAI_CODEX_OAUTH",
      auth: {
        type: "oauth",
        credentials: {
          refresh: "refresh-1",
          access: "access-1",
          expires: 123,
          accountId: "acct_123",
        },
      },
    });
  });

  it("parses config files with stored API-key auth payloads", async () => {
    const config = await loadConfig("ignored", {
      env: {},
      readText: async () =>
        JSON.stringify({
          provider: "openrouter",
          model: "openai/gpt-oss-20b",
          apiKeyEnv: "OPENROUTER_API_KEY",
          auth: {
            type: "api-key",
            apiKey: "sk-or-test",
          },
        }),
    });

    expect(config).toEqual({
      provider: "openrouter",
      model: "openai/gpt-oss-20b",
      apiKeyEnv: "OPENROUTER_API_KEY",
      auth: {
        type: "api-key",
        apiKey: "sk-or-test",
      },
    });
  });
});
