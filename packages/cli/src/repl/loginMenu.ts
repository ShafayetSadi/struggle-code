import type { Provider } from "@struggle-ai/core";

import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { renderPanel, SelectList } from "../pi-tui/src/index.js";

import { chalk, P } from "./palette.js";

const LOGIN_PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Save an Anthropic API key",
  google: "Save a Google Gemini API key",
  openai: "Save an OpenAI API key",
  openrouter: "Save an OpenRouter API key",
  "google-antigravity": "Authenticate with Google Antigravity",
  "openai-codex": "Authenticate with OpenAI Codex",
};

const LOGIN_PROVIDER_ORDER: Provider[] = [
  "anthropic",
  "google",
  "openai",
  "openrouter",
  "google-antigravity",
  "openai-codex",
];

export const LOGIN_MENU_ITEMS: SelectItem[] = LOGIN_PROVIDER_ORDER.map((provider) => ({
  value: provider,
  label: provider,
  description: LOGIN_PROVIDER_LABELS[provider],
}));

export class LoginMenu implements Component {
  private readonly list: SelectList;

  constructor(onSelect: (item: SelectItem) => void, onCancel: () => void) {
    this.list = new SelectList(LOGIN_MENU_ITEMS, 8, {
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
      "Login Provider",
      [
        chalk.hex(P.textMuted)("Use ↑↓ to choose, Enter to authenticate, Esc to close."),
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
