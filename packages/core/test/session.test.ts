import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@mariozechner/pi-ai/oauth", () => ({
  getOAuthApiKey: vi.fn(),
}));

vi.mock("@mariozechner/pi-agent-core", () => {
  class MockAgent {
    static events: AgentEvent[] = [];
    static instances: MockAgent[] = [];

    listeners = new Set<(event: AgentEvent) => void>();
    state: {
      systemPrompt: string;
      thinkingLevel: string;
      tools: unknown[];
      messages: string[];
      model?: unknown;
    };

    constructor(options?: {
      initialState?: {
        systemPrompt?: string;
        thinkingLevel?: string;
        tools?: unknown[];
        model?: unknown;
      };
    }) {
      this.state = {
        systemPrompt: options?.initialState?.systemPrompt ?? "",
        thinkingLevel: options?.initialState?.thinkingLevel ?? "medium",
        tools: options?.initialState?.tools ?? [],
        messages: [],
        model: options?.initialState?.model,
      };
      MockAgent.instances.push(this);
    }

    get systemPrompt() {
      return this.state.systemPrompt;
    }

    get thinkingLevel() {
      return this.state.thinkingLevel;
    }

    get tools() {
      return this.state.tools;
    }

    get messages() {
      return this.state.messages;
    }

    subscribe(fn: (event: AgentEvent) => void) {
      this.listeners.add(fn);
      return () => {
        this.listeners.delete(fn);
      };
    }

    async prompt(message: string) {
      this.state.messages.push(message);
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
import { collectChunks, MemoryIO } from "./test-helpers.js";

const MockAgentClass = (await import("@mariozechner/pi-agent-core")).Agent as unknown as {
  events: AgentEvent[];
  instances: Array<{
    systemPrompt: string;
    thinkingLevel: string;
    tools: Array<{ name: string }>;
    messages: string[];
    state: {
      systemPrompt: string;
      thinkingLevel: string;
      tools: Array<{ name: string }>;
      messages: string[];
      model?: unknown;
    };
  }>;
};

describe("coding agent session", () => {
  beforeEach(() => {
    MockAgentClass.events = [];
    MockAgentClass.instances.length = 0;
  });

  it("runs standard mode as a direct coding agent", async () => {
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
    session.setMode("standard");
    const chunks = await collectChunks(session.sendMessage("Inspect src/index.ts and implement the fix"));

    expect(chunks).toEqual([
      { kind: "text", value: "[tool] read_file src/index.ts\n" },
      { kind: "text", value: "[tool] read_file completed\n" },
      { kind: "text", value: "Implemented the change.\n" },
    ]);
    expect(session.state.activeMilestone).toBe("Direct coding execution");
    expect(session.state.activeSubProblem).toBe("Ready for the next coding task");
    expect(session.state.modePhase).toBe("idle");
    expect(session.getTrail().some((entry) => entry.type === "bypass")).toBe(true);
  });

  it("updates the agent prompt when mode or shared files change", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    const agent = MockAgentClass.instances[0];

    expect(agent?.tools.map((tool) => tool.name).sort()).toEqual([
      "list_files",
      "read_file",
      "run_command",
      "search_files",
      "write_file",
    ]);
    expect(agent?.systemPrompt).toContain(
      "Start by inspecting the relevant code and building a concrete implementation plan before any coding."
    );
    expect(agent?.systemPrompt).toContain(
      "Do not install packages, create virtual environments, or diagnose unrelated dependencies unless the user asked for environment help or the task is blocked on a confirmed missing dependency."
    );

    session.setMode("socratic");
    expect(agent?.thinkingLevel).toBe("high");
    expect(agent?.systemPrompt).toContain("Current mode: socratic.");
    expect(agent?.systemPrompt).toContain(
      "Before each phase executes, require the user to explain that phase's goal, file ownership, and verification path back in their own words."
    );

    await session.shareFile("/tmp/project/src/app.ts");
    expect(agent?.systemPrompt).toContain("/tmp/project/src/app.ts");
  });

  it("pauses guided mode after the plan and before each phase execution", async () => {
    MockAgentClass.events = [
      {
        type: "tool_execution_start",
        toolCallId: "guided-1",
        toolName: "write_file",
        args: { path: "docs/modes.md" },
      },
      {
        type: "tool_execution_end",
        toolCallId: "guided-1",
        toolName: "write_file",
        result: { ok: true },
        isError: false,
      },
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Implemented the approved plan." }],
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
    const firstTurn = await collectChunks(
      session.sendMessage("Implement distinct mode behavior for the coding agent.")
    );

    expect(firstTurn[0]).toEqual(
      expect.objectContaining({
        kind: "text",
        value: expect.stringContaining("Guided mode is mapping the work before any coding starts."),
      })
    );
    expect(
      firstTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Guided mode is ready for phase 1"))
    ).toBe(true);
    expect(firstTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Do you understand phase 1"))).toBe(
      true
    );
    expect(MockAgentClass.instances[0]?.messages).toHaveLength(0);
    expect(session.state.modePhase).toBe("awaiting-approval");

    const secondTurn = await collectChunks(session.sendMessage("yes, go ahead"));
    expect(secondTurn[0]).toEqual(
      expect.objectContaining({
        kind: "text",
        value: expect.stringContaining("Executing phase 1"),
      })
    );
    expect(
      secondTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Implemented the approved plan."))
    ).toBe(true);
    expect(
      secondTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Guided mode is ready for phase 2"))
    ).toBe(true);
    expect(MockAgentClass.instances[0]?.messages[0]).toContain("Execute only phase 1");
    expect(session.state.activeMilestone).toBe("Guided build-up");
    expect(session.state.modePhase).toBe("awaiting-approval");
  });

  it("does not enter guided planning for quick-help questions", async () => {
    MockAgentClass.events = [
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "An array is an ordered collection of values." }],
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
    const chunks = await collectChunks(session.sendMessage("what is an array?"));

    expect(chunks).toEqual([{ kind: "text", value: "An array is an ordered collection of values.\n" }]);
    expect(chunks.some((chunk) => chunk.kind === "text" && chunk.value.includes("Guided mode is mapping"))).toBe(false);
    expect(MockAgentClass.instances[0]?.messages).toEqual(["what is an array?"]);
    expect(session.state.modePhase).toBe("idle");
  });

  it("streams assistant text updates before the final message ends", async () => {
    MockAgentClass.events = [
      {
        type: "message_start",
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
      },
      {
        type: "message_update",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello there" }],
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
        assistantMessageEvent: {
          type: "text_delta",
          delta: "Hello there",
        },
      },
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello there" }],
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
          content: [{ type: "text", text: "Hello there" }],
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
    const chunks = await collectChunks(session.sendMessage("hello"));

    expect(chunks).toEqual([
      { kind: "text", value: "Hello there" },
      { kind: "text", value: "\n" },
    ]);
    expect(MockAgentClass.instances[0]?.messages).toEqual(["hello"]);
  });

  it("runs socratic mode as a phased quiz-driven flow", async () => {
    MockAgentClass.events = [
      {
        type: "tool_execution_start",
        toolCallId: "socratic-1",
        toolName: "write_file",
        args: { path: "docs/modes.md" },
      },
      {
        type: "tool_execution_end",
        toolCallId: "socratic-1",
        toolName: "write_file",
        result: { ok: true },
        isError: false,
      },
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Executed the current phase." }],
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
    session.setMode("socratic");

    const firstTurn = await collectChunks(
      session.sendMessage("Implement distinct mode behavior for the coding agent.")
    );
    expect(
      firstTurn.some(
        (chunk) =>
          chunk.kind === "text" && chunk.value.includes("Socratic mode is mapping the work before any coding starts.")
      )
    ).toBe(true);
    expect(
      firstTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Socratic mode is ready for phase 1"))
    ).toBe(true);
    expect(firstTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Before I execute phase 1"))).toBe(
      true
    );
    expect(MockAgentClass.instances[0]?.messages).toHaveLength(0);
    expect(session.state.modePhase).toBe("awaiting-validation");

    const secondTurn = await collectChunks(session.sendMessage("I do not know yet."));
    expect(secondTurn).toEqual([
      expect.objectContaining({
        kind: "text",
        value: expect.stringContaining("Tighten the explanation"),
      }),
    ]);
    expect(MockAgentClass.instances[0]?.messages).toHaveLength(0);
    expect(session.state.modePhase).toBe("awaiting-validation");

    const thirdTurn = await collectChunks(
      session.sendMessage(
        "Phase 1 shapes the mode contract. I would change docs/modes.md and coding-agent/session.ts first, then verify the behavior with the session tests."
      )
    );
    expect(thirdTurn[0]).toEqual(
      expect.objectContaining({
        kind: "text",
        value: "Validation passed for this phase.\n",
      })
    );
    expect(thirdTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("should I execute phase 1"))).toBe(
      true
    );
    expect(MockAgentClass.instances[0]?.messages).toHaveLength(0);
    expect(session.state.modePhase).toBe("awaiting-approval");

    const fourthTurn = await collectChunks(session.sendMessage("yes, execute it"));
    expect(fourthTurn[0]).toEqual(
      expect.objectContaining({
        kind: "text",
        value: expect.stringContaining("Executing phase 1"),
      })
    );
    expect(
      fourthTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Executed the current phase."))
    ).toBe(true);
    expect(MockAgentClass.instances[0]?.messages[0]).toContain("Execute only phase 1");
    expect(
      fourthTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Socratic mode is ready for phase 2"))
    ).toBe(true);
    expect(fourthTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Before I execute phase 2"))).toBe(
      true
    );
    expect(session.state.modePhase).toBe("awaiting-validation");
  });

  it("routes debug requests through the socratic loop instead of executing immediately", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    session.setMode("socratic");

    const firstTurn = await collectChunks(session.sendMessage("Why does the app crash on startup after I added auth?"));

    expect(
      firstTurn.some(
        (chunk) =>
          chunk.kind === "text" && chunk.value.includes("Socratic mode is mapping the work before any coding starts.")
      )
    ).toBe(true);
    expect(firstTurn.some((chunk) => chunk.kind === "text" && chunk.value.includes("Before I execute phase 1"))).toBe(
      true
    );
    expect(MockAgentClass.instances[0]?.messages).toHaveLength(0);
    expect(session.state.modePhase).toBe("awaiting-validation");
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
