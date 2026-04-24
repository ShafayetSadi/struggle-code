import { Agent, type AgentEvent } from "@mariozechner/pi-agent-core";
import { type KnownProvider, type ToolResultMessage, getModel } from "@mariozechner/pi-ai";

import { renderTrailMarkdown } from "../artifacts/trail.js";
import type { Session } from "../index.js";
import { type ModeHistoryEntry, createInitialState, createTrailEntry, now, touchState } from "../session/state.js";
import type { ADR, IO, Mode, ProviderConfig, ResponseChunk, TrailEntry } from "../types.js";
import { buildSystemPrompt } from "./prompt.js";
import { createProjectTools } from "./tools.js";

function getThinkingLevel(mode: Mode): "medium" | "high" {
  return mode === "standard" ? "medium" : "high";
}

function getProviderApiKey(config: ProviderConfig): string {
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

function extractAssistantText(message: { content: Array<{ type: string; text?: string }> }): string {
  return message.content
    .flatMap((block) => (block.type === "text" && typeof block.text === "string" ? [block.text] : []))
    .join("")
    .trim();
}

function summarizeToolEvent(event: AgentEvent): string | undefined {
  if (event.type === "tool_execution_start") {
    const path =
      typeof event.args?.path === "string"
        ? ` ${event.args.path}`
        : typeof event.args?.command === "string"
          ? ` ${event.args.command}`
          : "";
    return `[tool] ${event.toolName}${path}`;
  }

  if (event.type === "tool_execution_end") {
    const summary = event.isError ? "failed" : "completed";
    return `[tool] ${event.toolName} ${summary}`;
  }

  return undefined;
}

function createAsyncChunkStream(
  run: (push: (chunk: ResponseChunk) => void) => Promise<void>
): AsyncIterable<ResponseChunk> {
  const queue: ResponseChunk[] = [];
  let done = false;
  let failure: unknown;
  let notify: (() => void) | undefined;

  const push = (chunk: ResponseChunk) => {
    queue.push(chunk);
    notify?.();
    notify = undefined;
  };

  const finish = () => {
    done = true;
    notify?.();
    notify = undefined;
  };

  const fail = (error: unknown) => {
    failure = error;
    done = true;
    notify?.();
    notify = undefined;
  };

  void run(push).then(finish, fail);

  return {
    async *[Symbol.asyncIterator]() {
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolvePromise) => {
            notify = resolvePromise;
          });
          continue;
        }

        const chunk = queue.shift();
        if (chunk) {
          yield chunk;
        }
      }

      if (failure) {
        throw failure;
      }
    },
  };
}

function renderToolResultSummary(toolResults: ToolResultMessage[]): string[] {
  return toolResults.map((result) => {
    const status = result.isError ? "error" : "ok";
    return `${result.toolName} (${status})`;
  });
}

export async function createCodingAgentSession(projectPath: string, io: IO, config: ProviderConfig): Promise<Session> {
  const state = createInitialState(projectPath);
  const trail: TrailEntry[] = [];
  const adrs: ADR[] = [];
  const modeHistory: ModeHistoryEntry[] = [{ mode: state.mode, at: state.createdAt }];

  const agent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(projectPath, state.mode, state.sharedFiles),
      model: getModel(config.provider as KnownProvider, config.model as never),
      thinkingLevel: getThinkingLevel(state.mode),
      tools: createProjectTools({ projectPath, io }),
      messages: [],
    },
    getApiKey: () => getProviderApiKey(config),
  });

  const pushTrail = (type: TrailEntry["type"], payload: unknown) => {
    trail.push(createTrailEntry(type, state.mode, payload));
  };

  const refreshAgentConfig = () => {
    agent.setSystemPrompt(buildSystemPrompt(projectPath, state.mode, state.sharedFiles));
    agent.setThinkingLevel(getThinkingLevel(state.mode));
    state.activeMilestone = `Coding agent (${state.mode})`;
  };

  pushTrail("session_start", {
    projectPath,
    provider: config.provider,
    model: config.model,
  });
  refreshAgentConfig();
  state.activeSubProblem = "Ready for the next coding task";

  return {
    state,
    sendMessage(message: string) {
      touchState(state);
      pushTrail("user_turn", { message });
      state.activeSubProblem = "Working on the current request";
      refreshAgentConfig();

      return createAsyncChunkStream(async (push) => {
        const unsubscribe = agent.subscribe((event) => {
          const summary = summarizeToolEvent(event);
          if (summary) {
            const toolChunk: ResponseChunk = { kind: "text", value: `${summary}\n` };
            push(toolChunk);
            pushTrail("ai_response", { chunks: [toolChunk] });
            if (event.type === "tool_execution_start") {
              state.activeSubProblem = `Running ${event.toolName}`;
            } else {
              state.activeSubProblem = "Working on the current request";
            }
            return;
          }

          if (event.type === "message_end" && event.message.role === "assistant") {
            const text = extractAssistantText(event.message);
            if (!text) {
              return;
            }
            const assistantChunk: ResponseChunk = { kind: "text", value: `${text}\n` };
            push(assistantChunk);
            pushTrail("ai_response", { chunks: [assistantChunk] });
            return;
          }

          if (event.type === "turn_end" && event.toolResults.length > 0) {
            pushTrail("bypass", {
              toolResults: renderToolResultSummary(event.toolResults),
            });
          }
        });

        try {
          refreshAgentConfig();
          await agent.prompt(message);
        } finally {
          unsubscribe();
          touchState(state);
          state.activeSubProblem = "Ready for the next coding task";
        }
      });
    },
    setMode(mode: Mode) {
      state.mode = mode;
      touchState(state);
      modeHistory.push({ mode, at: now() });
      pushTrail("mode_change", { mode });
      refreshAgentConfig();
      io.notify("info", `Switched Struggle AI mode to ${mode}.`);
    },
    async shareFile(path: string) {
      if (!state.sharedFiles.includes(path)) {
        state.sharedFiles.push(path);
      }
      touchState(state);
      pushTrail("file_share", { path });
      refreshAgentConfig();
      io.notify("info", `Shared ${path} with the session.`);
    },
    async *invokeStuck() {
      const chunks: ResponseChunk[] = [
        {
          kind: "text",
          value:
            "Reframe the task as a coding loop: inspect the failing area, name the smallest safe change, make it, then verify it.\n",
        },
        {
          kind: "question",
          text: "What file, command, or failing behavior should we inspect first?",
          awaitsInput: true,
        },
      ];
      pushTrail("stuck_session", { mode: state.mode });
      for (const chunk of chunks) {
        yield chunk;
      }
    },
    async *invokeHint(level: 1 | 2 | 3) {
      const hints: Record<1 | 2 | 3, string> = {
        1: "Hint 1: read the exact file that owns the behavior before proposing edits.",
        2: "Hint 2: run the narrowest command that can confirm the bug or the fix.",
        3: "Hint 3: if the change spans multiple files, write down the dependency order and update one boundary at a time.",
      };
      const chunk: ResponseChunk = { kind: "text", value: `${hints[level]}\n` };
      pushTrail("hint", { level });
      yield chunk;
    },
    async exportTrail(outputPath: string, format: "md" | "pdf") {
      const markdown = renderTrailMarkdown(state, trail, adrs, modeHistory);
      await io.writeFile(outputPath, markdown);
      pushTrail("session_end", { exportedTo: outputPath, requestedFormat: format });
      if (format === "pdf") {
        io.notify("warn", "PDF export is not available in core yet; wrote Markdown instead.");
      }
    },
    getTrail() {
      return [...trail];
    },
    getADRs() {
      return [...adrs];
    },
  };
}
