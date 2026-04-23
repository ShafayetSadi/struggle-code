import { describe, expect, it } from "vitest";

import { classifyIntentWithDeps, fallbackIntentHeuristic } from "../src/gate/classifier.js";
import type { LLMAdapter } from "../src/llm/adapter.js";
import { DEFAULT_CONFIGS } from "../src/config.js";

function createAdapter(responses: string[]): LLMAdapter {
  return {
    async complete() {
      return responses.shift() ?? "quick_help";
    },
    async *stream() {
      yield "";
    },
  };
}

describe("classifyIntent", () => {
  it.each([
    ["What's a Promise in JavaScript?", "quick_help"],
    ["Explain closures with an example", "quick_help"],
    ["How do I type a generic function in TypeScript?", "quick_help"],
    ["My useEffect runs twice in development", "debug"],
    ["Why does this endpoint keep throwing 500 errors?", "debug"],
    ["The app crashes on startup after I added auth", "debug"],
    ["Help me build a blogging website with FastAPI", "project"],
    ["Create an internal admin dashboard", "project"],
    ["I need to make a chat app for our support team", "project"],
    ["Build a REST API for inventory tracking", "project"],
  ])("routes %s to %s", async (message, expected) => {
    await expect(
      classifyIntentWithDeps(message, {
        config: DEFAULT_CONFIGS.anthropic,
        adapterFactory: () => createAdapter(["nonsense", "still-wrong"]),
        promptText: "classifier",
      })
    ).resolves.toBe(expected);
    expect(fallbackIntentHeuristic(message)).toBe(expected);
  });

  it("retries once when the model returns malformed output", async () => {
    await expect(
      classifyIntentWithDeps("Help me build a task board", {
        config: DEFAULT_CONFIGS.anthropic,
        adapterFactory: () => createAdapter(["project please", "project"]),
        promptText: "classifier",
      })
    ).resolves.toBe("project");
  });

  it("falls back to the heuristic when the adapter fails", async () => {
    await expect(
      classifyIntentWithDeps("My tests keep failing in CI", {
        config: DEFAULT_CONFIGS.anthropic,
        adapterFactory: () => ({
          async complete() {
            throw new Error("boom");
          },
          async *stream() {
            yield "";
          },
        }),
        promptText: "classifier",
      })
    ).resolves.toBe("debug");
  });
});
