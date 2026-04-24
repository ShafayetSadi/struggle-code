import type { Mode, ResponseChunk } from "@struggle-ai/core";

import { padToWidth, truncateToWidth, visibleWidth } from "../pi-tui/src/index.js";
import { chalk, P } from "./palette.js";

export function wrapAt(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function modePill(mode: Mode): string {
  const cfg = mode === "guided" ? P.modeGuided : mode === "standard" ? P.modeStandard : P.modeSocratic;
  const label = ` ${mode.toUpperCase()} `;
  return chalk.bgHex(cfg.bg).hex(cfg.fg).bold(label);
}

interface BubbleTheme {
  bg: string;
  labelColor: string;
  label: string;
  labelIcon: string;
  textColor: string;
  borderLeft: string;
}

const BUBBLE_THEMES: Record<"user" | "assistant" | "error" | "system", BubbleTheme> = {
  user: {
    bg: P.bgUser,
    label: "you",
    labelIcon: "›",
    labelColor: P.blue,
    textColor: P.textPrimary,
    borderLeft: P.blue,
  },
  assistant: {
    bg: P.bgAssistant,
    label: "struggle",
    labelIcon: "◆",
    labelColor: P.green,
    textColor: P.textPrimary,
    borderLeft: P.green,
  },
  error: {
    bg: P.bgError,
    label: "error",
    labelIcon: "✕",
    labelColor: P.red,
    textColor: P.red,
    borderLeft: P.red,
  },
  system: {
    bg: P.bgSystem,
    label: "system",
    labelIcon: "·",
    labelColor: P.textMuted,
    textColor: P.textSecondary,
    borderLeft: P.textMuted,
  },
};

export function renderBubble(
  kind: "user" | "assistant" | "error" | "system",
  lines: string[],
  width: number
): string[] {
  const theme = BUBBLE_THEMES[kind];
  const gutter = 2;
  const innerWidth = Math.max(16, width - gutter * 2 - 2);
  const output: string[] = [];

  const headerIcon = chalk.hex(theme.labelColor).bold(theme.labelIcon);
  const headerLabel = chalk.hex(theme.labelColor).bold(` ${theme.label}`);
  const headerContent = `${" ".repeat(gutter)}${headerIcon}${headerLabel}`;
  output.push(chalk.bgHex(theme.bg)(padToWidth(truncateToWidth(headerContent, width), width)));

  const accentBar = chalk.hex(theme.borderLeft)("│");
  const bodyPad = " ".repeat(gutter);
  const bodyLines = lines.flatMap((line) => (line.trim() === "" ? [""] : wrapAt(line, innerWidth)));

  for (const line of bodyLines) {
    const colored = chalk.hex(theme.textColor)(line);
    const raw = `${bodyPad}${accentBar} ${padToWidth(colored, innerWidth)}`;
    output.push(chalk.bgHex(theme.bg)(padToWidth(truncateToWidth(raw, width), width)));
  }

  output.push(chalk.bgHex(theme.bg)(padToWidth("", width)));
  return output;
}

const THINKING_PHASES = ["·      ", "· ··   ", "· ·· ···", "  ·· ···"];

export function renderThinkingFrame(tick: number, width: number): string[] {
  const theme = BUBBLE_THEMES.assistant;
  const gutter = 2;
  const innerWidth = Math.max(16, width - gutter * 2 - 2);
  const output: string[] = [];

  const headerIcon = chalk.hex(theme.labelColor).bold(theme.labelIcon);
  const headerLabel = chalk.hex(theme.labelColor).bold(` ${theme.label}`);
  const headerContent = `${" ".repeat(gutter)}${headerIcon}${headerLabel}`;
  output.push(chalk.bgHex(theme.bg)(padToWidth(truncateToWidth(headerContent, width), width)));

  const phase = THINKING_PHASES[tick % THINKING_PHASES.length];
  const dotsStyled = chalk.hex(P.green)(phase);
  const label = chalk.hex(P.textMuted)("  thinking…");
  const accentBar = chalk.hex(theme.borderLeft)("│");
  const bodyPad = " ".repeat(gutter);
  const bodyContent = `${dotsStyled}${label}`;
  const raw = `${bodyPad}${accentBar} ${padToWidth(bodyContent, innerWidth)}`;
  output.push(chalk.bgHex(theme.bg)(padToWidth(truncateToWidth(raw, width), width)));

  output.push(chalk.bgHex(theme.bg)(padToWidth("", width)));
  return output;
}

export function streamingCursor(visible: boolean): string {
  return visible ? chalk.hex(P.green)("█") : " ";
}

function formatCodeBlock(language: string, value: string): string[] {
  const lines = value.trimEnd().split("\n");
  return [
    chalk.hex(P.textMuted)(`── ${language} `),
    ...lines.map((l) => chalk.hex(P.teal)(l)),
    chalk.hex(P.textMuted)("──"),
  ];
}

function formatADRCard(chunk: Extract<ResponseChunk, { kind: "adr" }>): string[] {
  const { adr } = chunk;
  return [
    chalk.hex(P.purple).bold(`ADR  ${adr.title}`),
    `${chalk.hex(P.textMuted)("context")}      ${adr.context}`,
    `${chalk.hex(P.textMuted)("decision")}     ${adr.decision}`,
    `${chalk.hex(P.textMuted)("consequences")} ${adr.consequences}`,
    ...(adr.docLinks.length > 0 ? [`${chalk.hex(P.textMuted)("docs")}         ${adr.docLinks.join("  ")}`] : []),
  ];
}

function formatQuestion(text: string): string[] {
  return [chalk.hex(P.yellow)(`?  ${text}`)];
}

function formatSubProblem(chunk: Extract<ResponseChunk, { kind: "sub_problem" }>): string[] {
  const { subProblem } = chunk;
  return [
    chalk.hex(P.blue).bold(`⊡  Sub-problem ${subProblem.order + 1}  ${subProblem.description}`),
    ...subProblem.questions.map((q) => chalk.hex(P.textSecondary)(`   · ${q}`)),
  ];
}

function formatCheckpoint(chunk: Extract<ResponseChunk, { kind: "checkpoint" }>): string[] {
  const label = `  checkpoint · ${chunk.kind2}  `;
  return [chalk.bgHex(P.bgPanel).hex(P.textMuted)("─".repeat(6) + label + "─".repeat(6))];
}

export function formatChunk(chunk: ResponseChunk): string[] {
  switch (chunk.kind) {
    case "text":
      return chunk.value.split("\n");
    case "code":
      return formatCodeBlock(chunk.language, chunk.value);
    case "question":
      return formatQuestion(chunk.text);
    case "adr":
      return formatADRCard(chunk);
    case "checkpoint":
      return formatCheckpoint(chunk);
    case "sub_problem":
      return formatSubProblem(chunk);
  }
}

export function formatPrompt(mode: Mode): string {
  return chalk.hex(P.blue).bold("struggle") + chalk.hex(P.textMuted)(` [${mode}] › `);
}

export { BUBBLE_THEMES, chalk, P, visibleWidth };
