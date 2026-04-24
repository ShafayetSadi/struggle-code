import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentEvent } from "@mariozechner/pi-agent-core";

vi.mock("@mariozechner/pi-ai", () => ({
  getModel: vi.fn(() => ({
    api: "anthropic-messages",
    provider: "anthropic",
    id: "fake-model",
    name: "fake-model",
    baseUrl: "https://example.com",
    reasoning: true,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 200_000,
    maxTokens: 8_000,
  })),
}));

vi.mock("@mariozechner/pi-agent-core", () => {
  class MockAgent {
    static events: AgentEvent[] = [];
    static instances: MockAgent[] = [];

    listeners = new Set<(event: AgentEvent) => void>();
    systemPrompt = "";
    thinkingLevel = "medium";
    tools: unknown[] = [];
    messages: string[] = [];

    constructor(options?: {
      initialState?: {
        systemPrompt?: string;
        thinkingLevel?: string;
        tools?: unknown[];
      };
    }) {
      this.systemPrompt = options?.initialState?.systemPrompt ?? "";
      this.thinkingLevel = options?.initialState?.thinkingLevel ?? "medium";
      this.tools = options?.initialState?.tools ?? [];
      MockAgent.instances.push(this);
    }

    subscribe(fn: (event: AgentEvent) => void) {
      this.listeners.add(fn);
      return () => {
        this.listeners.delete(fn);
      };
    }

    setSystemPrompt(value: string) {
      this.systemPrompt = value;
    }

    setThinkingLevel(value: string) {
      this.thinkingLevel = value;
    }

    async prompt(message: string) {
      this.messages.push(message);
      for (const event of MockAgent.events) {
        for (const listener of this.listeners) {
          listener(event);
        }
      }
    }
  }

  return { Agent: MockAgent };
});

import { startSession } from "../src/index.js";
import { MemoryIO, collectChunks } from "./test-helpers.js";

const MockAgentClass = (await import("@mariozechner/pi-agent-core")).Agent as unknown as {
  events: AgentEvent[];
  instances: Array<{
    systemPrompt: string;
    thinkingLevel: string;
    tools: Array<{ name: string }>;
    messages: string[];
  }>;
};

describe("coding agent session", () => {
  beforeEach(() => {
    MockAgentClass.events = [];
    MockAgentClass.instances.length = 0;
  });

  it("streams tool activity and the final assistant response as text chunks", async () => {
    MockAgentClass.events = [
      {
        type: "tool_execution_start",
        toolCallId: "1",
        toolName: "read_file",
        args: { path: "src/index.ts" },
      },
      {
        type: "tool_execution_end",
        toolCallId: "1",
        toolName: "read_file",
        result: { ok: true },
        isError: false,
      },
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Implemented the change." }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "fake-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        },
      },
      {
        type: "turn_end",
        message: {
          role: "assistant",
          content: [],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "fake-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        },
        toolResults: [
          {
            role: "toolResult",
            toolCallId: "1",
            toolName: "read_file",
            content: [{ type: "text", text: "..." }],
            isError: false,
            timestamp: Date.now(),
          },
        ],
      },
    ];

    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    const chunks = await collectChunks(session.sendMessage("Inspect src/index.ts and implement the fix"));

    expect(chunks).toEqual([
      { kind: "text", value: "[tool] read_file src/index.ts\n" },
      { kind: "text", value: "[tool] read_file completed\n" },
      { kind: "text", value: "Implemented the change.\n" },
    ]);
    expect(session.state.activeMilestone).toBe("Coding agent (guided)");
    expect(session.state.activeSubProblem).toBe("Ready for the next coding task");
    expect(session.getTrail().some((entry) => entry.type === "bypass")).toBe(true);
  });

  it("updates the agent prompt when mode or shared files change", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    const agent = MockAgentClass.instances[0];

    expect(agent.tools.map((tool) => tool.name).sort()).toEqual([
      "list_files",
      "read_file",
      "run_command",
      "search_files",
      "write_file",
    ]);
    expect(agent.systemPrompt).toContain(
      "Use `guided` when you want the agent to behave like a careful senior engineer"
    );

    session.setMode("full-socratic");
    expect(agent.thinkingLevel).toBe("high");
    expect(agent.systemPrompt).toContain("Current mode: full-socratic.");
    expect(agent.systemPrompt).toContain("Decompose the problem internally before editing.");

    await session.shareFile("/tmp/project/src/app.ts");
    expect(agent.systemPrompt).toContain("/tmp/project/src/app.ts");
  });

  it("exports a markdown trail and warns when pdf is requested", async () => {
    MockAgentClass.events = [
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Checked the files and I am ready." }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "fake-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        },
      },
      {
        type: "turn_end",
        message: {
          role: "assistant",
          content: [],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "fake-model",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        },
        toolResults: [],
      },
    ];

    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);

    await collectChunks(session.sendMessage("Check the repo"));
    await session.exportTrail("/tmp/trail.md", "pdf");

    const markdown = io.writes.get("/tmp/trail.md");
    expect(markdown).toContain("# Struggle AI Learning Trail");
    expect(markdown).toContain("## Transcript");
    expect(io.notifications.some((item) => item.level === "warn")).toBe(true);
  });
});
