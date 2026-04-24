import * as process from "node:process";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelectItem {
  value: string;
  label: string;
  description?: string;
}

export interface Component {
  handleInput(data: string): void;
  invalidate(): void;
  render(width: number): string[];
  focused?: boolean;
}

export interface OverlayOptions {
  width?: number | string;
  minWidth?: number;
  maxHeight?: number;
  anchor?: "bottom-center" | "top-center" | "center";
  offsetY?: number;
}

export interface OverlayHandle {
  hide(): void;
}

export interface SelectListTheme {
  selectedPrefix?: (text: string) => string;
  selectedText?: (text: string) => string;
  description?: (text: string) => string;
  scrollInfo?: (text: string) => string;
  noMatch?: (text: string) => string;
}

export interface PanelTheme {
  background: (text: string) => string;
  title?: (text: string) => string;
  body?: (text: string) => string;
}

// ─── CURSOR_MARKER ───────────────────────────────────────────────────────────

export const CURSOR_MARKER = "\x00CURSOR\x00";

// ─── Key ─────────────────────────────────────────────────────────────────────

export const Key = {
  ctrl(char: string): string {
    return String.fromCharCode(char.charCodeAt(0) - 96);
  },
  up: "\x1b[A",
  down: "\x1b[B",
  left: "\x1b[D",
  right: "\x1b[C",
  home: "\x1b[H",
  end: "\x1b[F",
  pageUp: "\x1b[5~",
  pageDown: "\x1b[6~",
  delete: "\x1b[3~",
  backspace: "\x7f",
  enter: "\r",
  escape: "\x1b",
  tab: "\t",
};

// ─── ANSI Utilities ───────────────────────────────────────────────────────────

// Matches all ANSI escape sequences (colors, movement, etc.)
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

export function visibleWidth(text: string): number {
  return text.replace(ANSI_ESCAPE_RE, "").length;
}

