import type { Provider } from "@struggle-ai/core";
import type { Component, SelectItem } from "../pi-tui/src/index.js";
import { Key, padToWidth, truncateToWidth } from "../pi-tui/src/index.js";

import { chalk, P } from "./palette.js";

const TOP_LEVEL_ITEMS: SelectItem[] = [
  { value: "/help", label: "/help", description: "Show all available commands" },
  { value: "/login", label: "/login", description: "Open provider login selector" },
  { value: "/providers", label: "/providers", description: "Show providers or switch the active provider" },
  { value: "/logout", label: "/logout", description: "Clear saved credentials for the active provider" },
  { value: "/mode ", label: "/mode", description: "Switch learning mode" },
  { value: "/model", label: "/model", description: "Show active model or switch model" },
  { value: "/copy", label: "/copy", description: "Copy the latest generated output" },
  { value: "/clear", label: "/clear", description: "Clear the transcript" },
  { value: "/new", label: "/new", description: "Start a fresh session" },
  { value: "/resume ", label: "/resume", description: "List saved sessions or resume one by id" },
  { value: "/stuck", label: "/stuck", description: "Start the stuck diagnostic flow" },
  { value: "/trail", label: "/trail", description: "Show trail artifact commands" },
  { value: "/exit", label: "/exit", description: "Close the session" },
  { value: "/quit", label: "/quit", description: "Close the session" },
];

const MODE_ITEMS: SelectItem[] = [
  { value: "/mode guided", label: "/mode guided", description: "Guided - step-by-step questions" },
  { value: "/mode standard", label: "/mode standard", description: "Standard - balanced responses" },
  { value: "/mode socratic", label: "/mode socratic", description: "Socratic - questions only" },
];

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  google: "Google Gemini",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  "google-antigravity": "Google Antigravity",
  "openai-codex": "OpenAI Codex",
};

let providerItems: SelectItem[] = [];

function buildProviderItems(providers: Provider[]): SelectItem[] {
  return providers.map((provider) => ({
    value: `/providers ${provider}`,
    label: `/providers ${provider}`,
    description: `Switch to ${PROVIDER_LABELS[provider]}`,
  }));
}

export function setAvailableProviders(providers: Provider[]): void {
  providerItems = buildProviderItems(providers);
}

function getAllItems(): SelectItem[] {
  return [...TOP_LEVEL_ITEMS];
}

type MenuContext = "root" | "help" | "login" | "providers" | "mode" | "search";

function contextForQuery(query: string): MenuContext {
  const n = query.trimStart().toLowerCase();
  if (n === "/" || n === "") return "root";
  if (n === "/help" || n === "/help ") return "help";
  if (n === "/login" || n === "/login ") return "login";
  if (n === "/providers" || n === "/providers " || n === "/provider" || n === "/provider ") return "providers";
  if (n === "/mode" || n === "/mode ") return "mode";
  return "search";
}

function itemsForContext(context: MenuContext, query: string): SelectItem[] {
  switch (context) {
    case "root":
      return TOP_LEVEL_ITEMS;
    case "help":
      return TOP_LEVEL_ITEMS;
    case "login":
      return [];
    case "providers":
      return [];
    case "mode":
      return [];
    case "search": {
      const n = query.trimStart().toLowerCase();
      const term = n.startsWith("/") ? n.slice(1) : n;

      return getAllItems()
        .map((item, index) => {
          const v = item.value.toLowerCase();
          const l = item.label.toLowerCase();
          const d = (item.description ?? "").toLowerCase();

          let score = 0;
          if (v === n || l === n) {
            score = 400;
          } else if (v.startsWith(n) || l.startsWith(n)) {
            score = 300;
          } else if (v.includes(n) || l.includes(n)) {
            score = 200;
          }

          if (term.length > 0 && d.includes(term)) {
            score = Math.max(score, 100);
          }

          return { item, index, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length || a.index - b.index)
        .map((entry) => entry.item);
    }
  }
}

function headerForContext(context: MenuContext): string {
  switch (context) {
    case "root":
      return "  Commands";
    case "help":
      return "  /help - all commands";
    case "login":
      return "  /login - OAuth providers";
    case "providers":
      return "  /providers - available providers";
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
          chalk.hex(P.textSecondary)(header) + chalk.hex(P.textMuted)("   up/down - enter select - esc close"),
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
