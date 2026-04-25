import { describe, expect, it, vi } from "vitest";

import { Key } from "../src/pi-tui/src/index.js";
import { LoginOverlay } from "../src/repl/loginOverlay.js";

describe("LoginOverlay", () => {
  it("shows auth actions without rendering the raw auth URL", () => {
    const overlay = new LoginOverlay(() => {});

    overlay.writeLine("Logging in to openai-codex...");
    overlay.writeLink("Authentication URL ready.", "https://auth.example.test/very/long/url");

    const rendered = overlay.render(80);

    expect(
      rendered.some((line) => line.includes("Ctrl+Y copies the authentication URL. Ctrl+O opens it in your browser"))
    ).toBe(true);
    expect(rendered.some((line) => line.includes("again."))).toBe(true);
    expect(rendered.some((line) => line.includes("https://auth.example.test/very/long/url"))).toBe(false);
  });

  it("handles copy and open shortcuts without inserting characters into the prompt", async () => {
    const copyAuthUrl = vi.fn().mockResolvedValue(undefined);
    const openAuthUrl = vi.fn().mockResolvedValue(undefined);
    const overlay = new LoginOverlay(() => {}, { copyAuthUrl, openAuthUrl });

    overlay.writeLink("Authentication URL ready.", "https://auth.example.test/login");
    const prompt = overlay.prompt("Paste the redirected URL/code and press Enter");

    overlay.handleInput(Key.ctrl("y"));
    overlay.handleInput(Key.ctrl("o"));
    await Promise.resolve();

    expect(copyAuthUrl).toHaveBeenCalledWith("https://auth.example.test/login");
    expect(openAuthUrl).toHaveBeenCalledWith("https://auth.example.test/login");

    overlay.handleInput("h");
    overlay.handleInput("i");
    overlay.handleInput(Key.enter);

    await expect(prompt).resolves.toBe("hi");
  });
});
