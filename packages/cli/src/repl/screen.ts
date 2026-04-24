import { basename } from "node:path";
import * as process from "node:process";

import type { Mode } from "@struggle-ai/core";

import { CURSOR_MARKER, Input, Key, padToWidth, truncateToWidth, visibleWidth, type SelectItem } from "../pi-tui/src/index.js";
import { commandMatches } from "./commandMenu.js";
import { BUBBLE_THEMES, P, chalk, formatChunk, modePill, renderBubble, renderThinkingFrame, streamingCursor, wrapAt } from "./formatting.js";
import type { LogEntry, LogKind } from "./types.js";

export class ReplScreen {
  private _focused = false;
  private readonly entries: LogEntry[] = [];
  private readonly input = new Input();
  private mode: Mode;
  private readonly projectLabel: string;
  private readonly modelLabel: string;
  private activeSubProblem: string | undefined;
  private busy = false;
  private commandSelection = 0;
  private transcriptScroll = 0;
  private maxTranscriptScroll = 0;
  private readonly onSubmitInput: (value: string) => void;

  private thinking = false;
  private thinkingTick = 0;
  private thinkingTimer: ReturnType<typeof setInterval> | undefined;
  private streaming = false;
  private streamingCursorVisible = false;
  private streamingCursorTimer: ReturnType<typeof setInterval> | undefined;

  constructor(mode: Mode, projectPath: string, modelLabel: string, onSubmitInput: (value: string) => void) {
    this.mode = mode;
    this.projectLabel = basename(projectPath) || projectPath;
    this.modelLabel = modelLabel;
    this.onSubmitInput = onSubmitInput;
    this.input.onSubmit = (value) => {
      if (!this.busy) this.onSubmitInput(value);
    };
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  setBusy(value: boolean): void {
    this.busy = value;
  }

  setMode(mode: Mode): void {
    this.mode = mode;
  }

  setActiveSubProblem(value: string | undefined): void {
    this.activeSubProblem = value;
  }

  clearInput(): void {
    this.input.setValue("");
  }

  setInputValue(value: string): void {
    this.input.setValue(value);
    this.commandSelection = 0;
  }

  getInputValue(): string {
    return this.input.getValue();
  }

  append(kind: LogKind, ...lines: string[]): void {
    const normalized = lines
      .flatMap((line) => line.split("\n"))
      .filter((line, i, all) => line.length > 0 || i < all.length - 1);
    this.entries.push({ kind, lines: normalized.length > 0 ? normalized : [""] });
  }

  startThinking(requestRender: () => void): void {
    this.stopThinking();
    this.thinking = true;
    this.thinkingTick = 0;
    this.thinkingTimer = setInterval(() => {
      this.thinkingTick++;
      requestRender();
    }, 120);
  }

  stopThinking(): void {
    this.thinking = false;
    if (this.thinkingTimer !== undefined) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = undefined;
    }
  }

  startStreaming(requestRender: () => void): void {
    this.stopStreaming();
    this.streaming = true;
    this.streamingCursorVisible = true;
    this.entries.push({ kind: "assistant", lines: [""] });
    this.streamingCursorTimer = setInterval(() => {
      this.streamingCursorVisible = !this.streamingCursorVisible;
      requestRender();
    }, 500);
  }

  appendStreamChunk(text: string): void {
    const last = this.entries[this.entries.length - 1];
    if (!last || last.kind !== "assistant") return;

    const parts = text.split("\n");
    const lastLineIndex = last.lines.length - 1;
    const firstPart = parts[0] ?? "";
    const currentLastLine = last.lines[lastLineIndex] ?? "";
    last.lines[lastLineIndex] = currentLastLine + firstPart;
    for (let i = 1; i < parts.length; i++) {
      last.lines.push(parts[i] ?? "");
    }
  }

  stopStreaming(): void {
    this.streaming = false;
    this.streamingCursorVisible = false;
    if (this.streamingCursorTimer !== undefined) {
      clearInterval(this.streamingCursorTimer);
      this.streamingCursorTimer = undefined;
    }
  }

