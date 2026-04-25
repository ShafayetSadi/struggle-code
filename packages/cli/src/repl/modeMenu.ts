import type { Mode } from "@struggle-ai/core";

import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { padToWidth, renderPanel, SelectList } from "../pi-tui/src/index.js";

import { chalk, P } from "./palette.js";

export const MODE_MENU_ITEMS: SelectItem[] = [
  { value: "guided", label: "guided", description: "Step-by-step planning with active nudges" },
  { value: "standard", label: "standard", description: "Balanced direct help without extra ceremony" },
  { value: "socratic", label: "socratic", description: "Question-led mode that checks understanding first" },
];

export class ModeMenu implements Component {
  private readonly list: SelectList;

  constructor(currentMode: Mode, onSelect: (item: SelectItem) => void, onCancel: () => void) {
    const items = MODE_MENU_ITEMS.map((item) => ({
      ...item,
      ...(item.value === currentMode ? { description: `current - ${item.description ?? ""}` } : {}),
    }));

    this.list = new SelectList(items, 6, {
      selectedPrefix: (text) => chalk.hex(P.blue)(text),
      selectedText: (text) => chalk.hex(P.textPrimary).bold(text),
      description: (text) => chalk.hex(P.textMuted)(text),
      scrollInfo: (text) => chalk.hex(P.textMuted)(text),
      noMatch: (text) => chalk.hex(P.textMuted)(text),
    });
    this.list.onSelect = onSelect;
    this.list.onCancel = onCancel;
    this.list.selectValue(currentMode);
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }

  invalidate(): void {
    this.list.invalidate();
  }

  render(width: number): string[] {
    return renderPanel(
      "Modes",
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
