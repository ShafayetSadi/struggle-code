import type { Mode, ResponseChunk } from "@struggle-ai/core";

import { padToWidth, truncateToWidth, visibleWidth } from "../pi-tui/src/index.js";
import { P, chalk } from "./palette.js";

export function wrapAt(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;
  for (const word of words) {
    const wordWidth = visibleWidth(word);
    if (currentWidth === 0) {
      current = word;
      currentWidth = wordWidth;
    } else if (currentWidth + 1 + wordWidth <= width) {
      current += " " + word;
      currentWidth += 1 + wordWidth;
    } else {
      lines.push(current);
      current = word;
      currentWidth = wordWidth;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function modePill(mode: Mode): string {
  const cfg =
    mode === "guided"
      ? P.modeGuided
      : mode === "standard"
        ? P.modeStandard
        : P.modeSocratic;
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
  const bodyLines = lines.flatMap((line) => {
    if (line.trim() === "") return [""];
    if (line.includes("\x1b[")) return [line];
    return wrapAt(line, innerWidth);
  });

  for (const line of bodyLines) {
    const colored = line.includes("\x1b[") ? line : chalk.hex(theme.textColor)(line);
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

// ── Syntax highlighter ───────────────────────────────────────────────────────
const TS_KEYWORDS = new Set([
  "abstract","as","async","await","break","case","catch","class","const",
  "continue","debugger","declare","default","delete","do","else","enum",
  "export","extends","false","finally","for","from","function","if","implements",
  "import","in","instanceof","interface","let","module","namespace","new","null",
  "of","override","package","private","protected","public","readonly","return",
  "satisfies","static","super","switch","this","throw","true","try","type",
  "typeof","undefined","var","void","while","with","yield",
]);

function highlightToken(token: string): string {
  if (/^([\'\`"]).*\1$/.test(token) || token.startsWith("`")) {
    return chalk.hex(P.green)(token);
  }
  if (/^-?\d[\d_]*(\.[\d]+)?([eE][+-]?\d+)?(n)?$/.test(token)) {
    return chalk.hex(P.orange)(token);
  }
  if (TS_KEYWORDS.has(token.replace(/[^a-zA-Z]/g, ""))) {
    return chalk.hex(P.purple)(token);
  }
  if (/^[A-Z][a-zA-Z0-9_]*/.test(token)) {
    return chalk.hex(P.yellow)(token);
  }
  if (token.startsWith("@")) {
    return chalk.hex(P.blue)(token);
  }
  if (/^[=<>!&|+\-*\/%^~?:]+$/.test(token) || /^[{}()[\],;.]$/.test(token)) {
    return chalk.hex(P.textSecondary)(token);
  }
  return chalk.hex(P.teal)(token);
}

function highlightLine(line: string, lang: string): string {
  const isCodeLang = /^(ts|tsx|js|jsx|typescript|javascript|json|bash|sh|css|html|yaml|yml)$/.test(lang.toLowerCase());

  if (line.trimStart().startsWith("//") || line.trimStart().startsWith("#")) {
    return chalk.hex(P.textMuted).italic(line);
  }
  if (line.trimStart().startsWith("*") || line.trimStart().startsWith("/*") || line.trimStart().startsWith("*/")) {
    return chalk.hex(P.textMuted).italic(line);
  }

  if (!isCodeLang) return chalk.hex(P.teal)(line);

  if (lang === "json") {
    let out = line;
    out = out.replace(/"([^"]+)"(\s*:)/g, chalk.hex(P.blue)('"') + "$1" + chalk.hex(P.blue)('"') + chalk.hex(P.textSecondary)("$2"));
    return out;
  }

  const tokens = line.split(/(\s+|[{}()[\]=<>!&|+\-*\/%^~?:,;.@"\'\`])/);
  return tokens.map((tok) => {
    if (tok === "" || /^\s+$/.test(tok)) return tok;
    return highlightToken(tok);
  }).join("");
}

function formatCodeBlock(language: string, value: string): string[] {
  const lang = language.trim();
  const codeLines = value.trimEnd().split("\n");
  const langLabel = lang
    ? chalk.bgHex(P.bgPanel).hex(P.blue).bold(` ${lang} `) + chalk.hex(P.borderSubtle)(" ")
    : chalk.hex(P.textMuted)("code");
  return [
    chalk.hex(P.borderSubtle)("─── ") + langLabel,
    ...codeLines.map((l) => "  " + highlightLine(l, lang)),
    chalk.hex(P.borderSubtle)("───"),
  ];
}

function formatADRCard(chunk: Extract<ResponseChunk, { kind: "adr" }>): string[] {
  const { adr } = chunk;
  return [
    chalk.hex(P.purple).bold(`ADR  ${adr.title}`),
    `${chalk.hex(P.textMuted)("context")}      ${adr.context}`,
    `${chalk.hex(P.textMuted)("decision")}     ${adr.decision}`,
    `${chalk.hex(P.textMuted)("consequences")} ${adr.consequences}`,
    ...(adr.docLinks.length > 0
      ? [`${chalk.hex(P.textMuted)("docs")}         ${adr.docLinks.join("  ")}`]
      : []),
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

// ── Inline markdown → chalk ──────────────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, and plain text — in one pass.
function renderInline(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        out += chalk.hex(P.textPrimary).bold(text.slice(i + 2, end));
        i = end + 2;
        continue;
      }
    }
    // *italic*  (single star, not double)
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        out += chalk.hex(P.textSecondary).italic(text.slice(i + 1, end));
        i = end + 1;
        continue;
      }
    }
    // `inline code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        out += chalk.hex(P.teal)("`" + text.slice(i + 1, end) + "`");
        i = end + 1;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

// ── Block markdown → lines ───────────────────────────────────────────────────
// Handles: ####/###/##/# headings, ---, bullet lists (* / - / 1.),
// fenced code blocks (```), and plain paragraphs.
function renderMarkdownText(raw: string): string[] {
  const inputLines = raw.split("\n");
  const output: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeLines: string[] = [];

  const flushCode = () => {
    output.push(...formatCodeBlock(codeBlockLang || "code", codeLines.join("\n")));
    codeLines = [];
    codeBlockLang = "";
  };

  for (const line of inputLines) {
    // Fenced code block toggle
    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trimStart().slice(3).trim();
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      output.push(chalk.hex(P.borderSubtle)("─".repeat(40)));
      continue;
    }

    // Headings — ####, ###, ##, #
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const title = renderInline(headingMatch[2] ?? "");
      if (level === 1) {
        output.push("");
        output.push(chalk.hex(P.textPrimary).bold.underline(title));
        output.push("");
      } else if (level === 2) {
        output.push("");
        output.push(chalk.hex(P.textPrimary).bold(title));
        output.push("");
      } else if (level === 3) {
        output.push("");
        output.push(chalk.hex(P.blue).bold(title));
      } else {
        // ####
        output.push(chalk.hex(P.textSecondary).bold(title));
      }
      continue;
    }

    // Bullet list (* item  or  - item  or  1. item)
    const bulletMatch = line.match(/^(\s*)(\*|-|\d+\.)\s+(.*)/);
    if (bulletMatch) {
      const indent = bulletMatch[1] ?? "";
      const body = renderInline(bulletMatch[3] ?? "");
      output.push(`${indent}${chalk.hex(P.blue)("·")} ${chalk.hex(P.textPrimary)(body)}`);
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      output.push("");
      continue;
    }

    // Plain paragraph — render inline markdown
    output.push(chalk.hex(P.textPrimary)(renderInline(line)));
  }

  // Unclosed code block
  if (inCodeBlock && codeLines.length > 0) flushCode();

  return output;
}

export function formatChunk(chunk: ResponseChunk): string[] {
  switch (chunk.kind) {
    case "text":
      return renderMarkdownText(chunk.value);
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

export { P, chalk, BUBBLE_THEMES, visibleWidth };