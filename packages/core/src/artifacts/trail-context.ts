import type { ModeHistoryEntry } from "../session/state.js";
import type { ADR, SessionState, TrailEntry } from "../types.js";

function truncate(value: string, max = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}...`;
}

function summarizeChunk(chunk: { kind?: string; value?: string; text?: string; adr?: ADR }): string {
  if (chunk.kind === "code") {
    return "code snippet emitted";
  }
  if (chunk.kind === "adr" && chunk.adr) {
    return `ADR generated: ${chunk.adr.title}`;
  }
  if (typeof chunk.value === "string") {
    return truncate(chunk.value);
  }
  if (typeof chunk.text === "string") {
    return truncate(chunk.text);
  }
  return truncate(JSON.stringify(chunk));
}

function summarizePayload(payload: unknown): string {
  if (typeof payload === "string") {
    return truncate(payload);
  }

  if (typeof payload !== "object" || payload === null) {
    return truncate(JSON.stringify(payload));
  }

  const candidate = payload as {
    message?: string;
    path?: string;
    goal?: string;
    title?: string;
    mode?: string;
    provider?: string;
    model?: string;
    exportedTo?: string;
    level?: number;
    chunks?: Array<{ kind?: string; value?: string; text?: string; adr?: ADR }>;
  };

  if (Array.isArray(candidate.chunks) && candidate.chunks.length > 0) {
    return truncate(candidate.chunks.map((chunk) => summarizeChunk(chunk)).join(" | "));
  }

  const signal = [
    candidate.message,
    candidate.path,
    candidate.goal,
    candidate.title,
    candidate.mode,
    candidate.provider && candidate.model ? `${candidate.provider}/${candidate.model}` : undefined,
    candidate.exportedTo,
    typeof candidate.level === "number" ? `hint level ${candidate.level}` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");

  if (signal.length > 0) {
    return truncate(signal);
  }

  return truncate(JSON.stringify(payload));
}

export function buildTrailContext(
  state: SessionState,
  trail: TrailEntry[],
  adrs: ADR[],
  modeHistory: ModeHistoryEntry[]
): string {
  const recentTrail = trail.slice(-40).map((entry) => ({
    timestamp: entry.timestamp,
    type: entry.type,
    mode: entry.mode,
    ...(entry.intent ? { intent: entry.intent } : {}),
    summary: summarizePayload(entry.payload),
  }));

  return JSON.stringify(
    {
      session: {
        id: state.id,
        projectPath: state.projectPath,
        mode: state.mode,
        modePhase: state.modePhase ?? "idle",
        activeMilestone: state.activeMilestone,
        activeSubProblem: state.activeSubProblem,
        sharedFiles: state.sharedFiles,
        createdAt: state.createdAt,
        lastActive: state.lastActive,
      },
      modeHistory,
      existingAdrs: adrs.map((adr) => ({
        title: adr.title,
        decision: adr.decision,
        consequences: adr.consequences,
        createdAt: adr.createdAt,
      })),
      recentTrail,
    },
    null,
    2
  );
}

export function deriveSessionTopic(state: SessionState, trail: TrailEntry[]): string {
  const firstUserTurn = trail.find((entry) => entry.type === "user_turn");
  if (firstUserTurn && typeof (firstUserTurn.payload as { message?: string })?.message === "string") {
    return truncate((firstUserTurn.payload as { message: string }).message, 100);
  }
  if (state.activeMilestone) {
    return state.activeMilestone;
  }
  return "the current project direction";
}

export function collectDecisionSignals(trail: TrailEntry[]): string[] {
  const decisions = trail
    .filter((entry) =>
      ["mode_change", "file_share", "milestone_start", "milestone_complete", "adr_generated", "artifact_export"].includes(
        entry.type
      )
    )
    .map((entry) => `${entry.type}: ${summarizePayload(entry.payload)}`);

  return Array.from(new Set(decisions)).slice(-6);
}

export function collectOpenQuestions(trail: TrailEntry[]): string[] {
  const questions: string[] = [];

  for (const entry of trail) {
    const payload = entry.payload as { chunks?: Array<{ kind?: string; text?: string }> };
    if (!Array.isArray(payload?.chunks)) {
      continue;
    }
    for (const chunk of payload.chunks) {
      if (chunk.kind === "question" && typeof chunk.text === "string") {
        questions.push(truncate(chunk.text));
      }
    }
  }

  return Array.from(new Set(questions)).slice(-4);
}
