import { v4 as uuidv4 } from "uuid";

import { DEFAULT_CONFIGS } from "./config.js";
import type {
  ADR,
  IO,
  Intent,
  Mode,
  ProviderConfig,
  ResponseChunk,
  SessionState,
  SubProblem,
  TrailEntry,
  TrailEntryType,
} from "./types.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function now(): string {
  return new Date().toISOString();
}

function createTrailEntry(type: TrailEntryType, mode: Mode, payload: unknown, intent?: Intent): TrailEntry {
  return {
    id: uuidv4(),
    timestamp: now(),
    type,
    mode,
    payload,
    ...(intent ? { intent } : {}),
  };
}

function createMockADRs(): ADR[] {
  return [
    {
      id: uuidv4(),
      title: "Keep Core IO-Free and UI-Agnostic",
      context:
        "The CLI and the VS Code extension both need the same pedagogical engine, but they present output differently and have different file APIs.",
      decision:
        "The shared core exposes a small IO interface and session API while the shells implement environment-specific reads, writes, notifications, and streaming.",
      consequences:
        "The team can build terminal and editor surfaces in parallel, but every new capability must fit the IO seam instead of reaching into process or vscode APIs directly.",
      concepts: ["Dependency inversion", "Ports and adapters", "Stable package boundaries"],
      risks: [
        "A future core helper imports Node or VS Code APIs and breaks portability.",
        "UI teams diverge on behavior because mock sessions stop matching the stable contract.",
      ],
      docLinks: ["https://martinfowler.com/articles/hexagonal-architecture.html", "https://12factor.net/config"],
      createdAt: now(),
    },
    {
      id: uuidv4(),
      title: "Use Stubbed Sessions to Unblock Parallel UI Development",
      context:
        "The hackathon team needs visible output in the CLI and extension before the real Socratic engine and prompt stack exist.",
      decision:
        "Ship realistic mock chunks, ADRs, trail entries, and hint flows now so each surface can render believable interactions from day one.",
      consequences:
        "Developers can validate UX flows immediately, but they must keep the stub semantics aligned with the real behavior they implement later.",
      concepts: ["Contract-first development", "Mock fidelity", "Incremental integration"],
      risks: [
        "Stub output drifts from the final protocol and forces UI rewrites.",
        "Tests assert placeholder copy too tightly and slow iteration later.",
      ],
      docLinks: [
        "https://martinfowler.com/bliki/InterfaceSegregationPrinciple.html",
        "https://martinfowler.com/articles/practical-test-pyramid.html",
      ],
      createdAt: now(),
    },
  ];
}

function createSubProblems(topic: string): SubProblem[] {
  return [
    {
      id: uuidv4(),
      description: `Define the user and success criteria for ${topic}.`,
      questions: ["Who is using this first?", "What outcome should they reach in one session?"],
      resolved: false,
      order: 1,
    },
    {
      id: uuidv4(),
      description: `Choose the smallest slice of ${topic} worth implementing first.`,
      questions: ["What is the narrowest useful milestone?", "What can wait until after the demo?"],
      resolved: false,
      order: 2,
    },
  ];
}

async function* emitChunks(chunks: ResponseChunk[], io: IO): AsyncIterable<ResponseChunk> {
  for (const chunk of chunks) {
    await delay(30);
    if (chunk.kind === "text") {
      io.stream(chunk.value);
    }
    yield chunk;
  }
}

export async function classifyIntent(message: string): Promise<Intent> {
  // STUB: keyword-based classifier so CLI/Extension can demo immediately
  const lower = message.toLowerCase();
  if (/build|create|make|project|app|website|system/.test(lower)) return "project";
  if (/error|bug|why.*not.*work|broken|fail|throw|exception/.test(lower)) return "debug";
  return "quick_help";
}

export interface Session {
  state: SessionState;
  sendMessage(message: string): AsyncIterable<ResponseChunk>;
  setMode(mode: Mode): void;
  shareFile(path: string): Promise<void>;
  invokeStuck(): AsyncIterable<ResponseChunk>;
  invokeHint(level: 1 | 2 | 3): AsyncIterable<ResponseChunk>;
  exportTrail(outputPath: string, format: "md" | "pdf"): Promise<void>;
  getTrail(): TrailEntry[];
  getADRs(): ADR[];
}

