import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";

import type { LLMAdapter } from "../llm/adapter.js";
import { safeComplete } from "../llm/runtime.js";
import type { ImplementationPhase, ImplementationPlan, ValidationQuestion } from "../types.js";

interface RepoEntry {
  path: string;
  kind: "file" | "directory";
}

interface BuildPlanOptions {
  llm: LLMAdapter;
  projectPath: string;
  request: string;
  sharedFiles: string[];
}

interface AnswerScore {
  goalUnderstanding: number;
  fileOwnership: number;
  responsibilitySeparation: number;
  dataControlFlow: number;
  verificationPlan: number;
}

interface BuildValidationResult {
  passed: boolean;
  classification: "strong" | "partial" | "weak";
  score: AnswerScore;
  total: number;
  followUp?: string;
}

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "coverage", ".turbo"]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").trim();
}

function clampScore(value: unknown, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(max, numeric));
}

function sumScore(score: AnswerScore): number {
  return (
    score.goalUnderstanding +
    score.fileOwnership +
    score.responsibilitySeparation +
    score.dataControlFlow +
    score.verificationPlan
  );
}

function classifyScore(total: number): "strong" | "partial" | "weak" {
  if (total >= 10) {
    return "strong";
  }
  if (total >= 6) {
    return "partial";
  }
  return "weak";
}

function normalizeSlug(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `phase-${index + 1}`;
}

async function collectRepoEntries(
  rootPath: string,
  currentPath = rootPath,
  maxDepth = 3,
  currentDepth = 0
): Promise<RepoEntry[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const results: RepoEntry[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = join(currentPath, entry.name);
    const displayPath = relative(rootPath, absolutePath) || ".";
    if (entry.isDirectory()) {
      results.push({ path: `${displayPath}/`, kind: "directory" });
      if (currentDepth < maxDepth) {
        results.push(...(await collectRepoEntries(rootPath, absolutePath, maxDepth, currentDepth + 1)));
      }
      continue;
    }

    results.push({ path: displayPath, kind: "file" });
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

async function readProjectSample(
  projectPath: string,
  entries: RepoEntry[]
): Promise<Array<{ path: string; snippet: string }>> {
  const candidateFiles = entries
    .filter((entry) => entry.kind === "file")
    .map((entry) => entry.path)
    .filter((path) => {
      const extension = extname(path).toLowerCase();
      return [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml"].includes(extension);
    })
    .slice(0, 8);

  const samples: Array<{ path: string; snippet: string }> = [];
  for (const path of candidateFiles) {
    try {
      const snippet = (await readFile(join(projectPath, path), "utf8")).slice(0, 600).trim();
      if (snippet) {
        samples.push({ path, snippet });
      }
    } catch {}
  }
  return samples;
}

function extractJsonObject(raw: string): string | undefined {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return undefined;
  }
  return raw.slice(firstBrace, lastBrace + 1);
}

function isValidPlanFile(value: unknown): value is { path: string; action: "create" | "update"; why: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { path?: unknown; action?: unknown; why?: unknown };
  return (
    typeof candidate.path === "string" &&
    (candidate.action === "create" || candidate.action === "update") &&
    typeof candidate.why === "string"
  );
}

function normalizePlan(rawPlan: unknown, fallback: ImplementationPlan): ImplementationPlan {
  if (typeof rawPlan !== "object" || rawPlan === null) {
    return fallback;
  }

  const candidate = rawPlan as {
    goal?: unknown;
    summary?: unknown;
    architecture?: unknown;
    phases?: unknown;
  };

  const phases = Array.isArray(candidate.phases)
    ? candidate.phases
        .map((phase, index): ImplementationPhase | undefined => {
          if (typeof phase !== "object" || phase === null) {
            return undefined;
          }

          const phaseCandidate = phase as {
            title?: unknown;
            summary?: unknown;
            files?: unknown;
            verification?: unknown;
          };

          if (typeof phaseCandidate.title !== "string" || typeof phaseCandidate.summary !== "string") {
            return undefined;
          }

          const files = Array.isArray(phaseCandidate.files) ? phaseCandidate.files.filter(isValidPlanFile) : [];
          const verification = Array.isArray(phaseCandidate.verification)
            ? phaseCandidate.verification.filter((item): item is string => typeof item === "string")
            : [];

          return {
            id: normalizeSlug(phaseCandidate.title, index),
            title: phaseCandidate.title,
            summary: phaseCandidate.summary,
            files,
            verification,
          };
        })
        .filter((phase): phase is ImplementationPhase => Boolean(phase))
    : [];

  if (
    typeof candidate.goal !== "string" ||
    typeof candidate.summary !== "string" ||
    !Array.isArray(candidate.architecture) ||
    phases.length === 0
  ) {
    return fallback;
  }

  const architecture = candidate.architecture.filter((item): item is string => typeof item === "string");
  if (architecture.length === 0) {
    return fallback;
  }

  return {
    goal: candidate.goal,
    summary: candidate.summary,
    architecture,
    phases,
  };
}

function findMatchingPath(paths: string[], patterns: RegExp[]): string | undefined {
  return paths.find((path) => patterns.some((pattern) => pattern.test(path)));
}

function dedupeFiles(files: Array<{ path: string; action: "create" | "update"; why: string }>) {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.path)) {
      return false;
    }
    seen.add(file.path);
    return true;
  });
}

