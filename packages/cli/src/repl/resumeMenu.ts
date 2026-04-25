import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { renderPanel, SelectList } from "../pi-tui/src/index.js";

import { chalk, P } from "./palette.js";

export class ResumeMenu implements Component {
  private readonly list: SelectList;

  constructor(
    items: SelectItem[],
    currentSessionId: string | undefined,
    onSelect: (item: SelectItem) => void,
    onCancel: () => void
  ) {
    this.list = new SelectList(items, 8, {
      selectedPrefix: (text) => chalk.hex(P.blue)(text),
      selectedText: (text) => chalk.hex(P.textPrimary).bold(text),
      description: (text) => chalk.hex(P.textMuted)(text),
      scrollInfo: (text) => chalk.hex(P.textMuted)(text),
      noMatch: (text) => chalk.hex(P.textMuted)(text),
    });
    this.list.onSelect = onSelect;
    this.list.onCancel = onCancel;
    if (currentSessionId) {
      this.list.selectValue(currentSessionId);
    }
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }

  invalidate(): void {
    this.list.invalidate();
  }

  render(width: number): string[] {
    return renderPanel(
      "Resume Session",
      [
        chalk.hex(P.textMuted)("Use ↑↓ to choose a saved session, Enter to connect, Esc to close."),
        "",
        ...this.list.render(Math.max(56, width - 4)),
      ],
      Math.max(64, width),
      {
        background: (text) => chalk.bgHex(P.bgPanel)(text),
        title: (text) => chalk.hex(P.textSecondary)(`  ${text}`),
        body: (text) => text,
      }
    );
  }
}
