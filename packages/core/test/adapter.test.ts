import { beforeEach, describe, expect, it, vi } from "vitest";

const completeSimple = vi.fn();
const streamSimple = vi.fn();
const getModel = vi.fn(() => ({ api: "responses" }));

vi.mock("@mariozechner/pi-ai", () => ({
  completeSimple,
  streamSimple,
  getModel,
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
    delete process.env.ANTHROPIC_API_KEY;
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
});