  handleInput(data: string): void {
    const matches = this.getCommandMatches();
    if (matches.length > 0) {
      if (data === Key.up || data === "\x1b[A") {
        this.commandSelection = Math.max(0, this.commandSelection - 1);
        return;
      }
      if (data === Key.down || data === "\x1b[B") {
        this.commandSelection = Math.min(matches.length - 1, this.commandSelection + 1);
        return;
      }
      if (data === Key.tab) {
        this.applyCommandCompletion(matches[this.commandSelection]);
        return;
      }
    }

    // PageUp → scroll toward older messages
    if (data === Key.pageUp || data === "\x1b[5~") {
      this.transcriptScroll = Math.min(this.transcriptScroll + 8, this.maxTranscriptScroll);
      return;
    }
    // PageDown → scroll toward newer messages
    if (data === Key.pageDown || data === "\x1b[6~") {
      this.transcriptScroll = Math.max(0, this.transcriptScroll - 8);
      return;
    }
    // Home → jump to oldest messages
    if (data === Key.home) {
      this.transcriptScroll = this.maxTranscriptScroll;
      return;
    }
    // End → jump to newest messages
    if (data === Key.end) {
      this.transcriptScroll = 0;
      return;
    }
    // Arrow up/down scroll line-by-line when no command menu is open
    if (data === Key.up || data === "\x1b[A") {
      this.transcriptScroll = Math.min(this.transcriptScroll + 1, this.maxTranscriptScroll);
      return;
    }
    if (data === Key.down || data === "\x1b[B") {
      this.transcriptScroll = Math.max(0, this.transcriptScroll - 1);
      return;
    }

    this.input.handleInput(data);
    const next = this.getCommandMatches();
    this.commandSelection = next.length > 0 ? Math.min(this.commandSelection, next.length - 1) : 0;
  }

  invalidate(): void {
    this.input.invalidate();
  }

