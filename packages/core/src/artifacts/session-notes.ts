import type { LLMAdapter } from "../llm/adapter.js";
import { type ModeHistoryEntry } from "../session/state.js";
import type { ADR, IO, SessionState, TrailEntry } from "../types.js";
import { loadPrompt } from "../prompts/loader.js";
import { buildTrailContext, collectDecisionSignals, collectOpenQuestions } from "./trail-context.js";

interface SessionNotesInput {
  state: SessionState;
  trail: TrailEntry[];
  adrs: ADR[];
  modeHistory: ModeHistoryEntry[];
}

function ensureMarkdown(text: string): string {
  const normalized = text.replace(/\r/g, "").trim();
  return normalized.length > 0 ? `${normalized}\n` : "";
}

function renderBulletSection(title: string, items: string[]): string[] {
  return [title, "", ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- None captured yet."]), ""];
}

function buildFallbackNotes(input: SessionNotesInput): string {
  const decisions = collectDecisionSignals(input.trail);
  const openQuestions = collectOpenQuestions(input.trail);
  const learnings = [
    `The session stayed in ${input.state.mode} mode and recorded ${input.trail.length} trail entries.`,
    input.state.sharedFiles.length > 0
      ? `Shared files focused the session on ${input.state.sharedFiles.join(", ")}.`
      : "No files were shared into context yet.",
    input.adrs.length > 0
      ? `The session already captured ${input.adrs.length} ADR record(s).`
      : "No ADRs were captured automatically during the session.",
  ];
  const nextSteps = [
    input.state.activeMilestone ? `Continue the active milestone: ${input.state.activeMilestone}.` : undefined,
    input.state.activeSubProblem ? `Resolve the current focus: ${input.state.activeSubProblem}.` : undefined,
    decisions.length === 0 ? "Make one explicit project decision worth preserving in an ADR." : undefined,
  ].filter((value): value is string => Boolean(value));

  const lines = [
    "# Session Notes",
    "",
    ...renderBulletSection("## Learnings", learnings),
    ...renderBulletSection("## Decisions", decisions),
    ...renderBulletSection("## Open Questions", openQuestions),
    ...renderBulletSection("## Next Steps", nextSteps),
  ];

  return `${lines.join("\n")}\n`;
}

export async function generateSessionNotesMarkdown(
  input: SessionNotesInput,
  llm: LLMAdapter,
  io: IO
): Promise<string> {
  const prompt = await loadPrompt("trail-notes.md", io);

  try {
    const raw = await llm.complete(
      [
        { role: "system", content: prompt },
        { role: "user", content: buildTrailContext(input.state, input.trail, input.adrs, input.modeHistory) },
      ],
      { reasoning: "low" }
    );
    const markdown = ensureMarkdown(raw);
    if (markdown.length > 0) {
      return markdown;
    }
  } catch {
    // Fall back to deterministic notes rendering.
  }

  return buildFallbackNotes(input);
}
