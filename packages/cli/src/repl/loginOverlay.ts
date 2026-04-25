import type { Component } from "../pi-tui/src/index.js";
import { Input, Key, renderPanel, visibleWidth } from "../pi-tui/src/index.js";

import { chalk, P } from "./palette.js";

export interface LoginIO {
  prompt(message: string): Promise<string>;
  writeLine(message: string): void;
  writeLink(label: string, url: string): void;
}

interface LoginOverlayOptions {
  copyAuthUrl?: (url: string) => Promise<void>;
  openAuthUrl?: (url: string) => Promise<void>;
}

export class LoginOverlay implements Component, LoginIO {
  private readonly input = new Input();
  private readonly requestRender: () => void;
  private readonly copyAuthUrl: ((url: string) => Promise<void>) | undefined;
  private readonly openAuthUrl: ((url: string) => Promise<void>) | undefined;
  private readonly lines: string[] = [];
  private promptLabel: string | undefined;
  private pendingResolve: ((value: string) => void) | undefined;
  private authUrl: string | undefined;
  private _focused = false;

  constructor(requestRender: () => void, options: LoginOverlayOptions = {}) {
    this.requestRender = requestRender;
    this.copyAuthUrl = options.copyAuthUrl;
    this.openAuthUrl = options.openAuthUrl;
    this.input.onSubmit = (value) => {
      const resolve = this.pendingResolve;
      if (!resolve) {
        return;
      }
      this.pendingResolve = undefined;
      this.promptLabel = undefined;
      this.input.setValue("");
      this.input.setMaskChar(undefined);
      this.requestRender();
      resolve(value);
    };
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  writeLine(message: string): void {
    this.lines.push(message);
    this.requestRender();
  }

  writeLink(label: string, url: string): void {
    this.authUrl = url;
    this.lines.push(label);
    this.requestRender();
  }

  prompt(message: string): Promise<string> {
    this.promptLabel = message;
    this.input.setValue("");
    this.input.setMaskChar(/api key/i.test(message) ? "*" : undefined);
    this.requestRender();
    return new Promise<string>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  handleInput(data: string): void {
    if (data === Key.ctrl("y")) {
      void this.runAuthAction("copy");
      return;
    }
    if (data === Key.ctrl("o")) {
      void this.runAuthAction("open");
      return;
    }
    if (!this.pendingResolve) {
      return;
    }
    this.input.handleInput(data);
    this.requestRender();
  }

  invalidate(): void {
    this.input.invalidate();
  }

  private async runAuthAction(action: "copy" | "open"): Promise<void> {
    if (!this.authUrl) {
      return;
    }

    const handler = action === "copy" ? this.copyAuthUrl : this.openAuthUrl;
    if (!handler) {
      this.writeLine(
        action === "copy"
          ? "Clipboard copy is unavailable in this environment."
          : "Browser open is unavailable in this environment."
      );
      return;
    }

    try {
      await handler(this.authUrl);
      this.writeLine(
        action === "copy" ? "Authentication URL copied to clipboard." : "Opened authentication URL in your browser."
      );
    } catch {
      this.writeLine(
        action === "copy"
          ? "Clipboard copy failed. Open the browser-auth page directly."
          : "Could not open the browser. Copy the authentication URL instead."
      );
    }
  }

  private wrapLine(text: string, width: number): string[] {
    if (width <= 0 || visibleWidth(text) <= width) {
      return [text];
    }

    if (text.includes(" ")) {
      const parts = text.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const part of parts) {
        const next = current ? `${current} ${part}` : part;
        if (visibleWidth(next) <= width) {
          current = next;
          continue;
        }
        if (current) {
          lines.push(current);
        }
        if (visibleWidth(part) <= width) {
          current = part;
          continue;
        }
        for (let i = 0; i < part.length; i += width) {
          lines.push(part.slice(i, i + width));
        }
        current = "";
      }
      if (current) {
        lines.push(current);
      }
      return lines;
    }

    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += width) {
      chunks.push(text.slice(i, i + width));
    }
    return chunks;
  }

  render(width: number): string[] {
    const contentWidth = Math.max(30, width - 8);
    const body: string[] = this.authUrl ? [] : [chalk.hex(P.textMuted)("Complete provider login here without leaving the REPL."), ""];

    // When the auth URL is visible, keep fewer prior status lines so the full
    // URL still fits inside the fixed-height login overlay.
    const lineBudget = this.authUrl ? 3 : 8;
    for (const line of this.lines.slice(-lineBudget)) {
      body.push(...this.wrapLine(line, contentWidth));
    }

    if (this.authUrl) {
      body.push("");
      body.push(
        ...this.wrapLine(
          chalk.hex(P.textMuted)("Ctrl+Y copies the authentication URL. Ctrl+O opens it in your browser again."),
          contentWidth
        )
      );
      body.push("");
      body.push(chalk.hex(P.textSecondary)("Raw URL (copy exactly):"));
      body.push(...this.wrapLine(this.authUrl, contentWidth));
    }

    if (this.promptLabel) {
      body.push("");
      body.push(...this.wrapLine(chalk.hex(P.textSecondary)(this.promptLabel), contentWidth));
      body.push(...this.input.render(Math.max(30, width - 4)));
    }

    return renderPanel("Login", body, Math.max(56, width), {
      background: (text) => chalk.bgHex(P.bgPanel)(text),
      title: (text) => chalk.hex(P.textSecondary)(`  ${text}`),
      body: (text) => text,
    });
  }
}
