import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { SelectList, padToWidth, renderPanel } from "../pi-tui/src/index.js";

import { P, chalk } from "./palette.js";

export class ModelMenu implements Component {
  private readonly list: SelectList;

  constructor(items: SelectItem[], currentModel: string, onSelect: (item: SelectItem) => void, onCancel: () => void) {
    this.list = new SelectList(items, 10, {
      selectedPrefix: (text) => chalk.hex(P.blue)(text),
      selectedText: (text) => chalk.hex(P.textPrimary).bold(text),
      description: (text) => chalk.hex(P.textMuted)(text),
      scrollInfo: (text) => chalk.hex(P.textMuted)(text),
      noMatch: (text) => chalk.hex(P.textMuted)(text),
    });
    this.list.onSelect = onSelect;
    this.list.onCancel = onCancel;
    this.list.selectValue(currentModel);
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }

  invalidate(): void {
    this.list.invalidate();
  }

  render(width: number): string[] {
    return renderPanel(
      "Models",
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
