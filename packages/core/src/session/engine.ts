import { basename, join } from "node:path";

import { DEFAULT_CONFIGS } from "../config.js";
import { classifyIntentWithDeps } from "../gate/classifier.js";
import {
  buildGuidedCodeChunk,
  createDesignBriefMarkdown,
  createGuidedState,
  deriveMilestones,
  getCurrentDesignQuestion,
  shouldFinishInterview,
} from "../guided/flow.js";
import { createLLMAdapter, type LLMAdapter } from "../llm/adapter.js";
import { collectStream, safeComplete } from "../llm/runtime.js";
import { loadPrompt } from "../prompts/loader.js";
import { buildMinimalCodeChunk, createSocraticState } from "../socratic/flow.js";
import { buildStandardCodeChunk, createStandardState, needsClarification } from "../standard/flow.js";
import type { Session } from "../index.js";
import type { ADR, IO, Intent, Mode, ProviderConfig, ResponseChunk, TrailEntry } from "../types.js";
import { generateADR } from "../artifacts/adr.js";
import { renderTrailMarkdown } from "../artifacts/trail.js";
import {
  bumpUnderstanding,
  createInitialState,
  createTrailEntry,
  deriveDisplayState,
  now,
  touchState,
  type RuntimeSessionContext,
} from "./state.js";

function inferTopic(message: string): string {
  return message.replace(/^help me build\s+/i, "").trim() || "this feature";
}

function summarizeDesignAnswers(topic: string, answers: string[]): string {
  return `Build ${topic} around a narrow first release focused on ${answers[0] ?? "a single user outcome"}, ` +
    `with a clear workflow, explicit data boundaries, and runtime constraints captured before coding starts.`;
}

function createPromptedTextChunk(text: string): ResponseChunk {
  return { kind: "text", value: `${text.trim()}\n` };
}

function messageShowsUnderstanding(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount >= 8 && /(because|so that|flow|user|data|boundary|state|test|persist|request|response)/.test(normalized);
}

async function gradeCheckpoint(
  llm: LLMAdapter,
  io: IO,
  answer: string,
  summary: string
): Promise<"pass" | "probe"> {
  const prompt = await loadPrompt("comprehension-check.md", io);
  const fallback = messageShowsUnderstanding(answer) ? "pass" : "probe";
  const raw = await safeComplete(
    llm,
    [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify({ answer, summary }) },
    ],
    fallback
  );
  return raw.trim().toLowerCase() === "pass" ? "pass" : "probe";
}

function emitStoredChunks(io: IO, chunks: ResponseChunk[]): AsyncIterable<ResponseChunk> {
  return (async function* () {
    for (const chunk of chunks) {
      if (chunk.kind === "text") {
        io.stream(chunk.value);
      }
      yield chunk;
    }
  })();
}

function requireMilestone(runtime: RuntimeSessionContext) {
  const milestone = runtime.guided?.milestones[runtime.guided.activeMilestoneIndex];
  if (!milestone) {
    throw new Error("Guided flow expected an active milestone but none was available");
  }
  return milestone;
}

