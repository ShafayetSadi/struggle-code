import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { Key, padToWidth, truncateToWidth } from "../pi-tui/src/index.js";

import { P, chalk } from "./palette.js";

const TOP_LEVEL_ITEMS: SelectItem[] = [
  { value: "/help ", label: "/help", description: "Hints & stuck commands" },
  { value: "/mode ", label: "/mode", description: "Switch learning mode" },
  { value: "/model", label: "/model", description: "Show the active model" },
  { value: "/copy", label: "/copy", description: "Copy the latest generated output" },
  { value: "/clear", label: "/clear", description: "Clear the transcript" },
  { value: "/new", label: "/new", description: "Start a fresh session" },
  { value: "/share ", label: "/share", description: "Share a file with the session" },
  { value: "/trail export", label: "/trail export", description: "Export the session trail" },
];

const HELP_ITEMS: SelectItem[] = [
  { value: "/hint", label: "/hint", description: "Ask for the next hint" },
  { value: "/hint 2", label: "/hint 2", description: "Stronger hint" },
  { value: "/hint 3", label: "/hint 3", description: "Strongest hint" },
  { value: "/stuck", label: "/stuck", description: "Start the stuck diagnostic flow" },
];

const MODE_ITEMS: SelectItem[] = [
  { value: "/mode guided", label: "/mode guided", description: "Guided - step-by-step questions" },
  { value: "/mode standard", label: "/mode standard", description: "Standard - balanced responses" },
  { value: "/mode full-socratic", label: "/mode full-socratic", description: "Full-socratic - questions only" },
];

const ALL_ITEMS: SelectItem[] = [
  ...TOP_LEVEL_ITEMS,
  ...HELP_ITEMS,
  ...MODE_ITEMS,
  { value: "/exit", label: "/exit", description: "Close the session" },
];

export const COMMAND_ITEMS: SelectItem[] = ALL_ITEMS;

type MenuContext = "root" | "help" | "mode" | "search";

function contextForQuery(query: string): MenuContext {
  const n = query.trimStart().toLowerCase();
  if (n === "/" || n === "") return "root";
  if (n === "/help" || n === "/help ") return "help";
  if (n === "/mode" || n === "/mode ") return "mode";
  return "search";
}

function itemsForContext(context: MenuContext, query: string): SelectItem[] {
  switch (context) {
    case "root":
      return TOP_LEVEL_ITEMS;
    case "help":
      return HELP_ITEMS;
    case "mode":
      return MODE_ITEMS;
    case "search": {
      const n = query.trimStart().toLowerCase();
      return ALL_ITEMS.filter((item) => {
        const v = item.value.toLowerCase();
        const l = item.label.toLowerCase();
        const d = (item.description ?? "").toLowerCase();
        return v.startsWith(n) || l.includes(n) || d.includes(n.slice(1));
      });
    }
  }
}

function headerForContext(context: MenuContext): string {
  switch (context) {
    case "root":
      return "  Commands";
    case "help":
      return "  /help - hints & stuck";
    case "mode":
      return "  /mode - learning modes";
    case "search":
      return "  Search results";
  }
}

function itemsForQuery(query: string): SelectItem[] {
  return itemsForContext(contextForQuery(query), query);
}

export function commandMatches(query: string): SelectItem[] {
  if (!query.trimStart().startsWith("/")) {
    return [];
  }
  return itemsForQuery(query);
}

export class CommandMenu implements Component {
  private selectedIndex = 0;
  private query = "/";
  private readonly onSelect: (item: SelectItem) => void;
  private readonly onCancel: () => void;

  constructor(onSelect: (item: SelectItem) => void, onCancel: () => void) {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  setQuery(query: string): void {
    if (query === this.query) return;
    this.query = query;
    this.selectedIndex = 0;
  }

  handleInput(data: string): void {
    const items = itemsForQuery(this.query);
    if (data === Key.up || data === "\x1b[A") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return;
    }
    if (data === Key.down || data === "\x1b[B") {
      this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
      return;
    }
    if (data === Key.enter || data === "\r") {
      const item = items[this.selectedIndex];
      if (item) this.onSelect(item);
      return;
    }
    if (data === Key.escape) this.onCancel();
  }

  invalidate(): void {}

  render(width: number): string[] {
    const w = Math.max(40, width);
    const labelCol = 22;
    const lines: string[] = [];

    const context = contextForQuery(this.query);
    const items = itemsForContext(context, this.query);
    const header = headerForContext(context);
    const safeIndex = Math.min(this.selectedIndex, Math.max(0, items.length - 1));

    lines.push(
      chalk.bgHex(P.bgPanel)(
        padToWidth(
          chalk.hex(P.textSecondary)(header) +
            chalk.hex(P.textMuted)("   up/down - enter select - esc close"),
          w
        )
      )
    );
    lines.push(chalk.bgHex(P.bgPanel)(padToWidth(chalk.hex(P.borderSubtle)("-".repeat(w)), w)));

    if (items.length === 0) {
      lines.push(chalk.bgHex(P.bgPanel)(padToWidth(chalk.hex(P.textMuted)("  no matching commands"), w)));
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const selected = i === safeIndex;
      const bg = selected ? "#1c2128" : P.bgPanel;
      const marker = selected ? chalk.hex(P.blue)(">") : chalk.hex(P.textMuted)(" ");
      const label = selected
        ? chalk.hex(P.textPrimary).bold(padToWidth(item.label, labelCol))
        : chalk.hex(P.textSecondary)(padToWidth(item.label, labelCol));
      const desc = selected
        ? chalk.hex(P.textSecondary)(item.description ?? "")
        : chalk.hex(P.textMuted)(item.description ?? "");
      const content = `  ${marker} ${label}  ${desc}`;
      lines.push(chalk.bgHex(bg)(padToWidth(truncateToWidth(content, w), w)));
    }

    lines.push(chalk.bgHex(P.bgPanel)(padToWidth("", w)));
    return lines;
  }
}