function buildFallbackPlan(
  projectPath: string,
  request: string,
  entries: RepoEntry[],
  sharedFiles: string[]
): ImplementationPlan {
  const lowerRequest = request.toLowerCase();
  const filePaths = entries.filter((entry) => entry.kind === "file").map((entry) => entry.path);

  const docsModesPath =
    findMatchingPath(filePaths, [/^docs\/modes\.md$/]) ??
    findMatchingPath(filePaths, [/modes\.md$/]) ??
    "docs/modes.md";
  const promptPath =
    findMatchingPath(filePaths, [/coding-agent\/prompt\.ts$/]) ?? "packages/core/src/coding-agent/prompt.ts";
  const sessionPath =
    findMatchingPath(filePaths, [/coding-agent\/session\.ts$/]) ?? "packages/core/src/coding-agent/session.ts";
  const statePath = findMatchingPath(filePaths, [/session\/state\.ts$/]) ?? "packages/core/src/session/state.ts";
  const typesPath = findMatchingPath(filePaths, [/types\.ts$/]) ?? "packages/core/src/types.ts";
  const testPath = findMatchingPath(filePaths, [/test\/session\.test\.ts$/]) ?? "packages/core/test/session.test.ts";
  const readmePath = findMatchingPath(filePaths, [/packages\/core\/README\.md$/]) ?? "packages/core/README.md";

  const relativeSharedFiles = sharedFiles
    .map((path) => (isPathInsideProject(projectPath, path) ? relative(projectPath, resolve(path)) : path))
    .filter((path) => Boolean(path) && !path.startsWith(".."));

  const prioritizedFiles = dedupeFiles(
    [docsModesPath, promptPath, sessionPath, statePath, typesPath, testPath, readmePath, ...relativeSharedFiles]
      .filter(Boolean)
      .map((path) => ({
        path,
        action: filePaths.includes(path) ? "update" : "create",
        why:
          path === docsModesPath
            ? "The public mode contract needs to match the runtime behavior."
            : path === promptPath
              ? "Mode prompts should reflect the new semantics so the coding agent behaves correctly."
              : path === sessionPath
                ? "The live coding-agent session needs the orchestration logic for planning, gating, and execution."
                : path === statePath
                  ? "Session state has to expose the current mode phase and pending plan state."
                  : path === typesPath
                    ? "Shared plan and validation shapes should stay explicit and typed."
                    : path === testPath
                      ? "The session tests need to verify the new mode behavior."
                      : "This file is relevant to the requested implementation.",
      }))
  );

  const phases: ImplementationPhase[] = [
    {
      id: "shape-the-mode-contract",
      title: "Shape the mode contract",
      summary: `Define how ${lowerRequest.includes("mode") ? "the three modes" : "the requested behavior"} differs so standard stays direct, guided explains before coding, and socratic requires user validation before execution.`,
      files: prioritizedFiles.slice(0, 3),
      verification: [
        "Check the docs and system prompt wording for consistent semantics.",
        "Make sure standard mode remains the direct execution path.",
      ],
    },
    {
      id: "wire-the-live-runtime",
      title: "Wire the live runtime",
      summary:
        "Introduce a planning layer in front of the active coding agent, then persist enough state to continue guided and socratic flows across turns.",
      files: prioritizedFiles.slice(2, 6),
      verification: [
        "Confirm guided mode emits a project explanation before agent execution begins.",
        "Confirm socratic mode blocks agent execution until the user demonstrates understanding.",
      ],
    },
    {
      id: "prove-the-behavior",
      title: "Prove the behavior",
      summary:
        "Update tests and package docs so the shipped contract matches the actual runtime, not the old prompt-only distinction.",
      files: prioritizedFiles.slice(4),
      verification: [
        "Run the core test suite for the updated session behavior.",
        "Review the README and modes doc so teammates can understand the new contract.",
      ],
    },
  ];

  return {
    goal: request.trim(),
    summary:
      "Implement distinct mode behavior on top of the live coding-agent runtime so each mode changes the user experience, not just the wording of the prompt.",
    architecture: [
      "Keep `standard` as the direct coding-agent path with minimal extra ceremony.",
      "Add a plan-building layer that inspects the repo and explains the implementation shape before any coding in `guided` and `socratic`.",
      "Persist pending plan and validation state across turns so socratic can block execution until the user passes the understanding check.",
    ],
    phases,
  };
}