export async function createSessionEngine(projectPath: string, io: IO, config?: ProviderConfig): Promise<Session> {
  const providerConfig = config ?? DEFAULT_CONFIGS.anthropic;
  const llm = createLLMAdapter(providerConfig);
  const state = createInitialState(projectPath);
  const adrs: ADR[] = [];
  const trail: TrailEntry[] = [];
  const runtime: RuntimeSessionContext = {
    modeHistory: [{ mode: state.mode, at: state.createdAt }],
    guided: undefined,
    standard: undefined,
    socratic: undefined,
  };

  function pushTrail(type: TrailEntry["type"], payload: unknown, intent?: Intent): void {
    touchState(state);
    trail.push(createTrailEntry(type, state.mode, payload, intent));
  }

  function recordChunks(chunks: ResponseChunk[], intent?: Intent): void {
    pushTrail("ai_response", { chunks }, intent);
  }

  function resetInactiveModes(): void {
    if (state.mode !== "guided") runtime.guided = undefined;
    if (state.mode !== "standard") runtime.standard = undefined;
    if (state.mode !== "full-socratic") runtime.socratic = undefined;
    deriveDisplayState(state, runtime);
  }

  async function buildQuickHelp(message: string, intent: Intent): Promise<ResponseChunk[]> {
    const fallback = `Start from the smallest mental model first: ${message.trim()} usually makes more sense once you name the input, the transformation, and the output.\n`;
    const streamed = await collectStream(
      llm,
      io,
      [
        {
          role: "system",
          content:
            "You are a concise coding mentor. Give a short explanation that teaches the concept, not just the answer.",
        },
        { role: "user", content: message },
      ],
      fallback
    );
    const chunks = [createPromptedTextChunk(streamed)];
    recordChunks(chunks, intent);
    return chunks;
  }

  async function buildDebugHelp(message: string, intent: Intent): Promise<ResponseChunk[]> {
    const fallback =
      "Treat this as a debugging funnel: restate the expected behavior, isolate one failing path, and compare actual input/output before changing code.\n";
    const streamed = await collectStream(
      llm,
      io,
      [
        {
          role: "system",
          content: "You are a debugging mentor. Respond with a concrete diagnosis plan in 3 short steps.",
        },
        { role: "user", content: message },
      ],
      fallback
    );
    const chunks: ResponseChunk[] = [
      createPromptedTextChunk(streamed),
      {
        kind: "question",
        text: "What did you expect to happen, and what actually happened instead?",
        awaitsInput: true as const,
      },
    ];
    recordChunks(chunks, intent);
    return chunks;
  }

  async function startGuidedProject(message: string): Promise<ResponseChunk[]> {
    const topic = inferTopic(message);
    runtime.guided = createGuidedState(topic);
    runtime.activeIntent = "project";
    deriveDisplayState(state, runtime);
    const question = getCurrentDesignQuestion(runtime.guided);
    const chunks: ResponseChunk[] = [
      createPromptedTextChunk(`Let's scope ${topic} before we write code.`),
      {
        kind: "question",
        text: question.question,
        awaitsInput: true,
      },
    ];
    recordChunks(chunks, "project");
    return chunks;
  }

  async function continueGuidedDesign(message: string): Promise<ResponseChunk[]> {
    const guided = runtime.guided;
    if (!guided) return [];
    const currentQuestion = getCurrentDesignQuestion(guided);
    guided.answers.push({
      category: currentQuestion.category,
      question: currentQuestion.question,
      answer: message,
    });
    guided.questionIndex += 1;

    if (!shouldFinishInterview(guided)) {
      const nextQuestion = getCurrentDesignQuestion(guided);
      deriveDisplayState(state, runtime);
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: nextQuestion.question,
          awaitsInput: true,
        },
      ];
      recordChunks(chunks, "project");
      return chunks;
    }

    guided.awaiting = "idle";
    guided.briefSummary = summarizeDesignAnswers(
      guided.topic,
      guided.answers.map((answer) => answer.answer)
    );
    guided.milestones = deriveMilestones(guided.topic, guided.briefSummary);
    guided.activeMilestoneIndex = 0;
    guided.briefPath = join(projectPath, ".struggle-ai", `design-brief-${state.id}.md`);
    const brief = createDesignBriefMarkdown(guided);
    await io.writeFile(guided.briefPath, brief);
    pushTrail("milestone_complete", { kind: "design_interview", briefPath: guided.briefPath }, "project");

    const milestone = requireMilestone(runtime);
    milestone.checkpointAttempts = 0;
    guided.awaiting = "checkpoint";
    deriveDisplayState(state, runtime);
    pushTrail("milestone_start", { milestoneId: milestone.id, title: milestone.title }, "project");

    const prompt = await loadPrompt("guided-milestone.md", io);
    const fallback = `Milestone: ${milestone.title}\nFocus on ${milestone.description}`;
    const streamed = await collectStream(
      llm,
      io,
      [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify({
            topic: guided.topic,
            designSummary: guided.briefSummary,
            milestone,
          }),
        },
      ],
      fallback
    );

    const chunks: ResponseChunk[] = [
      createPromptedTextChunk(`Design brief saved to ${guided.briefPath}.`),
      createPromptedTextChunk(streamed),
      buildGuidedCodeChunk(guided.topic, milestone),
      {
        kind: "checkpoint",
        label: milestone.checkpointLabel,
        kind2: "comprehension",
      },
    ];
    recordChunks(chunks, "project");
    return chunks;
  }

  async function continueGuidedCheckpoint(message: string): Promise<ResponseChunk[]> {
    const guided = runtime.guided;
    if (!guided) return [];
    const milestone = requireMilestone(runtime);
    milestone.checkpointAttempts += 1;
    pushTrail("comprehension_check", { milestoneId: milestone.id, attempt: milestone.checkpointAttempts }, "project");
    const result = await gradeCheckpoint(llm, io, message, `${guided.briefSummary ?? ""} ${milestone.description}`);

    if (result === "probe" && milestone.checkpointAttempts === 1) {
      guided.awaiting = "probe";
      guided.pendingProbe = `Tighten that explanation. What boundary or tradeoff matters most in ${milestone.title}?`;
      deriveDisplayState(state, runtime);
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: guided.pendingProbe,
          awaitsInput: true,
        },
      ];
      recordChunks(chunks, "project");
      return chunks;
    }

    if (result === "probe") {
      bumpUnderstanding(state, -2);
    } else {
      bumpUnderstanding(state, 6);
    }

    const adr = await generateADR(
      {
        projectPath,
        topic: guided.topic,
        milestoneTitle: milestone.title,
        milestoneDescription: milestone.description,
        designSummary: guided.briefSummary,
      },
      llm,
      io
    );
    adrs.push(adr);
    pushTrail("adr_generated", { adrId: adr.id, milestoneId: milestone.id }, "project");

    milestone.completed = true;
    pushTrail("milestone_complete", { milestoneId: milestone.id, title: milestone.title }, "project");
    guided.activeMilestoneIndex += 1;
    guided.awaiting = "idle";
    deriveDisplayState(state, runtime);

    const moreMilestonesRemain = guided.activeMilestoneIndex < guided.milestones.length;
    const chunks: ResponseChunk[] = [];
    if (result === "probe") {
      chunks.push(
        createPromptedTextChunk(
          "Your explanation is still thin, so I'm giving you the core reasoning directly and moving on instead of deadlocking the session."
        )
      );
    } else {
      chunks.push(createPromptedTextChunk("Checkpoint passed. Locking in the decision."));
    }
    chunks.push({ kind: "adr", adr });
    if (moreMilestonesRemain) {
      chunks.push(createPromptedTextChunk("The next milestone is ready when you are."));
    } else {
      chunks.push(createPromptedTextChunk("Guided mode finished the current milestone plan."));
      runtime.guided = undefined;
    }
    recordChunks(chunks, "project");
    return chunks;
  }

  async function continueGuidedReadyState(): Promise<ResponseChunk[]> {
    const guided = runtime.guided;
    if (!guided) return [];
    const milestone = requireMilestone(runtime);
    guided.awaiting = "checkpoint";
    pushTrail("milestone_start", { milestoneId: milestone.id, title: milestone.title }, "project");
    deriveDisplayState(state, runtime);

    const prompt = await loadPrompt("guided-milestone.md", io);
    const fallback = `Milestone: ${milestone.title}\nFocus on ${milestone.description}`;
    const streamed = await collectStream(
      llm,
      io,
      [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify({
            topic: guided.topic,
            designSummary: guided.briefSummary,
            milestone,
          }),
        },
      ],
      fallback
    );

    const chunks: ResponseChunk[] = [
      createPromptedTextChunk(streamed),
      buildGuidedCodeChunk(guided.topic, milestone),
      {
        kind: "checkpoint",
        label: milestone.checkpointLabel,
        kind2: "comprehension",
      },
    ];
    recordChunks(chunks, "project");
    return chunks;
  }

  async function startStandardProject(message: string): Promise<ResponseChunk[]> {
    const topic = inferTopic(message);
    runtime.standard = createStandardState(topic);
    runtime.activeIntent = "project";

    if (!needsClarification(message)) {
      runtime.standard.awaiting = "idle";
      runtime.standard.clarificationAsked = true;
      runtime.standard.clarificationAnswer = "Use the user's existing scope as the first pass.";
      return continueStandardReadyState();
    }

    deriveDisplayState(state, runtime);
    const chunks: ResponseChunk[] = [
      {
        kind: "question",
        text: "Give me one sentence on the exact first user outcome so I can generate the first-pass implementation.",
        awaitsInput: true,
      },
    ];
    recordChunks(chunks, "project");
    return chunks;
  }

  async function continueStandardReadyState(answer?: string): Promise<ResponseChunk[]> {
    const standard = runtime.standard;
    if (!standard) return [];
    if (answer) {
      standard.clarificationAnswer = answer;
    }
    standard.awaiting = "checkpoint";
    standard.delivered = true;
    deriveDisplayState(state, runtime);
    const codeChunk = buildStandardCodeChunk(standard.topic, standard.clarificationAnswer);
    const chunks: ResponseChunk[] = [
      createPromptedTextChunk(`Standard mode is taking the short path for ${standard.topic}.`),
      codeChunk,
      {
        kind: "checkpoint",
        label: "Digest this implementation path back to me in 2-3 sentences.",
        kind2: "comprehension",
      },
    ];
    recordChunks(chunks, "project");
    return chunks;
  }

  async function continueStandardCheckpoint(message: string): Promise<ResponseChunk[]> {
    const standard = runtime.standard;
    if (!standard) return [];
    standard.checkpointAttempts += 1;
    const result = messageShowsUnderstanding(message) ? "pass" : "probe";
    if (result === "probe" && standard.checkpointAttempts === 1) {
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: "What part of the generated code carries the core user outcome?",
          awaitsInput: true,
        },
      ];
      recordChunks(chunks, "project");
      return chunks;
    }

    const adr = await generateADR(
      {
        projectPath,
        topic: standard.topic,
        milestoneTitle: "Standard implementation pass",
        milestoneDescription: "Generate a fuller implementation response with one digest checkpoint.",
        designSummary: standard.clarificationAnswer,
      },
      llm,
      io
    );
    adrs.push(adr);
    pushTrail("adr_generated", { adrId: adr.id, mode: "standard" }, "project");
    runtime.standard = undefined;
    deriveDisplayState(state, runtime);
    const chunks: ResponseChunk[] = [
      { kind: "adr", adr },
      createPromptedTextChunk("Standard mode finished this request."),
    ];
    recordChunks(chunks, "project");
    return chunks;
  }

  async function startSocraticProject(message: string): Promise<ResponseChunk[]> {
    const topic = inferTopic(message);
    runtime.socratic = createSocraticState(topic);
    runtime.activeIntent = "project";
    deriveDisplayState(state, runtime);
    const active = runtime.socratic.subProblems[0];
    if (!active) {
      runtime.socratic = undefined;
      return [createPromptedTextChunk("I couldn't derive sub-problems for that request yet.")];
    }
    const firstQuestion = active?.questions[0] ?? "What is the smallest piece we can reason about first?";
    const chunks: ResponseChunk[] = [
      { kind: "sub_problem", subProblem: active },
      {
        kind: "question",
        text: firstQuestion,
        awaitsInput: true,
      },
    ];
    recordChunks(chunks, "project");
    pushTrail("sub_problem_start", { subProblemId: active?.id }, "project");
    return chunks;
  }

  async function continueSocratic(message: string): Promise<ResponseChunk[]> {
    const socratic = runtime.socratic;
    if (!socratic) return [];
    const current = socratic.subProblems[socratic.activeSubProblemIndex];
    if (!current) {
      runtime.socratic = undefined;
      return [];
    }

    socratic.questionIndex += 1;
    if (socratic.questionIndex < Math.min(3, current.questions.length)) {
      const question = current.questions[socratic.questionIndex] ?? "What is the next thing you need to justify?";
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: question,
          awaitsInput: true,
        },
      ];
      recordChunks(chunks, "project");
      return chunks;
    }

    current.resolved = true;
    pushTrail("sub_problem_complete", { subProblemId: current.id }, "project");
    const chunks: ResponseChunk[] = [buildMinimalCodeChunk(socratic.topic, current)];
    socratic.activeSubProblemIndex += 1;
    socratic.questionIndex = 0;

    const next = socratic.subProblems[socratic.activeSubProblemIndex];
    if (next) {
      pushTrail("sub_problem_start", { subProblemId: next.id }, "project");
      chunks.push({ kind: "sub_problem", subProblem: next });
      chunks.push({
        kind: "question",
        text: next.questions[0] ?? "What matters most in this sub-problem?",
        awaitsInput: true,
      });
    } else {
      socratic.awaiting = "checkpoint";
      chunks.push({
        kind: "checkpoint",
        label: "Explain the overall solution back in your own words.",
        kind2: "explain_it_back",
      });
    }
    recordChunks(chunks, "project");
    deriveDisplayState(state, runtime);
    return chunks;
  }

  async function continueSocraticCheckpoint(message: string): Promise<ResponseChunk[]> {
    const socratic = runtime.socratic;
    if (!socratic) return [];
    socratic.checkpointAttempts += 1;
    const result = messageShowsUnderstanding(message) ? "pass" : "probe";
    if (result === "probe" && socratic.checkpointAttempts === 1) {
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: "Name the main boundary, the data that crosses it, and the test you'd run first.",
          awaitsInput: true,
        },
      ];
      recordChunks(chunks, "project");
      return chunks;
    }

    runtime.socratic = undefined;
    deriveDisplayState(state, runtime);
    const chunks: ResponseChunk[] = [createPromptedTextChunk("Full Socratic mode finished the decomposition for this task.")];
    recordChunks(chunks, "project");
    return chunks;
  }

  pushTrail("session_start", {
    projectPath,
    provider: providerConfig.provider,
    model: providerConfig.model,
  });

  return {
    state,
    async *sendMessage(message: string) {
      touchState(state);
      pushTrail("user_turn", { message }, runtime.activeIntent);

      let chunks: ResponseChunk[] = [];
      if (runtime.guided) {
        if (runtime.guided.awaiting === "design_answer") {
          chunks = await continueGuidedDesign(message);
        } else if (runtime.guided.awaiting === "checkpoint" || runtime.guided.awaiting === "probe") {
          chunks = await continueGuidedCheckpoint(message);
        } else {
          chunks = await continueGuidedReadyState();
        }
        yield* emitStoredChunks(io, chunks);
        return;
      }

      if (runtime.standard) {
        if (runtime.standard.awaiting === "clarification") {
          chunks = await continueStandardReadyState(message);
        } else if (runtime.standard.awaiting === "checkpoint") {
          chunks = await continueStandardCheckpoint(message);
        } else {
          chunks = await continueStandardReadyState();
        }
        yield* emitStoredChunks(io, chunks);
        return;
      }

      if (runtime.socratic) {
        if (runtime.socratic.awaiting === "checkpoint") {
          chunks = await continueSocraticCheckpoint(message);
        } else {
          chunks = await continueSocratic(message);
        }
        yield* emitStoredChunks(io, chunks);
        return;
      }

      const intent = await classifyIntentWithDeps(message, {
        config: providerConfig,
        adapterFactory: createLLMAdapter,
      });
      runtime.activeIntent = intent;

      if (intent === "quick_help") {
        chunks = await buildQuickHelp(message, intent);
      } else if (intent === "debug") {
        chunks = await buildDebugHelp(message, intent);
      } else if (state.mode === "standard") {
        chunks = await startStandardProject(message);
      } else if (state.mode === "full-socratic") {
        chunks = await startSocraticProject(message);
      } else {
        chunks = await startGuidedProject(message);
      }

      deriveDisplayState(state, runtime);
      yield* emitStoredChunks(io, chunks);
    },
    setMode(mode: Mode) {
      state.mode = mode;
      runtime.modeHistory.push({ mode, at: now() });
      pushTrail("mode_change", { mode }, runtime.activeIntent);
      resetInactiveModes();
      io.notify("info", `Switched Struggle AI mode to ${mode}.`);
    },
    async shareFile(path: string) {
      if (!state.sharedFiles.includes(path)) {
        state.sharedFiles.push(path);
      }
      pushTrail("file_share", { path: basename(path) }, runtime.activeIntent);
      io.notify("info", `Shared ${path} with the session.`);
    },
    async *invokeStuck() {
      const chunks: ResponseChunk[] = [
        {
          kind: "question",
          text: "What feels uncertain right now: the goal, the design, the code path, or the failure mode?",
          awaitsInput: true,
        },
        createPromptedTextChunk(
          "Shrink the problem. Name the expected behavior, isolate one path, and prove the input/output pair before you edit more code."
        ),
      ];
      pushTrail("stuck_session", { mode: state.mode }, runtime.activeIntent);
      recordChunks(chunks, runtime.activeIntent);
      yield* emitStoredChunks(io, chunks);
    },
    async *invokeHint(level: 1 | 2 | 3) {
      const hints: Record<1 | 2 | 3, string> = {
        1: "Hint 1: name the invariant first. What must stay true after this step?",
        2: "Hint 2: reduce the scope. What is the smallest proof that the behavior works?",
        3: "Hint 3: write the happy path in pseudocode and circle the first unknown instead of guessing.",
      };
      const chunks: ResponseChunk[] = [createPromptedTextChunk(hints[level])];
      pushTrail("hint", { level }, runtime.activeIntent);
      recordChunks(chunks, runtime.activeIntent);
      yield* emitStoredChunks(io, chunks);
    },
    async exportTrail(outputPath: string, format: "md" | "pdf") {
      const markdown = renderTrailMarkdown(state, trail, adrs, runtime.modeHistory);
      await io.writeFile(outputPath, markdown);
      pushTrail("session_end", { exportedTo: outputPath, requestedFormat: format }, runtime.activeIntent);
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