export async function startSession(projectPath: string, io: IO, config?: ProviderConfig): Promise<Session> {
  const createdAt = now();
  const state: SessionState = {
    id: uuidv4(),
    projectPath,
    mode: "guided",
    understandingScore: 61,
    activeMilestone: "Clarify the first user-facing outcome",
    activeSubProblem: "Frame the smallest useful milestone",
    sharedFiles: [],
    createdAt,
    lastActive: createdAt,
  };

  const adrs = createMockADRs();
  const trail: TrailEntry[] = [
    createTrailEntry("session_start", state.mode, {
      projectPath,
      provider: config?.provider ?? DEFAULT_CONFIGS.anthropic.provider,
      model: config?.model ?? DEFAULT_CONFIGS.anthropic.model,
    }),
    createTrailEntry("adr_generated", state.mode, { adrIds: adrs.map((adr) => adr.id) }),
  ];

  function touch(): void {
    state.lastActive = now();
  }

  function pushTrail(type: TrailEntryType, payload: unknown, intent?: Intent): void {
    touch();
    trail.push(createTrailEntry(type, state.mode, payload, intent));
  }

  return {
    state,
    async *sendMessage(message) {
      const intent = await classifyIntent(message);
      const subject = message.replace(/^help me build\s+/i, "").trim() || "this feature";
      const subProblems = createSubProblems(subject);
      const firstSubProblem = subProblems[0] ?? {
        id: uuidv4(),
        description: "Clarify the first milestone.",
        questions: ["What changes for the user after this step?"],
        resolved: false,
        order: 1,
      };

      pushTrail("user_turn", { message }, intent);
      pushTrail("sub_problem_start", { subProblemIds: subProblems.map((item) => item.id) }, intent);

      const chunks: ResponseChunk[] = [
        { kind: "text", value: "Before we write code — who's the reader here?\n" },
        {
          kind: "question",
          text: "If this works perfectly, what will the first user be able to do that they cannot do yet?",
          awaitsInput: true,
        },
        {
          kind: "sub_problem",
          subProblem: firstSubProblem,
        },
        {
          kind: "checkpoint",
          label: "Explain the milestone in one sentence before implementation.",
          kind2: "comprehension",
        },
        {
          kind: "text",
          value:
            "Mock mentor note: once you answer that clearly, we can de-risk the first slice instead of scaffolding the whole system blindly.\n",
        },
      ];

      for await (const chunk of emitChunks(chunks, io)) {
        if (chunk.kind === "text" || chunk.kind === "question" || chunk.kind === "sub_problem") {
          pushTrail("ai_response", chunk, intent);
        }
        yield chunk;
      }
    },
    setMode(mode) {
      state.mode = mode;
      pushTrail("mode_change", { mode });
      io.notify("info", `Switched Struggle AI mode to ${mode}.`);
    },
    async shareFile(path) {
      if (!state.sharedFiles.includes(path)) {
        state.sharedFiles.push(path);
      }
      pushTrail("file_share", { path });
      io.notify("info", `Shared ${path} with the session.`);
    },
    async *invokeStuck() {
      pushTrail("stuck_session", { stage: "diagnostic" });
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: "What part feels uncertain: the goal, the design, the code path, or the error message?",
          awaitsInput: true,
        },
        { kind: "question", text: "What did you expect to happen on the previous step?", awaitsInput: true },
        {
          kind: "question",
          text: "What evidence do you have right now: logs, failing test, or a mental model?",
          awaitsInput: true,
        },
        {
          kind: "text",
          value:
            "Mock stuck diagnosis: you likely need a smaller checkpoint. Restate the expected behavior, isolate one failing path, and confirm the input/output pair before changing code.\n",
        },
      ];

      for await (const chunk of emitChunks(chunks, io)) {
        yield chunk;
      }
    },
    async *invokeHint(level) {
      const hints: Record<1 | 2 | 3, string> = {
        1: "Hint 1: define the boundary first. Name the input, output, and the one invariant you refuse to break.\n",
        2: "Hint 2: inspect the narrowest unit that could prove the behavior. A tiny test or mocked call is enough for this pass.\n",
        3: "Hint 3: if you still feel stuck, sketch the happy-path pseudocode and mark the first unknown with a question instead of guessing.\n",
      };
      pushTrail("hint", { level });
      yield* emitChunks([{ kind: "text", value: hints[level] }], io);
    },
    async exportTrail(outputPath, format) {
      const lines = [
        "# Struggle AI Learning Trail",
        "",
        `- Session ID: ${state.id}`,
        `- Project Path: ${state.projectPath}`,
        `- Mode: ${state.mode}`,
        `- Format Requested: ${format}`,
        "",
        "## Entries",
        "",
        ...trail.map((entry) => `- ${entry.timestamp} [${entry.type}] ${JSON.stringify(entry.payload)}`),
      ];
      await io.writeFile(outputPath, `${lines.join("\n")}\n`);
      pushTrail("session_end", { exportedTo: outputPath, format });
    },
    getTrail() {
      return [...trail];
    },
    getADRs() {
      return [...adrs];
    },
  };
}

export { loadConfig, resolveProviderConfig, DEFAULT_CONFIGS } from "./config.js";
export { NoopIO } from "./io.js";
export { createLLMAdapter } from "./llm/adapter.js";
export * from "./types.js";