  render(width: number): string[] {
    const w = Math.max(60, width);
    // Use process.stdout.rows directly — this is the real terminal height the
    // renderer must fill completely so there is no blank space below the UI.
    const termHeight = process.stdout.rows ?? 24;
    const lines: string[] = [];

    // ── Header (3 lines) ────────────────────────────────────────────────────
    const pill = modePill(this.mode);
    const pillWidth = visibleWidth(pill);
    const statusLeft = chalk.hex(P.textPrimary).bold("  Struggle AI");
    const statusRight = `  ${pill}  `;
    const statusMiddle = padToWidth(truncateToWidth(statusLeft, w - pillWidth - 6), w - pillWidth - 6);
    lines.push(chalk.bgHex("#161b22")(statusMiddle) + chalk.bgHex("#161b22")(statusRight));

    const ctxLabel = chalk.hex(P.textMuted)("  context  ");
    const ctxValue = this.activeSubProblem
      ? chalk.hex(P.textSecondary)(truncateToWidth(this.activeSubProblem, w - 14))
      : chalk.hex(P.textMuted)("no active sub-problem");
    lines.push(chalk.bgHex(P.bg)(padToWidth(truncateToWidth(ctxLabel + ctxValue, w), w)));

    lines.push(chalk.bgHex(P.bg)(chalk.hex(P.borderSubtle)("─".repeat(w))));
    // header = 3 lines total

    // ── Measure everything below the transcript so we can give the rest to it
    const inputLines = this.input.render(w - 4);
    const inputHeight = Math.max(1, inputLines.length);

    // Lines consumed below the transcript (counted precisely):
    //   thinking frame  : 3 lines (conditional)
    //   busy indicator  : 1 line  (conditional, never overlaps thinking)
    //   hint divider    : 1 line  (conditional on hints existing)
    //   hint rows       : 0-4     (conditional)
    //   input separator : 1
    //   input rows      : inputHeight
    //   footer sep      : 1
    //   info bar        : 1
    const hintMatches = this.getCommandMatches().slice(0, 4);
    const hintHeight = hintMatches.length > 0 ? hintMatches.length + 1 : 0;
    const thinkingHeight = this.thinking ? 3 : 0;
    const busyHeight = this.busy && !this.thinking ? 1 : 0;

    const belowTranscript =
      thinkingHeight +
      busyHeight +
      hintHeight +
      1 +           // input separator (─)
      inputHeight +
      1 +           // footer separator (─)
      1;            // info bar

    // Header = 3 lines. Transcript fills everything in between.
    const transcriptViewport = Math.max(4, termHeight - 3 - belowTranscript);

    // ── Build full transcript line buffer ────────────────────────────────────
    const transcriptLines: string[] = [];
    this.entries.forEach((entry, entryIndex) => {
      const isLastEntry = entryIndex === this.entries.length - 1;
      const isStreamingEntry = this.streaming && isLastEntry && entry.kind === "assistant";

      if (!isStreamingEntry) {
        transcriptLines.push(...renderBubble(entry.kind as "user" | "assistant" | "error" | "system", entry.lines, w));
        return;
      }

      const theme = BUBBLE_THEMES.assistant;
      const gutter = 2;
      const innerWidth = Math.max(16, w - gutter * 2 - 2);
      const headerIcon = chalk.hex(theme.labelColor).bold(theme.labelIcon);
      const headerLabel = chalk.hex(theme.labelColor).bold(` ${theme.label}`);
      const headerContent = `${" ".repeat(gutter)}${headerIcon}${headerLabel}`;
      transcriptLines.push(chalk.bgHex(theme.bg)(padToWidth(truncateToWidth(headerContent, w), w)));

      const accentBar = chalk.hex(theme.borderLeft)("│");
      const bodyPad = " ".repeat(gutter);
      const bodyLines = entry.lines.flatMap((line) => (line.trim() === "" ? [""] : wrapAt(line, innerWidth - 1)));

      bodyLines.forEach((line, lineIndex) => {
        const isLastLine = lineIndex === bodyLines.length - 1;
        const cursor = isLastLine ? streamingCursor(this.streamingCursorVisible) : "";
        const colored = chalk.hex(theme.textColor)(line) + cursor;
        const raw = `${bodyPad}${accentBar} ${padToWidth(colored, innerWidth)}`;
        transcriptLines.push(chalk.bgHex(theme.bg)(padToWidth(truncateToWidth(raw, w), w)));
      });

      transcriptLines.push(chalk.bgHex(theme.bg)(padToWidth("", w)));
    });

    // ── Render transcript + scrollbar ────────────────────────────────────────
    if (transcriptLines.length > 0) {
      this.maxTranscriptScroll = Math.max(0, transcriptLines.length - transcriptViewport);
      this.transcriptScroll = Math.min(this.transcriptScroll, this.maxTranscriptScroll);

      const transcriptStart = Math.max(0, transcriptLines.length - transcriptViewport - this.transcriptScroll);
      const visibleSlice = transcriptLines.slice(transcriptStart, transcriptStart + transcriptViewport);

      const totalLines = transcriptLines.length;
      const needsScrollbar = totalLines > transcriptViewport;
      const thumbSize = needsScrollbar
        ? Math.max(1, Math.floor((transcriptViewport / totalLines) * transcriptViewport))
        : transcriptViewport;
      const scrollableRange = transcriptViewport - thumbSize;
      const scrollRatio = this.maxTranscriptScroll > 0
        ? this.transcriptScroll / this.maxTranscriptScroll
        : 0;
      const thumbOffset = needsScrollbar
        ? Math.round((1 - scrollRatio) * scrollableRange)
        : 0;

      // Pad viewport to exact height so blank lines also get a scrollbar glyph
      for (let i = 0; i < transcriptViewport; i++) {
        const isThumb = needsScrollbar && i >= thumbOffset && i < thumbOffset + thumbSize;
        const bar = isThumb
          ? chalk.hex(P.textMuted)("▐")
          : chalk.hex(P.borderSubtle)("╎");
        const trimmed = truncateToWidth(visibleSlice[i] ?? "", w - 1);
        lines.push(chalk.bgHex(P.bg)(padToWidth(trimmed, w - 1)) + chalk.bgHex(P.bg)(bar));
      }
    } else if (!this.thinking) {
      // Empty state — fill viewport so input lands at the bottom
      const emptyMsg = chalk.hex(P.textMuted)("no messages yet  ·  type below or /help");
      const centered = " ".repeat(Math.max(0, Math.floor((w - visibleWidth(emptyMsg)) / 2))) + emptyMsg;
      lines.push(chalk.bgHex(P.bg)(padToWidth(centered, w)));
      for (let i = 1; i < transcriptViewport; i++) {
        lines.push(chalk.bgHex(P.bg)(padToWidth("", w)));
      }
    }

    // ── Thinking / busy indicators ───────────────────────────────────────────
    if (this.thinking) {
      lines.push(...renderThinkingFrame(this.thinkingTick, w));
    }

    if (this.busy && !this.thinking) {
      const working = chalk.hex(P.yellow)("  ◌  working…") + chalk.hex(P.textMuted)("  esc to interrupt");
      lines.push(chalk.bgHex(P.bg)(padToWidth(truncateToWidth(working, w), w)));
    }

    // ── Command hints ────────────────────────────────────────────────────────
    const hints = this.renderCommandHints(w);
    lines.push(...hints);

    // ── Input (pinned to bottom) ─────────────────────────────────────────────
    lines.push(chalk.bgHex(P.bg)(chalk.hex(P.borderMedium)("─".repeat(w))));

    const promptStr = chalk.hex(P.blue)("  › ");
    const promptWidth = visibleWidth(promptStr);
    const inputWidth = Math.max(8, w - promptWidth - 2);
    const renderedInput = this.input.render(inputWidth);
    const inputDisplay = renderedInput.length > 0 ? renderedInput : [this.focused ? CURSOR_MARKER : ""];

    inputDisplay.forEach((line, index) => {
      const prefix = index === 0 ? promptStr : " ".repeat(promptWidth);
      lines.push(chalk.bgHex(P.bg)(padToWidth(truncateToWidth(prefix + line, w), w)));
    });

    // ── Footer info bar ──────────────────────────────────────────────────────
    lines.push(chalk.bgHex(P.bg)(chalk.hex(P.borderMedium)("─".repeat(w))));

    const leftInfo = chalk.hex(P.textMuted)(`  ~/${this.projectLabel}`);
    const rightInfo = chalk.hex(P.textMuted)(`  ${this.modelLabel}`);
    const bottomPad = padToWidth(
      truncateToWidth(leftInfo, w - visibleWidth(rightInfo)),
      w - visibleWidth(rightInfo)
    );
    lines.push(chalk.bgHex("#161b22")(bottomPad + rightInfo));

    return lines;
  }

