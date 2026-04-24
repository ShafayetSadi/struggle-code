import { Agent, type AgentEvent } from "@mariozechner/pi-agent-core";
import { type KnownProvider, type ToolResultMessage, getModel } from "@mariozechner/pi-ai";

import { renderTrailMarkdown } from "../artifacts/trail.js";
import { classifyIntentWithDeps } from "../gate/classifier.js";
import type { Session } from "../index.js";
import { createLLMAdapter } from "../llm/adapter.js";
import {
  type ModeHistoryEntry,
  type PendingModePlan,
  createInitialState,
  createTrailEntry,
  now,
  touchState,
} from "../session/state.js";
import type { ADR, IO, Mode, ProviderConfig, ResponseChunk, TrailEntry } from "../types.js";
import {
  buildImplementationPlan,
  buildPhaseExecutionPrompt,
  buildValidationQuestions,
  evaluateValidationAnswer,
  formatExecutionApprovalPrompt,
  formatGuidedApprovalPrompt,
  formatPhaseForUser,
  formatPhaseValidationPrompt,
  formatPlanForUser,
  looksLikeApproval,
} from "./mode-runtime.js";
import { buildSystemPrompt } from "./prompt.js";
import { createProjectTools, resolveProjectPath } from "./tools.js";

interface PhaseExecutionResult {
  hadToolError: boolean;
  runCommandCount: number;
  wroteFiles: Set<string>;
}

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
  const llm = createLLMAdapter(config);
  let pendingPlan: PendingModePlan | undefined;

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

  const setModePhase = (phase: NonNullable<typeof state.modePhase>) => {
    state.modePhase = phase;
  };

  const refreshAgentConfig = () => {
    agent.setSystemPrompt(buildSystemPrompt(projectPath, state.mode, state.sharedFiles));
    agent.setThinkingLevel(getThinkingLevel(state.mode));
    state.activeMilestone =
      state.mode === "standard"
        ? "Direct coding execution"
        : state.mode === "guided"
          ? "Guided build-up"
          : "Full-socratic build-up";
    state.activeSubProblem =
      state.mode === "standard"
        ? "Ready for the next coding task"
        : state.mode === "guided"
          ? "Explain the implementation before coding"
          : "Validate understanding before coding";
  };

  const resetPendingPlan = () => {
    pendingPlan = undefined;
  };

  const updateActiveStep = (value: string) => {
    state.activeSubProblem = value;
  };

  const pushTextChunk = (push: (chunk: ResponseChunk) => void, value: string) => {
    const chunk: ResponseChunk = { kind: "text", value };
    push(chunk);
    pushTrail("ai_response", { chunks: [chunk] });
  };

  const getPendingPhase = () => {
    if (!pendingPlan) {
      return undefined;
    }
    return pendingPlan.plan.phases[pendingPlan.currentPhaseIndex];
  };

  const normalizePlannedPath = (path: string): string | undefined => {
    try {
      return resolveProjectPath(projectPath, path);
    } catch {
      return undefined;
    }
  };

  const validatePhaseExecution = async (result: PhaseExecutionResult) => {
    const currentPhase = getPendingPhase();
    if (!currentPhase) {
      return {
        passed: false,
        reason: "There is no active phase to validate.",
      };
    }

    const expectedPaths = currentPhase.files.map((file) => ({
      file,
      absolutePath: normalizePlannedPath(file.path),
    }));
    const touchedExpectedFiles = expectedPaths.filter(
      (item) => item.absolutePath && result.wroteFiles.has(item.absolutePath)
    );
    const createdFiles = await Promise.all(
      expectedPaths
        .filter((item) => item.file.action === "create" && item.absolutePath)
        .map(async (item) => ({
          path: item.file.path,
          exists: await io.fileExists(item.absolutePath as string),
        }))
    );
    const missingCreatedFiles = createdFiles.filter((item) => !item.exists).map((item) => item.path);
    const hadConcreteExecution = result.wroteFiles.size > 0 || result.runCommandCount > 0;

    if (result.hadToolError) {
      return {
        passed: false,
        reason: "A tool failed during phase execution, so I cannot treat the phase as complete yet.",
      };
    }

    if (!hadConcreteExecution) {
      return {
        passed: false,
        reason:
          "I did not observe any file writes or verification commands for this phase, so nothing concrete was executed.",
      };
    }

    if (currentPhase.files.length > 0 && touchedExpectedFiles.length === 0 && missingCreatedFiles.length > 0) {
      return {
        passed: false,
        reason: `I did not see the expected phase files land yet. Missing created files: ${missingCreatedFiles.join(", ")}.`,
      };
    }

    return {
      passed: true,
      touchedFiles: touchedExpectedFiles.map((item) => item.file.path),
    };
  };

  const setReadyStateForMode = () => {
    setModePhase("idle");
    updateActiveStep(
      state.mode === "standard"
        ? "Ready for the next coding task"
        : state.mode === "guided"
          ? "Ready to explain the next build step"
          : "Ready for the next validated build step"
    );
  };

  const runAgentTurn = async (message: string, push: (chunk: ResponseChunk) => void): Promise<PhaseExecutionResult> => {
    setModePhase("executing");
    updateActiveStep("Working on the current request");
    const result: PhaseExecutionResult = {
      hadToolError: false,
      runCommandCount: 0,
      wroteFiles: new Set<string>(),
    };

    const unsubscribe = agent.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        if (event.toolName === "write_file" && typeof event.args?.path === "string") {
          try {
            result.wroteFiles.add(resolveProjectPath(projectPath, event.args.path));
          } catch {
            // Ignore writes outside the project root; the tool itself should reject them.
          }
        }
        if (event.toolName === "run_command") {
          result.runCommandCount += 1;
        }
      }

      if (event.type === "tool_execution_end" && event.isError) {
        result.hadToolError = true;
      }

      const summary = summarizeToolEvent(event);
      if (summary) {
        const toolChunk: ResponseChunk = { kind: "text", value: `${summary}\n` };
        push(toolChunk);
        pushTrail("ai_response", { chunks: [toolChunk] });
        if (event.type === "tool_execution_start") {
          updateActiveStep(`Running ${event.toolName}`);
        } else {
          updateActiveStep("Working on the current request");
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
      setReadyStateForMode();
    }

    return result;
  };

  pushTrail("session_start", {
    projectPath,
    provider: config.provider,
    model: config.model,
  });
  refreshAgentConfig();
  setModePhase("idle");

  return {
    state,
    sendMessage(message: string) {
      touchState(state);
      pushTrail("user_turn", { message });

      return createAsyncChunkStream(async (push) => {
        if (state.mode === "guided" && pendingPlan?.mode === "guided") {
          const currentPhase = getPendingPhase();
          if (!currentPhase) {
            pushTextChunk(push, "Guided mode has no remaining phases for this request.\n");
            resetPendingPlan();
            setReadyStateForMode();
            return;
          }

          if (!looksLikeApproval(message)) {
            setModePhase("awaiting-approval");
            updateActiveStep(`Waiting for approval to execute phase ${pendingPlan.currentPhaseIndex + 1}`);
            pushTextChunk(push, formatPhaseForUser(pendingPlan.plan, pendingPlan.currentPhaseIndex, "guided"));
            pushTextChunk(push, `${formatGuidedApprovalPrompt(pendingPlan.plan, pendingPlan.currentPhaseIndex)}\n`);
            return;
          }

          pushTextChunk(
            push,
            `Executing phase ${pendingPlan.currentPhaseIndex + 1} of ${pendingPlan.plan.phases.length}: ${currentPhase.title}.\n`
          );
          const executionResult = await runAgentTurn(
            buildPhaseExecutionPrompt(pendingPlan.request, pendingPlan.plan, pendingPlan.currentPhaseIndex, "guided"),
            push
          );
          const validation = await validatePhaseExecution(executionResult);
          if (!validation.passed) {
            setModePhase("awaiting-approval");
            updateActiveStep(`Waiting for approval to retry phase ${pendingPlan.currentPhaseIndex + 1}`);
            pushTextChunk(push, `${validation.reason}\n`);
            pushTextChunk(
              push,
              "I am keeping you on the same guided phase because the repo does not show enough execution evidence yet.\n"
            );
            pushTextChunk(push, formatPhaseForUser(pendingPlan.plan, pendingPlan.currentPhaseIndex, "guided"));
            pushTextChunk(push, `${formatGuidedApprovalPrompt(pendingPlan.plan, pendingPlan.currentPhaseIndex)}\n`);
            return;
          }

          pendingPlan.currentPhaseIndex += 1;
          if (pendingPlan.currentPhaseIndex >= pendingPlan.plan.phases.length) {
            pushTrail("milestone_complete", { mode: "guided", goal: pendingPlan.plan.goal });
            pushTextChunk(push, "Guided mode finished every planned phase for this request.\n");
            resetPendingPlan();
            setReadyStateForMode();
            return;
          }

          setModePhase("awaiting-approval");
          updateActiveStep(`Waiting for approval to execute phase ${pendingPlan.currentPhaseIndex + 1}`);
          pushTextChunk(push, "Phase completed. I’m pausing before the next phase.\n");
          pushTextChunk(push, formatPhaseForUser(pendingPlan.plan, pendingPlan.currentPhaseIndex, "guided"));
          pushTextChunk(push, `${formatGuidedApprovalPrompt(pendingPlan.plan, pendingPlan.currentPhaseIndex)}\n`);
          return;
        }

        if (state.mode === "full-socratic" && pendingPlan?.mode === "full-socratic") {
          const currentPhase = getPendingPhase();
          if (!currentPhase) {
            pushTextChunk(push, "Full-socratic mode has no remaining phases for this request.\n");
            resetPendingPlan();
            setReadyStateForMode();
            return;
          }

          if (pendingPlan.validationPassed) {
            if (!looksLikeApproval(message)) {
              setModePhase("awaiting-approval");
              updateActiveStep(`Waiting for approval to execute phase ${pendingPlan.currentPhaseIndex + 1}`);
              pushTextChunk(push, formatPhaseForUser(pendingPlan.plan, pendingPlan.currentPhaseIndex, "full-socratic"));
              pushTextChunk(
                push,
                `${formatExecutionApprovalPrompt(pendingPlan.plan, pendingPlan.currentPhaseIndex, "full-socratic")}\n`
              );
              return;
            }

            pushTextChunk(
              push,
              `Executing phase ${pendingPlan.currentPhaseIndex + 1} of ${pendingPlan.plan.phases.length}: ${currentPhase.title}.\n`
            );
            const executionResult = await runAgentTurn(
              buildPhaseExecutionPrompt(
                pendingPlan.request,
                pendingPlan.plan,
                pendingPlan.currentPhaseIndex,
                "full-socratic"
              ),
              push
            );
            const validation = await validatePhaseExecution(executionResult);
            if (!validation.passed) {
              pendingPlan.validationPassed = false;
              pendingPlan.attempts = 0;
              setModePhase("awaiting-validation");
              updateActiveStep(`Waiting for the user to explain phase ${pendingPlan.currentPhaseIndex + 1}`);
              pushTextChunk(push, `${validation.reason}\n`);
              pushTextChunk(
                push,
                "I am keeping you on the same full-socratic phase because I did not see enough execution evidence in the repo.\n"
              );
              pushTextChunk(push, formatPhaseForUser(pendingPlan.plan, pendingPlan.currentPhaseIndex, "full-socratic"));
              pushTextChunk(
                push,
                formatPhaseValidationPrompt(
                  pendingPlan.plan,
                  pendingPlan.currentPhaseIndex,
                  pendingPlan.validationQuestions
                )
              );
              return;
            }

            pendingPlan.currentPhaseIndex += 1;
            pendingPlan.attempts = 0;
            pendingPlan.validationPassed = false;

            if (pendingPlan.currentPhaseIndex >= pendingPlan.plan.phases.length) {
              pushTrail("milestone_complete", { mode: "full-socratic", goal: pendingPlan.plan.goal });
              pushTextChunk(push, "Full-socratic mode finished every planned phase for this request.\n");
              resetPendingPlan();
              setReadyStateForMode();
              return;
            }

            pendingPlan.validationQuestions = buildValidationQuestions(pendingPlan.plan, pendingPlan.currentPhaseIndex);
            setModePhase("awaiting-validation");
            updateActiveStep(`Waiting for the user to explain phase ${pendingPlan.currentPhaseIndex + 1}`);
            pushTextChunk(
              push,
              "Phase completed. I’m moving to the next phase and will quiz you again before coding.\n"
            );
            pushTextChunk(push, formatPhaseForUser(pendingPlan.plan, pendingPlan.currentPhaseIndex, "full-socratic"));
            pushTextChunk(
              push,
              formatPhaseValidationPrompt(
                pendingPlan.plan,
                pendingPlan.currentPhaseIndex,
                pendingPlan.validationQuestions
              )
            );
            return;
          }

          setModePhase("verifying");
          updateActiveStep("Checking whether the user understands the implementation plan");
          pendingPlan.attempts += 1;
          pushTrail("comprehension_check", {
            mode: "full-socratic",
            attempt: pendingPlan.attempts,
          });

          const result = await evaluateValidationAnswer(
            llm,
            pendingPlan.plan,
            pendingPlan.currentPhaseIndex,
            pendingPlan.validationQuestions,
            message
          );

          if (!result.passed) {
            setModePhase("awaiting-validation");
            const followUp =
              result.followUp ??
              `Explain ${pendingPlan.plan.phases[0]?.title ?? "the first phase"} again, and name the file boundary you would edit first.`;
            pushTextChunk(push, `${followUp}\n`);
            updateActiveStep("Waiting for a stronger explanation before coding");
            return;
          }

          pendingPlan.validationPassed = true;
          setModePhase("awaiting-approval");
          updateActiveStep(`Waiting for approval to execute phase ${pendingPlan.currentPhaseIndex + 1}`);
          pushTextChunk(push, "Validation passed for this phase.\n");
          pushTextChunk(
            push,
            `${formatExecutionApprovalPrompt(pendingPlan.plan, pendingPlan.currentPhaseIndex, "full-socratic")}\n`
          );
          return;
        }

        const intent = await classifyIntentWithDeps(message, {
          config,
          adapterFactory: createLLMAdapter,
        });

        if (intent === "quick_help" || (intent !== "project" && state.mode !== "full-socratic")) {
          setModePhase("executing");
          updateActiveStep(
            intent === "debug" ? "Working through the debugging request" : "Answering the current question"
          );
          refreshAgentConfig();
          await runAgentTurn(message, push);
          return;
        }

        if (state.mode === "standard") {
          refreshAgentConfig();
          await runAgentTurn(message, push);
          return;
        }

        if (state.mode === "guided") {
          setModePhase("planning");
          updateActiveStep("Inspecting the repo and shaping the implementation plan");
          const plan = await buildImplementationPlan({
            llm,
            projectPath,
            request: message,
            sharedFiles: state.sharedFiles,
          });
          pendingPlan = {
            mode: "guided",
            intent,
            request: message,
            plan,
            validationQuestions: [],
            attempts: 0,
            currentPhaseIndex: 0,
            validationPassed: false,
          };
          pushTrail("milestone_start", { mode: "guided", goal: plan.goal, phases: plan.phases.length });
          pushTextChunk(push, formatPlanForUser(plan, "guided"));
          pushTextChunk(push, formatPhaseForUser(plan, 0, "guided"));
          setModePhase("awaiting-approval");
          updateActiveStep("Waiting for approval to execute phase 1");
          pushTextChunk(push, `${formatGuidedApprovalPrompt(plan, 0)}\n`);
          return;
        }

        if (!pendingPlan) {
          setModePhase("planning");
          updateActiveStep("Inspecting the repo and shaping the implementation plan");
          const plan = await buildImplementationPlan({
            llm,
            projectPath,
            request: message,
            sharedFiles: state.sharedFiles,
          });
          const validationQuestions = buildValidationQuestions(plan, 0);
          pendingPlan = {
            mode: "full-socratic",
            intent,
            request: message,
            plan,
            validationQuestions,
            attempts: 0,
            currentPhaseIndex: 0,
            validationPassed: false,
          };
          pushTrail("milestone_start", { mode: "full-socratic", goal: plan.goal, phases: plan.phases.length });
          pushTextChunk(push, formatPlanForUser(plan, "full-socratic"));
          pushTextChunk(push, formatPhaseForUser(plan, 0, "full-socratic"));
          pushTextChunk(push, formatPhaseValidationPrompt(plan, 0, validationQuestions));
          setModePhase("awaiting-validation");
          updateActiveStep("Waiting for the user to explain phase 1 back");
          return;
        }
      });
    },
    setMode(mode: Mode) {
      state.mode = mode;
      touchState(state);
      modeHistory.push({ mode, at: now() });
      pushTrail("mode_change", { mode });
      resetPendingPlan();
      setModePhase("idle");
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