export async function buildImplementationPlan({
  llm,
  projectPath,
  request,
  sharedFiles,
}: BuildPlanOptions): Promise<ImplementationPlan> {
  const entries = await collectRepoEntries(projectPath).catch(() => [] as RepoEntry[]);
  const samples = await readProjectSample(projectPath, entries).catch(
    () => [] as Array<{ path: string; snippet: string }>
  );
  const fallback = buildFallbackPlan(projectPath, request, entries, sharedFiles);

  const snapshot = [
    `Project root: ${projectPath}`,
    `Shared files: ${sharedFiles.length > 0 ? sharedFiles.join(", ") : "(none)"}`,
    "Repo entries:",
    ...entries.slice(0, 120).map((entry) => `- ${entry.path}`),
    "",
    "Sample file snippets:",
    ...samples.flatMap((sample) => [`FILE ${sample.path}`, sample.snippet, ""]),
  ].join("\n");

  const raw = await safeComplete(
    llm,
    [
      {
        role: "system",
        content: [
          "Return only JSON.",
          "You are planning a coding-agent implementation for a local repository.",
          "Build a concrete implementation plan that explains architecture, files to change, and verification.",
          "Use this JSON schema:",
          '{"goal":"string","summary":"string","architecture":["string"],"phases":[{"title":"string","summary":"string","files":[{"path":"string","action":"create|update","why":"string"}],"verification":["string"]}]}',
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          request,
          projectSnapshot: snapshot,
          fallbackPlan: fallback,
        }),
      },
    ],
    JSON.stringify(fallback)
  );

  const json = extractJsonObject(raw);
  if (!json) {
    return fallback;
  }

  try {
    return normalizePlan(JSON.parse(json), fallback);
  } catch {
    return fallback;
  }
}

function fallbackQuestionKeywords(phase: ImplementationPhase): string[] {
  const titleWords = phase.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
  const fileWords = phase.files.flatMap((file) =>
    basename(file.path)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3)
  );
  return Array.from(new Set([...titleWords, ...fileWords])).slice(0, 4);
}

