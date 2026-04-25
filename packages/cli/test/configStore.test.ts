import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const originalHome = process.env.HOME;

async function withTempHome<T>(run: (home: string) => Promise<T>): Promise<T> {
  const home = await mkdtemp(join(tmpdir(), "struggle-cli-home-"));
  process.env.HOME = home;
  vi.resetModules();

  try {
    return await run(home);
  } finally {
    process.env.HOME = originalHome;
    vi.resetModules();
  }
}

afterEach(() => {
  process.env.HOME = originalHome;
});

describe("config store logout", () => {
  it("clears active provider auth from config and oauth store", async () => {
    await withTempHome(async (home) => {
      const configDir = join(home, ".struggle-ai");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.json"),
        `${JSON.stringify(
          {
            provider: "openai-codex",
            model: "codex-mini-latest",
            apiKeyEnv: "OPENAI_CODEX_OAUTH",
            auth: {
              type: "oauth",
              credentials: {
                refresh: "refresh-token",
                access: "access-token",
                expires: Date.now() + 60_000,
              },
            },
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        join(configDir, "auth.json"),
        `${JSON.stringify(
          {
            "openai-codex": {
              type: "oauth",
              refresh: "refresh-token",
              access: "access-token",
              expires: Date.now() + 60_000,
            },
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const { clearSavedAuth } = await import("../src/configStore.js");
      await clearSavedAuth("openai-codex");

      const config = JSON.parse(await readFile(join(configDir, "config.json"), "utf8")) as {
        auth?: unknown;
        provider: string;
      };
      const authStore = JSON.parse(await readFile(join(configDir, "auth.json"), "utf8")) as Record<string, unknown>;

      expect(config.provider).toBe("openai-codex");
      expect(config.auth).toBeUndefined();
      expect(authStore["openai-codex"]).toBeUndefined();
    });
  });

  it("attaches stored API-key auth for the active provider", async () => {
    await withTempHome(async (home) => {
      const configDir = join(home, ".struggle-ai");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.json"),
        `${JSON.stringify(
          {
            provider: "openrouter",
            model: "openai/gpt-oss-20b",
            apiKeyEnv: "OPENROUTER_API_KEY",
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        join(configDir, "auth.json"),
        `${JSON.stringify(
          {
            openrouter: {
              type: "api-key",
              apiKey: "sk-or-test",
            },
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const { getCurrentConfig } = await import("../src/configStore.js");
      const config = await getCurrentConfig();

      expect(config).toEqual({
        provider: "openrouter",
        model: "openai/gpt-oss-20b",
        apiKeyEnv: "OPENROUTER_API_KEY",
        auth: {
          type: "api-key",
          apiKey: "sk-or-test",
        },
        onAuthRefresh: expect.any(Function),
      });
    });
  });

  it("builds provider-specific config with stored auth when switching providers", async () => {
    await withTempHome(async (home) => {
      const configDir = join(home, ".struggle-ai");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "auth.json"),
        `${JSON.stringify(
          {
            "openai-codex": {
              type: "oauth",
              refresh: "refresh-token",
              access: "access-token",
              expires: Date.now() + 60_000,
            },
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const { getConfigForProvider } = await import("../src/configStore.js");
      const config = await getConfigForProvider("openai-codex");

      expect(config).toEqual({
        provider: "openai-codex",
        model: "gpt-5.2-codex",
        apiKeyEnv: "OPENAI_CODEX_OAUTH",
        auth: {
          type: "oauth",
          credentials: {
            refresh: "refresh-token",
            access: "access-token",
            expires: expect.any(Number),
          },
        },
        onAuthRefresh: expect.any(Function),
      });
    });
  });

  it("lists only providers with saved credentials", async () => {
    await withTempHome(async (home) => {
      const configDir = join(home, ".struggle-ai");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "auth.json"),
        `${JSON.stringify(
          {
            openrouter: {
              type: "api-key",
              apiKey: "sk-or-test",
            },
            "openai-codex": {
              type: "oauth",
              refresh: "refresh-token",
              access: "access-token",
              expires: Date.now() + 60_000,
            },
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const { listAuthenticatedProviders } = await import("../src/configStore.js");

      await expect(listAuthenticatedProviders()).resolves.toEqual(["openai-codex", "openrouter"]);
    });
  });
});