export function padToWidth(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

export function truncateToWidth(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;

  let result = "";
  let w = 0;
  let i = 0;

  while (i < text.length) {
    // Consume ANSI escape sequence wholesale (don't count it as width)
    if (text[i] === "\x1b" && text[i + 1] === "[") {
      const end = text.indexOf("m", i);
      if (end !== -1) {
        result += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    if (w >= width - 1) {
      result += "…";
      // Append reset so background color doesn't bleed
      result += "\x1b[0m";
      break;
    }
    result += text[i];
    w++;
    i++;
  }

  return result;
}

export function wrapTextWithAnsi(text: string, width: number): string[] {
  if (width <= 0) return [text];
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

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function fillLine(text: string, width: number, formatter?: (text: string) => string): string {
  const padded = padToWidth(truncateToWidth(text, width), width);
  return formatter ? formatter(padded) : padded;
}

export function rule(width: number, formatter?: (text: string) => string, char = "-"): string {
  const line = char.repeat(Math.max(0, width));
  return formatter ? formatter(line) : line;
}

export function renderPanel(title: string, body: string[], width: number, theme: PanelTheme, padding = 2): string[] {
  const safeWidth = Math.max(12, width);
  const innerWidth = Math.max(8, safeWidth - padding * 2);
  const lines: string[] = [];
  const bg = theme.background;

  lines.push(fillLine("", safeWidth, bg));
  lines.push(fillLine(`${" ".repeat(padding)}${theme.title ? theme.title(title) : title}`, safeWidth, bg));
  lines.push(fillLine("", safeWidth, bg));

  for (const line of body.length > 0 ? body : [""]) {
    const wrapped = wrapTextWithAnsi(line, innerWidth);
    for (const wrappedLine of wrapped.length > 0 ? wrapped : [""]) {
      const text = theme.body ? theme.body(wrappedLine) : wrappedLine;
      lines.push(fillLine(`${" ".repeat(padding)}${text}`, safeWidth, bg));
    }
  }

  lines.push(fillLine("", safeWidth, bg));
  return lines;
}

// ─── Input ───────────────────────────────────────────────────────────────────

export class Input implements Component {
  private value = "";
  private cursor = 0;
  private _focused = false;

  onSubmit?: (value: string) => void;

  get focused(): boolean { return this._focused; }
  set focused(v: boolean) { this._focused = v; }

  getValue(): string { return this.value; }

  setValue(v: string): void {
    this.value = v;
    this.cursor = v.length;
  }

  invalidate(): void {}

  private insertText(text: string): void {
    if (text.length === 0) return;
    this.value =
      this.value.slice(0, this.cursor) + text + this.value.slice(this.cursor);
    this.cursor += text.length;
  }

  private normalizePastedText(data: string): string | undefined {
    const bracketedPasteMatch = /^\x1b\[200~([\s\S]*)\x1b\[201~$/.exec(data);
    if (bracketedPasteMatch) {
      return bracketedPasteMatch[1] ?? "";
    }

    if (data.includes("\x1b")) {
      return undefined;
    }

    return data;
  }

  handleInput(data: string): void {
    switch (data) {
      case Key.enter:
      case "\n":
        if (this.onSubmit) {
          const val = this.value;
          this.value = "";
          this.cursor = 0;
          this.onSubmit(val);
        }
        break;

      case Key.backspace:
      case "\b":
        if (this.cursor > 0) {
          this.value =
            this.value.slice(0, this.cursor - 1) + this.value.slice(this.cursor);
          this.cursor--;
        }
        break;

      case Key.delete:
        if (this.cursor < this.value.length) {
          this.value =
            this.value.slice(0, this.cursor) + this.value.slice(this.cursor + 1);
        }
        break;

      case Key.left:
        if (this.cursor > 0) this.cursor--;
        break;

      case Key.right:
        if (this.cursor < this.value.length) this.cursor++;
        break;

      case Key.home:
        this.cursor = 0;
        break;

      case Key.end:
        this.cursor = this.value.length;
        break;

      default:
        // Accept both typed characters and pasted text blocks.
        if (data.length === 1 && data >= " ") {
          this.insertText(data);
          return;
        }

        const pasted = this.normalizePastedText(data);
        if (pasted !== undefined) {
          this.insertText(pasted.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
        }
    }
  }

  render(width: number): string[] {
    const maxVisible = Math.max(1, width - 1);
    const before = this.value.slice(0, this.cursor);
    const after = this.value.slice(this.cursor);

    // Scroll viewport so cursor is always visible
    let start = 0;
    if (before.length > maxVisible) {
      start = before.length - maxVisible;
    }

    const visibleBefore = before.slice(start);
    const visibleAfter = after.slice(0, maxVisible - visibleBefore.length);

    // FIX: check this._focused directly (not after resetting a dirty flag)
    if (this._focused) {
      return [visibleBefore + CURSOR_MARKER + visibleAfter];
    }
    return [visibleBefore + visibleAfter];
  }
}

// ─── SelectList ───────────────────────────────────────────────────────────────

export class SelectList implements Component {
  private items: SelectItem[];
  private filtered: SelectItem[];
  private selectedIndex = 0;
  private scrollOffset = 0;
  private query = "";
  private readonly visibleCount: number;
  private readonly theme: SelectListTheme;

  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;

  constructor(items: SelectItem[], visibleCount = 8, theme: SelectListTheme = {}) {
    this.items = items;
    this.filtered = [...items];
    this.visibleCount = visibleCount;
    this.theme = theme;
  }

  invalidate(): void {}

  handleInput(data: string): void {
    switch (data) {
      case Key.up:
      case "\x1b[A":
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.clampScroll();
        break;

      case Key.down:
      case "\x1b[B":
        this.selectedIndex = Math.min(
          this.filtered.length - 1,
          this.selectedIndex + 1
        );
        this.clampScroll();
        break;

      case Key.enter:
      case "\r": {
        const selected = this.filtered[this.selectedIndex];
        if (selected) this.onSelect?.(selected);
        break;
      }

      case Key.escape:
        this.onCancel?.();
        break;

      case Key.backspace:
      case "\x7f":
        this.query = this.query.slice(0, -1);
        this.applyFilter();
        break;

      default:
        if (data.length === 1 && data >= " ") {
          this.query += data;
          this.applyFilter();
        }
    }
  }

  private applyFilter(): void {
    const q = this.query.toLowerCase();
    this.filtered = q
      ? this.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.description ?? "").toLowerCase().includes(q)
        )
      : [...this.items];
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }

  private clampScroll(): void {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + this.visibleCount) {
      this.scrollOffset = this.selectedIndex - this.visibleCount + 1;
    }
  }

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    const lines: string[] = [];

    if (this.filtered.length === 0) {
      const msg = `  no matches for "${this.query}"`;
      lines.push(this.theme.noMatch ? this.theme.noMatch(msg) : msg);
      return lines;
    }

    const visible = this.filtered.slice(
      this.scrollOffset,
      this.scrollOffset + this.visibleCount
    );

    for (let i = 0; i < visible.length; i++) {
      const item = visible[i];
      if (!item) {
        continue;
      }
      const globalIndex = this.scrollOffset + i;
      const isSelected = globalIndex === this.selectedIndex;

      let label: string;
      let desc = item.description ?? "";

      if (isSelected) {
        const prefix = this.theme.selectedPrefix
          ? this.theme.selectedPrefix("▸ ")
          : "▸ ";
        const labelText = this.theme.selectedText
          ? this.theme.selectedText(item.label)
          : item.label;
        label = prefix + labelText;
        if (desc && this.theme.description) {
          desc = this.theme.description(desc);
        }
      } else {
        label = `  ${item.label}`;
        if (desc && this.theme.description) {
          desc = this.theme.description(desc);
        }
      }

      const labelW = visibleWidth(label);
      const descW = visibleWidth(desc);
      const gap = Math.max(1, safeWidth - labelW - descW);
      lines.push(label + " ".repeat(gap) + desc);
    }

    if (this.filtered.length > this.visibleCount) {
      const info = `  ${this.scrollOffset + 1}–${Math.min(
        this.scrollOffset + this.visibleCount,
        this.filtered.length
      )} of ${this.filtered.length}`;
      lines.push(this.theme.scrollInfo ? this.theme.scrollInfo(info) : info);
    }

    return lines;
  }
}

// ─── ProcessTerminal ──────────────────────────────────────────────────────────

export class ProcessTerminal {
  private width: number;
  private height: number;

  constructor() {
    this.width = process.stdout.columns ?? 80;
    this.height = process.stdout.rows ?? 24;
    process.stdout.on("resize", () => {
      this.width = process.stdout.columns ?? 80;
      this.height = process.stdout.rows ?? 24;
    });
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }

  write(text: string): void {
    process.stdout.write(text);
  }

  clearScreen(): void {
    process.stdout.write("\x1b[2J\x1b[H");
  }

  moveTo(row: number, col: number): void {
    process.stdout.write(`\x1b[${row + 1};${col + 1}H`);
  }

  hideCursor(): void {
    process.stdout.write("\x1b[?25l");
  }

  showCursor(): void {
    process.stdout.write("\x1b[?25h");
  }

  enterAlternateScreen(): void {
    process.stdout.write("\x1b[?1049h");
  }

  exitAlternateScreen(): void {
    process.stdout.write("\x1b[?1049l");
  }

  enableMouseTracking(): void {
    // Enable button-event tracking and SGR extended mouse coordinates.
    process.stdout.write("\x1b[?1000h\x1b[?1006h");
  }

  disableMouseTracking(): void {
    process.stdout.write("\x1b[?1000l\x1b[?1006l");
  }
}

// ─── TUI ─────────────────────────────────────────────────────────────────────

type InputListener = (data: string) => { consume: boolean } | undefined;

interface OverlayState {
  component: Component;
  options: OverlayOptions;
  visible: boolean;
}

export class TUI {
  private readonly terminal: ProcessTerminal;
  private children: Component[] = [];
  private focused: Component | null = null;
  private overlays: OverlayState[] = [];
  private inputListeners: InputListener[] = [];
  private renderRequested = false;
  private running = false;
  private lastRenderedLines: string[] = [];

  constructor(terminal: ProcessTerminal) {
    this.terminal = terminal;
  }

  addChild(component: Component): void {
    this.children.push(component);
  }

  setFocus(component: Component): void {
    if (this.focused) this.focused.focused = false;
    this.focused = component;
    component.focused = true;
  }

  addInputListener(listener: InputListener): () => void {
    this.inputListeners.push(listener);
    return () => {
      this.inputListeners = this.inputListeners.filter((l) => l !== listener);
    };
  }

  showOverlay(component: Component, options: OverlayOptions = {}): OverlayHandle {
    const state: OverlayState = { component, options, visible: true };
    this.overlays.push(state);
    this.setFocus(component);
    this.requestRender();

    return {
      hide: () => {
        state.visible = false;
        this.overlays = this.overlays.filter((o) => o !== state);
        this.requestRender();
      },
    };
  }

  requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    setImmediate(() => {
      this.renderRequested = false;
      this.render();
    });
  }

  private render(): void {
    if (!this.running) return;

    const width = this.terminal.getWidth();
    const height = this.terminal.getHeight();
    const lines: string[] = [];

    // Render main children
    for (const child of this.children) {
      lines.push(...child.render(width));
    }

    // Render overlays — injected at anchor position
    for (const overlay of this.overlays) {
      if (!overlay.visible) continue;

      const overlayWidth = this.resolveOverlayWidth(overlay.options, width);
      const overlayLines = overlay.component.render(overlayWidth);
      const maxH = overlay.options.maxHeight ?? overlayLines.length;
      const sliced = overlayLines.slice(0, maxH);

      // Center horizontally and clamp vertically so overlays stay visible.
      const startCol = Math.max(
        0,
        Math.floor((width - overlayWidth) / 2)
      );
      const offsetY = overlay.options.offsetY ?? 0;
      const startRow = this.resolveOverlayStartRow(
        overlay.options,
        height,
        lines.length,
        sliced.length,
        offsetY
      );

      for (let i = 0; i < sliced.length; i++) {
        const row = startRow + i;
        const padding = " ".repeat(startCol);
        if (row >= height) {
          break;
        }
        if (row < lines.length) {
          lines[row] = padding + sliced[i];
        } else {
          while (lines.length < row) lines.push("");
          lines.push(padding + sliced[i]);
        }
      }
    }

    // Find cursor marker and remove it from line content
    let cursorRow = -1;
    let cursorCol = -1;

    const processedLines = lines.map((line, rowIndex) => {
      const markerIndex = line.indexOf(CURSOR_MARKER);
      if (markerIndex !== -1) {
        cursorRow = rowIndex;
        // Cursor column = visible width of text before the marker
        cursorCol = visibleWidth(line.slice(0, markerIndex));
        return line.replace(CURSOR_MARKER, "");
      }
      return line;
    });

    // Diff render — only write lines that changed
    this.terminal.hideCursor();

    const totalLines = Math.max(
      processedLines.length,
      this.lastRenderedLines.length
    );

    for (let i = 0; i < totalLines; i++) {
      const newLine = processedLines[i] ?? "";
      const oldLine = this.lastRenderedLines[i] ?? "";
      if (newLine !== oldLine) {
        this.terminal.moveTo(i, 0);
        this.terminal.write("\x1b[2K"); // erase whole line
        this.terminal.write(newLine);
      }
    }

    this.lastRenderedLines = [...processedLines];

    // Restore cursor to correct position
    if (cursorRow >= 0 && cursorCol >= 0) {
      this.terminal.moveTo(cursorRow, cursorCol);
    } else {
      this.terminal.moveTo(processedLines.length, 0);
    }
    this.terminal.showCursor();
  }

  private resolveOverlayWidth(options: OverlayOptions, termWidth: number): number {
    const w = options.width;
    let resolved: number;
    if (typeof w === "number") {
      resolved = w;
    } else if (typeof w === "string" && w.endsWith("%")) {
      resolved = Math.floor(termWidth * (parseFloat(w) / 100));
    } else {
      resolved = Math.floor(termWidth * 0.6);
    }
    return Math.max(options.minWidth ?? 0, resolved);
  }

  private resolveOverlayStartRow(
    options: OverlayOptions,
    termHeight: number,
    contentHeight: number,
    overlayHeight: number,
    offsetY: number
  ): number {
    const maxStart = Math.max(0, termHeight - overlayHeight);

    if (options.anchor === "top-center") {
      return Math.min(maxStart, Math.max(0, offsetY));
    }

    if (options.anchor === "center") {
      const centered = Math.floor((termHeight - overlayHeight) / 2) + offsetY;
      return Math.min(maxStart, Math.max(0, centered));
    }

    const base = contentHeight - overlayHeight + offsetY;
    return Math.min(maxStart, Math.max(0, base));
  }

  start(): void {
    this.running = true;
    this.terminal.enterAlternateScreen();
    this.terminal.clearScreen();
    this.terminal.hideCursor();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // FIX: avoid double-binding on repeated start() calls
    process.stdin.removeAllListeners("data");
    process.stdin.on("data", (data: string) => {
      this.handleInput(data);
    });

    process.stdout.removeAllListeners("resize");
    process.stdout.on("resize", () => {
      this.lastRenderedLines = [];
      this.terminal.clearScreen();
      this.requestRender();
    });

    this.requestRender();
  }

  stop(): void {
    this.running = false;
    this.terminal.showCursor();
    this.terminal.exitAlternateScreen();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeAllListeners("data");
  }

  private handleInput(data: string): void {
    const normalizedData = this.normalizeMouseInput(data);

    for (const listener of [...this.inputListeners]) {
      const result = listener(normalizedData);
      if (result?.consume) return;
    }

    if (this.focused) {
      this.focused.handleInput(normalizedData);
      this.requestRender();
    }
  }

  private normalizeMouseInput(data: string): string {
    // SGR mouse wheel: ESC [ < 64;col;row M = wheel up, 65 = wheel down
    if (/^\x1b\[<64;\d+;\d+[mM]$/.test(data)) {
      return Key.pageUp;
    }
    if (/^\x1b\[<65;\d+;\d+[mM]$/.test(data)) {
      return Key.pageDown;
    }
    return data;
  }
}