  private getCommandMatches(): SelectItem[] {
    return commandMatches(this.input.getValue());
  }

  private applyCommandCompletion(item: SelectItem | undefined): void {
    if (!item) return;
    this.input.setValue(item.value);
    this.commandSelection = 0;
  }

  private renderCommandHints(width: number): string[] {
    const matches = this.getCommandMatches().slice(0, 4);
    if (matches.length === 0) return [];

    const labelCol = 20;
    const output: string[] = [];
    output.push(chalk.bgHex(P.bg)(chalk.hex(P.borderSubtle)("╌".repeat(width))));

    for (let i = 0; i < matches.length; i++) {
      const item = matches[i];
      if (!item) continue;
      const selected = i === this.commandSelection;
      const bg = selected ? "#1c2128" : P.bg;
      const marker = selected ? chalk.hex(P.blue)("›") : chalk.hex(P.textMuted)("·");
      const label = selected
        ? chalk.hex(P.textPrimary).bold(padToWidth(item.label, labelCol))
        : chalk.hex(P.textSecondary)(padToWidth(item.label, labelCol));
      const desc = selected
        ? chalk.hex(P.textSecondary)(item.description ?? "")
        : chalk.hex(P.textMuted)(item.description ?? "");
      const content = `  ${marker} ${label}  ${desc}`;
      output.push(chalk.bgHex(bg)(padToWidth(truncateToWidth(content, width), width)));
    }

    return output;
  }
}