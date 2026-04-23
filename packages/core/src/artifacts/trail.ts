import type { ADR, SessionState, TrailEntry } from "../types.js";
import type { ModeHistoryEntry } from "../session/state.js";

function renderChunkPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  return JSON.stringify(payload, null, 2);
}

export function renderTrailMarkdown(
  state: SessionState,
  trail: TrailEntry[],
  adrs: ADR[],
  modeHistory: ModeHistoryEntry[]
): string {
  const lines: string[] = [
    "# Struggle AI Learning Trail",
    "",
    `- Session ID: ${state.id}`,
    `- Project Path: ${state.projectPath}`,
    `- Created At: ${state.createdAt}`,
    `- Last Active: ${state.lastActive}`,
    "",
    "## Mode History",
    "",
    ...modeHistory.map((entry) => `- ${entry.at}: ${entry.mode}`),
    "",
    "## Transcript",
    "",
  ];

  for (const entry of trail) {
    lines.push(`### ${entry.timestamp} · ${entry.type}`);
    lines.push("");
    if (entry.intent) {
      lines.push(`Intent: \`${entry.intent}\``);
      lines.push("");
    }
    const maybePayload = entry.payload as { chunks?: Array<{ kind: string; value?: string; language?: string; adr?: ADR }> };
    if (maybePayload && Array.isArray(maybePayload.chunks)) {
      for (const chunk of maybePayload.chunks) {
        if (chunk.kind === "code") {
          lines.push(`\`\`\`${chunk.language ?? "text"}`);
          lines.push(chunk.value ?? "");
          lines.push("```");
          lines.push("");
        } else if (chunk.kind === "adr" && chunk.adr) {
          lines.push(`ADR: ${chunk.adr.title}`);
          lines.push("");
        } else {
          lines.push(renderChunkPayload(chunk));
          lines.push("");
        }
      }
      continue;
    }

    lines.push("```json");
    lines.push(renderChunkPayload(entry.payload));
    lines.push("```");
    lines.push("");
  }

  lines.push("## ADRs");
  lines.push("");
  for (const adr of adrs) {
    lines.push(`### ${adr.title}`);
    lines.push("");
    lines.push(adr.context);
    lines.push("");
    lines.push(`Decision: ${adr.decision}`);
    lines.push("");
    lines.push(`Consequences: ${adr.consequences}`);
    lines.push("");
    if (adr.docLinks.length > 0) {
      lines.push("References:");
      lines.push(...adr.docLinks.map((docLink) => `- ${docLink}`));
      lines.push("");
    }
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Trail entries: ${trail.length}`);
  lines.push(`- ADRs generated: ${adrs.length}`);
  lines.push(`- Shared files: ${state.sharedFiles.length}`);
  return `${lines.join("\n")}\n`;
}