export function buildValidationQuestions(plan: ImplementationPlan, phaseIndex: number): ValidationQuestion[] {
  const phase = plan.phases[phaseIndex];
  if (!phase) {
    return [];
  }

  const [primaryFile, secondaryFile] = phase.files;
  const phaseKeywords = fallbackQuestionKeywords(phase);

  return [
    {
      id: `validation-${phaseIndex + 1}-1`,
      prompt: `In your own words, what is phase ${phaseIndex + 1}, "${phase.title}," trying to achieve?`,
      expectedKeywords: Array.from(new Set([phase.title.toLowerCase(), ...phaseKeywords])).slice(0, 5),
    },
    {
      id: `validation-${phaseIndex + 1}-2`,
      prompt: "Which file or module should change first in this phase, and what responsibility does it own?",
      expectedKeywords: Array.from(
        new Set([
          ...(primaryFile
            ? basename(primaryFile.path)
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((word) => word.length >= 3)
            : []),
          ...(secondaryFile
            ? basename(secondaryFile.path)
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((word) => word.length >= 3)
            : []),
          ...phaseKeywords,
        ])
      ).slice(0, 5),
    },
    {
      id: `validation-${phaseIndex + 1}-3`,
      prompt: "What would you verify after this phase to prove it works and does not regress?",
      expectedKeywords: Array.from(
        new Set(
          phase.verification
            .flatMap((item) =>
              item
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((word) => word.length >= 4)
            )
            .concat(["verify", "test", "check"])
        )
      ).slice(0, 5),
    },
  ];
}

