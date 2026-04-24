import { beforeEach, describe, expect, it, vi } from "vitest";

const completeSimple = vi.fn();
const streamSimple = vi.fn();
const getModel = vi.fn(() => ({ api: "responses" }));
const getOAuthApiKey = vi.fn();

vi.mock("@mariozechner/pi-ai", () => ({
  completeSimple,
  streamSimple,
  getModel,
  getOAuthApiKey,
}));

describe("createLLMAdapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("normalizes extracted completion text", async () => {
    completeSimple.mockResolvedValue({
      content: [
        { type: "text", text: " Hello\r\n" },
        { type: "text", text: "world \n" },
      ],
    });
    const { createLLMAdapter } = await import("../src/llm/adapter.js");
    const adapter = createLLMAdapter({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    });

    await expect(adapter.complete([{ role: "user", content: "hi" }])).resolves.toBe("Hello\nworld");
  });

  it("yields normalized streamed text deltas", async () => {
    streamSimple.mockResolvedValue(
      (async function* () {
        yield { type: "text_delta", delta: "Hello\r" };
        yield { type: "text_delta", delta: " world" };
        yield { type: "message_stop" };
      })()
    );
    const { createLLMAdapter } = await import("../src/llm/adapter.js");
    const adapter = createLLMAdapter({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    });

    const chunks: string[] = [];
    for await (const chunk of adapter.stream([{ role: "user", content: "hi" }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("throws an explicit error when the API key is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const { createLLMAdapter } = await import("../src/llm/adapter.js");
    const adapter = createLLMAdapter({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    });

    await expect(adapter.complete([{ role: "user", content: "hi" }])).rejects.toThrow(
      "Missing API key: set ANTHROPIC_API_KEY in your environment"
    );
  });

  it("uses stored API-key auth before reading environment variables", async () => {
    process.env.OPENROUTER_API_KEY = "";
    completeSimple.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });

    const { createLLMAdapter } = await import("../src/llm/adapter.js");
    const adapter = createLLMAdapter({
      provider: "openrouter",
      model: "openai/gpt-oss-20b",
      apiKeyEnv: "OPENROUTER_API_KEY",
      auth: {
        type: "api-key",
        apiKey: "stored-key",
      },
    });

    await expect(adapter.complete([{ role: "user", content: "hi" }])).resolves.toBe("ok");
    expect(completeSimple).toHaveBeenCalledWith(
      { api: "responses" },
      expect.any(Object),
      expect.objectContaining({ apiKey: "stored-key" })
    );
  });

  it("uses stored OAuth credentials for account-backed providers", async () => {
    getOAuthApiKey.mockResolvedValue({
      apiKey: "oauth-session-key",
      newCredentials: {
        refresh: "refresh-2",
        access: "access-2",
        expires: 456,
        accountId: "acct_123",
      },
    });
    completeSimple.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });

    const onAuthRefresh = vi.fn();
    const { createLLMAdapter } = await import("../src/llm/adapter.js");
    const adapter = createLLMAdapter({
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
      onAuthRefresh,
    });

    await expect(adapter.complete([{ role: "user", content: "hi" }])).resolves.toBe("ok");
    expect(getOAuthApiKey).toHaveBeenCalledWith("openai-codex", {
      "openai-codex": {
        type: "oauth",
        refresh: "refresh-1",
        access: "access-1",
        expires: 123,
        accountId: "acct_123",
      },
    });
    expect(completeSimple).toHaveBeenCalledWith(
      { api: "responses" },
      expect.any(Object),
      expect.objectContaining({ apiKey: "oauth-session-key" })
    );
    expect(onAuthRefresh).toHaveBeenCalledWith({
      type: "oauth",
      credentials: {
        refresh: "refresh-2",
        access: "access-2",
        expires: 456,
        accountId: "acct_123",
      },
    });
  });
});
