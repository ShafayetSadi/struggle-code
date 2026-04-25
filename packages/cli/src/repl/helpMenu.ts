import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { padToWidth, renderPanel, SelectList } from "../pi-tui/src/index.js";

import { chalk, P } from "./palette.js";

export const HELP_MENU_ITEMS: SelectItem[] = [
  { value: "/hint", label: "/hint", description: "Ask for the next hint" },
  { value: "/hint 2", label: "/hint 2", description: "Ask for a stronger hint" },
  { value: "/hint 3", label: "/hint 3", description: "Ask for the strongest hint" },
  { value: "/stuck", label: "/stuck", description: "Start the stuck diagnostic flow" },
];

export class HelpMenu implements Component {
  private readonly list: SelectList;

  constructor(onSelect: (item: SelectItem) => void, onCancel: () => void) {
    this.list = new SelectList(HELP_MENU_ITEMS, 8, {
      selectedPrefix: (text) => chalk.hex(P.blue)(text),
      selectedText: (text) => chalk.hex(P.textPrimary).bold(text),
      description: (text) => chalk.hex(P.textMuted)(text),
      scrollInfo: (text) => chalk.hex(P.textMuted)(text),
      noMatch: (text) => chalk.hex(P.textMuted)(text),
    });
    this.list.onSelect = onSelect;
    this.list.onCancel = onCancel;
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }

  invalidate(): void {
    this.list.invalidate();
  }

  render(width: number): string[] {
    return renderPanel(
      "Help",
      [
        chalk.hex(P.textMuted)("Use ↑↓ to choose, Enter to apply, Esc to close."),
        "",
        ...this.list.render(Math.max(40, width - 4)),
      ],
      Math.max(48, width),
      {
        background: (text) => chalk.bgHex(P.bgPanel)(text),
        title: (text) => chalk.hex(P.textSecondary)(`  ${text}`),
        body: (text) => padToWidth(text, Math.max(48, width)),
      }
    );
  }
}
