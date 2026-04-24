import { v4 as uuidv4 } from "uuid";

import type {
  ImplementationPlan,
  Intent,
  Mode,
  SessionState,
  TrailEntry,
  TrailEntryType,
  ValidationQuestion,
} from "../types.js";

export type ModePhase = "idle" | "planning" | "awaiting-approval" | "awaiting-validation" | "executing" | "verifying";

export interface ModeHistoryEntry {
  mode: Mode;
  at: string;
}

export interface MilestoneRecord {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  checkpointLabel: string;
  checkpointAttempts: number;
}

export interface GuidedRuntimeState {
  topic: string;
  questions: Array<{ category: string; question: string }>;
  questionIndex: number;
  answers: Array<{ category: string; question: string; answer: string }>;
  briefPath?: string;
  briefSummary?: string;
  milestones: MilestoneRecord[];
  activeMilestoneIndex: number;
  pendingProbe?: string;
  awaiting: "design_answer" | "checkpoint" | "probe" | "idle";
}

export interface StandardRuntimeState {
  topic: string;
  clarificationAsked: boolean;
  clarificationAnswer?: string;
  delivered: boolean;
  awaiting: "clarification" | "checkpoint" | "idle";
  checkpointAttempts: number;
}

export interface SocraticRuntimeState {
  topic: string;
  subProblems: Array<{
    id: string;
    description: string;
    questions: string[];
    resolved: boolean;
    order: number;
  }>;
  activeSubProblemIndex: number;
  questionIndex: number;
  awaiting: "question" | "checkpoint" | "idle";
  checkpointAttempts: number;
}

export interface RuntimeSessionContext {
  activeIntent?: Intent;
  modeHistory: ModeHistoryEntry[];
  guided: GuidedRuntimeState | undefined;
  standard: StandardRuntimeState | undefined;
  socratic: SocraticRuntimeState | undefined;
}

export interface PendingModePlan {
  mode: "guided" | "socratic";
  intent: Intent;
  request: string;
  plan: ImplementationPlan;
  validationQuestions: ValidationQuestion[];
  attempts: number;
  currentPhaseIndex: number;
  validationPassed: boolean;
}

export function now(): string {
  return new Date().toISOString();
}

export function createInitialState(projectPath: string): SessionState {
  const createdAt = now();
  return {
    id: uuidv4(),
    projectPath,
    mode: "guided",
    understandingScore: 60,
    activeMilestone: "Waiting for the first concrete task",
    activeSubProblem: "Clarify the goal before implementation",
    sharedFiles: [],
    createdAt,
    lastActive: createdAt,
    modePhase: "idle",
  };
}

export function createTrailEntry(type: TrailEntryType, mode: Mode, payload: unknown, intent?: Intent): TrailEntry {
  return {
    id: uuidv4(),
    timestamp: now(),
    type,
    mode,
    payload,
    ...(intent ? { intent } : {}),
  };
}

export function touchState(state: SessionState): void {
  state.lastActive = now();
}

export function deriveDisplayState(state: SessionState, runtime: RuntimeSessionContext): void {
  if (runtime.guided) {
    const milestone = runtime.guided.milestones[runtime.guided.activeMilestoneIndex];
    const totalQuestions = Math.max(1, runtime.guided.questions.length);
    state.activeMilestone = milestone?.title ?? "Design interview";
    state.activeSubProblem =
      runtime.guided.awaiting === "design_answer"
        ? `Design question ${Math.min(runtime.guided.questionIndex + 1, totalQuestions)} of ${totalQuestions}`
        : runtime.guided.awaiting === "checkpoint" || runtime.guided.awaiting === "probe"
          ? "Explain the milestone back before moving on"
          : "Guided flow ready for the next milestone";
    return;
  }

  if (runtime.standard) {
    state.activeMilestone = "Standard implementation pass";
    state.activeSubProblem =
      runtime.standard.awaiting === "clarification"
        ? "Collect one clarification before implementation"
        : runtime.standard.awaiting === "checkpoint"
          ? "Digest the generated implementation"
          : "Standard mode waiting for the next task";
    return;
  }

  if (runtime.socratic) {
    const active = runtime.socratic.subProblems[runtime.socratic.activeSubProblemIndex];
    state.activeMilestone = "Socratic decomposition";
    state.activeSubProblem = active?.description ?? "Break the problem into smaller pieces";
    return;
  }

  state.activeMilestone = "Waiting for the next task";
  state.activeSubProblem = "No active guided step";
}

export function bumpUnderstanding(state: SessionState, delta: number): void {
  state.understandingScore = Math.max(0, Math.min(100, state.understandingScore + delta));
}
