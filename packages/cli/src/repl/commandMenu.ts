import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { Key, padToWidth, truncateToWidth } from "../pi-tui/src/index.js";

import { P, chalk } from "./palette.js";

export const COMMAND_ITEMS: SelectItem[] = [
  { value: "/help", label: "/help", description: "Open the command menu" },
  { value: "/logout", label: "/logout", description: "Clear saved credentials for the active provider" },
  { value: "/mode guided", label: "/mode guided", description: "Guided mode — step-by-step questions" },
  { value: "/mode standard", label: "/mode standard", description: "Standard mode — balanced responses" },
  { value: "/mode socratic", label: "/mode socratic", description: "Socratic — questions only" },
  { value: "/model", label: "/model", description: "List models for the active provider" },
  { value: "/share ", label: "/share <path>", description: "Share a file with the session" },
  { value: "/stuck", label: "/stuck", description: "Start the stuck diagnostic flow" },
  { value: "/hint", label: "/hint", description: "Ask for the next hint" },
  { value: "/hint 2", label: "/hint 2", description: "Stronger hint" },
  { value: "/hint 3", label: "/hint 3", description: "Strongest hint" },
  { value: "/trail export", label: "/trail export", description: "Export the session trail" },
  { value: "/exit", label: "/exit", description: "Close the session" },
];

export function commandMatches(query: string): SelectItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized.startsWith("/")) return [];
  if (normalized === "/") return COMMAND_ITEMS;
  return COMMAND_ITEMS.filter((item) => {
    const v = item.value.toLowerCase();
    const l = item.label.toLowerCase();
    const d = (item.description ?? "").toLowerCase();
    return v.startsWith(normalized) || l.includes(normalized) || d.includes(normalized.slice(1));
  });
}

export class CommandMenu implements Component {
  private selectedIndex = 0;
  private readonly onSelect: (item: SelectItem) => void;
  private readonly onCancel: () => void;

  constructor(onSelect: (item: SelectItem) => void, onCancel: () => void) {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  handleInput(data: string): void {
    if (data === Key.up || data === "\x1b[A") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return;
    }
    if (data === Key.down || data === "\x1b[B") {
      this.selectedIndex = Math.min(COMMAND_ITEMS.length - 1, this.selectedIndex + 1);
      return;
    }
    if (data === Key.enter || data === "\r") {
      const item = COMMAND_ITEMS[this.selectedIndex];
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

    lines.push(chalk.bgHex(P.bgPanel)(padToWidth("", w)));
    lines.push(
      chalk.bgHex(P.bgPanel)(
        padToWidth(
          chalk.hex(P.textSecondary)("  Commands  ") + chalk.hex(P.textMuted)("↑↓ navigate  ↵ select  esc close"),
          w
        )
      )
    );
    lines.push(chalk.bgHex(P.bgPanel)(padToWidth(chalk.hex(P.borderSubtle)("─".repeat(w)), w)));

    for (let i = 0; i < COMMAND_ITEMS.length; i++) {
      const item = COMMAND_ITEMS[i];
      if (!item) continue;
      const selected = i === this.selectedIndex;
      const bg = selected ? "#1c2128" : P.bgPanel;
      const marker = selected ? chalk.hex(P.blue)("›") : chalk.hex(P.textMuted)(" ");
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