export function formatPlanForUser(plan: ImplementationPlan, mode: "guided" | "socratic"): string {
  const lines = [
    `${mode === "guided" ? "Guided mode" : "Socratic mode"} is mapping the work before any coding starts.`,
    "",
    `Goal: ${plan.goal}`,
    `Summary: ${plan.summary}`,
    "",
    "Architecture notes:",
    ...plan.architecture.map((item) => `- ${item}`),
    "",
    "Implementation phases:",
    ...plan.phases.flatMap((phase, index) => [
      `${index + 1}. ${phase.title}: ${phase.summary}`,
      ...phase.files.map((file) => `   - ${file.action.toUpperCase()} ${file.path}: ${file.why}`),
      ...phase.verification.map((item) => `   - Verify: ${item}`),
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatPhaseForUser(plan: ImplementationPlan, phaseIndex: number, mode: "guided" | "socratic"): string {
  const phase = plan.phases[phaseIndex];
  if (!phase) {
    return `${mode === "guided" ? "Guided mode" : "Socratic mode"} has no remaining phases to explain.\n`;
  }

  const lines = [
    `${mode === "guided" ? "Guided mode" : "Socratic mode"} is ready for phase ${phaseIndex + 1} of ${plan.phases.length}.`,
    "",
    `Phase: ${phase.title}`,
    `Why this phase exists: ${phase.summary}`,
    "",
    "Files and responsibilities:",
    ...phase.files.map((file) => `- ${file.action.toUpperCase()} ${file.path}: ${file.why}`),
    "",
    "Verification for this phase:",
    ...phase.verification.map((item) => `- ${item}`),
  ];

  return `${lines.join("\n")}\n`;
}

export function formatGuidedApprovalPrompt(plan: ImplementationPlan, phaseIndex: number): string {
  const phase = plan.phases[phaseIndex];
  return [
    `Do you understand phase ${phaseIndex + 1}${phase ? `, "${phase.title},"` : ""} and should I execute it now?`,
    'Reply with something like "yes", "ok", "go ahead", or ask a question about the phase first.',
  ].join("\n");
}

export function looksLikeApproval(message: string): boolean {
  return /^(yes|yep|yeah|ok|okay|approved|approve|go|go ahead|continue|next|proceed|do it|ship it|sounds good)\b/i.test(
    message.trim()
  );
}

export function looksLikeBypassRequest(message: string): boolean {
  return /^(just\s+do\s+it|do\s+it|skip|continue|proceed|go\s+ahead|ship\s+it|i\s+don'?t\s+know)\b/i.test(
    message.trim()
  );
}

export function looksLikeGuidedContinuation(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) {
    return false;
  }
  if (looksLikeApproval(trimmed)) {
    return true;
  }
  if (/[?？]\s*$/.test(trimmed)) {
    return false;
  }
  if (/^(what|why|how|which|where|when|can you|could you|explain)\b/i.test(trimmed)) {
    return false;
  }
  return trimmed.length >= 3;
}

export function buildPhaseExecutionPrompt(
  request: string,
  plan: ImplementationPlan,
  phaseIndex: number,
  mode: "guided" | "socratic"
): string {
  const phase = plan.phases[phaseIndex];
  return [
    request,
    "",
    `Execution context: this request is running in ${mode} mode.`,
    `Execute only phase ${phaseIndex + 1} of ${plan.phases.length}: ${phase?.title ?? "Current phase"}.`,
    "Do not execute later phases yet.",
    "When this phase is done, summarize exactly what changed and what remains for the next phase.",
    "",
    JSON.stringify(
      {
        goal: plan.goal,
        summary: plan.summary,
        architecture: plan.architecture,
        currentPhase: phase,
        phaseIndex,
        totalPhases: plan.phases.length,
      },
      null,
      2
    ),
  ].join("\n");
}

export function formatValidationPrompt(questions: ValidationQuestion[]): string {
  const lines = [
    "Before I execute the plan, answer these in your own words so I know the project shape is clear:",
    ...questions.map((question, index) => `${index + 1}. ${question.prompt}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatPhaseValidationPrompt(
  plan: ImplementationPlan,
  phaseIndex: number,
  questions: ValidationQuestion[]
): string {
  const phase = plan.phases[phaseIndex];
  const lines = [
    `Before I execute phase ${phaseIndex + 1}${phase ? `, "${phase.title},"` : ""} answer these in your own words:`,
    ...questions.map((question, index) => `${index + 1}. ${question.prompt}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatExecutionApprovalPrompt(
  plan: ImplementationPlan,
  phaseIndex: number,
  mode: "guided" | "socratic"
): string {
  const phase = plan.phases[phaseIndex];
  return [
    `${
      mode === "guided" ? "If that plan looks right" : "You passed the quiz for this phase"
    }, should I execute phase ${phaseIndex + 1}${phase ? `, "${phase.title},"` : ""} now?`,
    'Reply with something like "yes", "ok", or "go ahead", or ask a follow-up question first.',
  ].join("\n");
}

function normalizeEvaluationResult(raw: unknown, fallback: BuildValidationResult): BuildValidationResult {
  if (typeof raw !== "object" || raw === null) {
    return fallback;
  }

  const candidate = raw as {
    score?: Partial<AnswerScore>;
    followUp?: unknown;
  };
  const rawScore = candidate.score ?? {};
  const score: AnswerScore = {
    goalUnderstanding: clampScore(rawScore.goalUnderstanding, 2),
    fileOwnership: clampScore(rawScore.fileOwnership, 3),
    responsibilitySeparation: clampScore(rawScore.responsibilitySeparation, 3),
    dataControlFlow: clampScore(rawScore.dataControlFlow, 3),
    verificationPlan: clampScore(rawScore.verificationPlan, 2),
  };
  const total = sumScore(score);
  const classification = classifyScore(total);
  const passed =
    total >= 10 && score.fileOwnership >= 2 && score.responsibilitySeparation >= 2 && score.verificationPlan >= 1;

  return {
    passed,
    classification,
    score,
    total,
    ...(typeof candidate.followUp === "string" ? { followUp: normalizeWhitespace(candidate.followUp) } : {}),
  };
}

function scoreAnswerHeuristically(
  plan: ImplementationPlan,
  phaseIndex: number,
  questions: ValidationQuestion[],
  answer: string
): AnswerScore {
  const normalizedAnswer = answer.toLowerCase();
  const phase = plan.phases[phaseIndex];
  const phaseKeywords = [
    ...(phase?.title ?? "").toLowerCase().split(/[^a-z0-9]+/),
    ...(phase?.summary ?? "").toLowerCase().split(/[^a-z0-9]+/),
  ].filter((word) => word.length >= 4);
  const fileNames = (phase?.files ?? []).flatMap((file) =>
    file.path
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3)
  );
  const responsibilityWords = ["own", "handle", "responsib", "controller", "service", "module", "boundary", "separate"];
  const flowWords = ["flow", "request", "route", "call", "then", "through", "control", "data", "response"];
  const verificationWords = ["test", "verify", "check", "expect", "assert", "run", "regress", "manual"];

  const phaseHits = phaseKeywords.filter((keyword) => normalizedAnswer.includes(keyword)).length;
  const fileHits = fileNames.filter((keyword) => normalizedAnswer.includes(keyword)).length;
  const responsibilityHits = responsibilityWords.filter((keyword) => normalizedAnswer.includes(keyword)).length;
  const flowHits = flowWords.filter((keyword) => normalizedAnswer.includes(keyword)).length;
  const verificationHits = verificationWords.filter((keyword) => normalizedAnswer.includes(keyword)).length;
  const questionHits = questions.filter((question) =>
    question.expectedKeywords.some((keyword) => normalizedAnswer.includes(keyword.toLowerCase()))
  ).length;

  return {
    goalUnderstanding: phaseHits > 1 || questionHits > 0 ? 2 : phaseHits === 1 ? 1 : 0,
    fileOwnership: Math.min(3, fileHits + (fileHits > 0 && responsibilityHits > 0 ? 1 : 0)),
    responsibilitySeparation: Math.min(3, responsibilityHits),
    dataControlFlow: Math.min(3, flowHits),
    verificationPlan: Math.min(2, verificationHits),
  };
}

function buildStrongerAnswer(plan: ImplementationPlan, phaseIndex: number): string {
  const phase = plan.phases[phaseIndex];
  if (!phase) {
    return "I would restate the goal, name the file boundary, describe the flow through the changed modules, and name the verification command or manual check.";
  }

  const files = phase.files
    .map((file) => `${file.path} owns ${file.why.replace(/\.$/, "")}`)
    .join("; ");
  const verification =
    phase.verification.length > 0
      ? phase.verification.join("; ")
      : "run the narrowest relevant test or manual check and confirm the expected behavior.";

  return `Phase ${phaseIndex + 1} should ${phase.summary.replace(/\.$/, "")}. ${files || "The changed module should own the smallest relevant boundary."}. The flow should move through those responsibilities in order, without mixing unrelated concerns. I would verify it by: ${verification}`;
}

function buildSocraticFeedback(
  plan: ImplementationPlan,
  phaseIndex: number,
  answer: string,
  result: BuildValidationResult
): string {
  const missing: string[] = [];
  if (result.score.goalUnderstanding < 2) missing.push("State the phase goal more concretely.");
  if (result.score.fileOwnership < 2) missing.push("Name the main file or module that owns the change.");
  if (result.score.responsibilitySeparation < 2) missing.push("Separate input/output, business logic, and shared boundaries.");
  if (result.score.dataControlFlow < 2) missing.push("Describe how data or control moves through the system.");
  if (result.score.verificationPlan < 1) missing.push("Include at least one verification step with an expected result.");

  const understood: string[] = [];
  if (result.score.goalUnderstanding > 0) understood.push("You were directionally close on the phase goal.");
  if (result.score.fileOwnership > 0) understood.push("You mentioned at least part of the file/module boundary.");
  if (result.score.verificationPlan > 0) understood.push("You included some verification instinct.");

  const lines = [
    result.classification === "partial" ? "Your answer is partially correct." : "Tighten the explanation before I continue.",
    "",
    `Score: ${result.total}/13`,
    "",
    "What you understood:",
    ...(understood.length > 0 ? understood.map((item) => `- ${item}`) : ["- Not enough of the architecture was clear yet."]),
    "",
    "What is missing:",
    ...missing.map((item) => `- ${item}`),
    "",
    "Your answer:",
    answer.trim() || "(empty)",
    "",
    "Stronger answer:",
    buildStrongerAnswer(plan, phaseIndex),
    "",
    "Why it matters:",
    "This prevents blind approval: you should know the file ownership, the responsibility split, the execution flow, and how we will prove the phase worked.",
  ];

  if (result.classification === "partial") {
    lines.push("", "Before I continue, confirm:", "Do you agree with this architecture and want me to execute this phase?");
  } else {
    lines.push("", result.followUp ?? "Reply with your explanation again, including the file boundary and verification path.");
  }

  return `${lines.join("\n")}\n`;
}

export async function evaluateValidationAnswer(
  llm: LLMAdapter,
  plan: ImplementationPlan,
  phaseIndex: number,
  questions: ValidationQuestion[],
  answer: string
): Promise<BuildValidationResult> {
  const phaseTitle = plan.phases[phaseIndex]?.title ?? "this phase";
  const heuristicScore = scoreAnswerHeuristically(plan, phaseIndex, questions, answer);
  const heuristicTotal = sumScore(heuristicScore);
  const heuristicClassification = classifyScore(heuristicTotal);
  const fallbackResult: BuildValidationResult = {
    passed:
      heuristicTotal >= 10 &&
      heuristicScore.fileOwnership >= 2 &&
      heuristicScore.responsibilitySeparation >= 2 &&
      heuristicScore.verificationPlan >= 1,
    classification: heuristicClassification,
    score: heuristicScore,
    total: heuristicTotal,
    followUp: `Tighten the explanation for ${phaseTitle}. Explain the goal, file ownership, responsibility split, data/control flow, and verification path.`,
  };

  const raw = await safeComplete(
    llm,
    [
      {
        role: "system",
        content: [
          "Return only JSON.",
          'Use the schema {"score":{"goalUnderstanding":0-2,"fileOwnership":0-3,"responsibilitySeparation":0-3,"dataControlFlow":0-3,"verificationPlan":0-2},"followUp":"string"}',
          "Score the user answer using these dimensions: goal understanding, file ownership, responsibility separation, data/control flow, and verification plan.",
          "Socratic mode passes only at 10/13 or higher with file ownership >= 2, responsibility separation >= 2, and verification plan >= 1.",
          "Accept imperfect wording and non-technical language when the mental model is clear. Reject blind approval, no file ownership, and no verification path.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          plan,
          phaseIndex,
          questions,
          answer,
        }),
      },
    ],
    JSON.stringify(fallbackResult)
  );

  const json = extractJsonObject(raw);
  if (!json) {
    return {
      ...fallbackResult,
      followUp: buildSocraticFeedback(plan, phaseIndex, answer, fallbackResult),
    };
  }

  try {
    const result = normalizeEvaluationResult(JSON.parse(json), fallbackResult);
    if (result.passed) {
      return result;
    }
    return {
      ...result,
      followUp: buildSocraticFeedback(plan, phaseIndex, answer, result),
    };
  } catch {
    return {
      ...fallbackResult,
      followUp: buildSocraticFeedback(plan, phaseIndex, answer, fallbackResult),
    };
  }
}

export function renderArchitectureMarkdown(
  plan: ImplementationPlan,
  completedPhaseCount: number,
  mode: "guided" | "socratic"
): string {
  const lines = [
    "# Architecture",
    "",
    `Mode: ${mode}`,
    `Goal: ${plan.goal}`,
    "",
    "## Summary",
    "",
    plan.summary,
    "",
    "## Architecture Notes",
    "",
    ...plan.architecture.map((item) => `- ${item}`),
    "",
    "## Phases",
    "",
    ...plan.phases.flatMap((phase, index) => [
      `### ${index + 1}. ${phase.title}`,
      "",
      `Status: ${index < completedPhaseCount ? "completed" : index === completedPhaseCount ? "active" : "pending"}`,
      "",
      phase.summary,
      "",
      "Files and responsibilities:",
      ...phase.files.map((file) => `- ${file.action.toUpperCase()} ${file.path}: ${file.why}`),
      "",
      "Verification:",
      ...(phase.verification.length > 0 ? phase.verification.map((item) => `- ${item}`) : ["- Not specified yet."]),
      "",
    ]),
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function buildExecutionPrompt(request: string, plan: ImplementationPlan, mode: "guided" | "socratic"): string {
  return [
    request,
    "",
    `Execution context: this request is running in ${mode} mode.`,
    "Follow the approved implementation plan below.",
    "Keep the implementation consistent with this plan unless repo reality forces a better boundary, in which case explain the adjustment briefly.",
    "",
    JSON.stringify(plan, null, 2),
  ].join("\n");
}

export function isPathInsideProject(projectPath: string, candidatePath: string): boolean {
  const normalizedProjectPath = resolve(projectPath);
  const normalizedCandidatePath = resolve(candidatePath);
  return (
    normalizedCandidatePath === normalizedProjectPath ||
    normalizedCandidatePath.startsWith(`${normalizedProjectPath}${sep}`)
  );
}
