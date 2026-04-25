import { describe, expect, it, vi } from "vitest";

import { Key } from "../src/pi-tui/src/index.js";
import { LoginOverlay } from "../src/repl/loginOverlay.js";

describe("LoginOverlay", () => {
  it("shows auth actions and renders the raw auth URL", () => {
    const overlay = new LoginOverlay(() => {});

    overlay.writeLine("Logging in to openai-codex...");
    overlay.writeLink("Authentication URL ready.", "https://auth.example.test/very/long/url");

    const rendered = overlay.render(80);

    expect(
      rendered.some((line) => line.includes("Ctrl+Y copies the authentication URL. Ctrl+O opens it in your browser"))
    ).toBe(true);
    expect(rendered.some((line) => line.includes("again."))).toBe(true);
    expect(rendered.some((line) => line.includes("https://auth.example.test/very/long/url"))).toBe(true);
  });

  it("keeps the full raw auth URL visible within the capped overlay height", () => {
    const overlay = new LoginOverlay(() => {});
    const googleUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=1071006060591-tmhss1n2h21lcre235vtolojh4g403ep.apps.googleusercontent.com&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fcallback&scope=openid%20email%20profile&state=struggle-login";

    overlay.writeLine("Starting local server for OAuth callback...");
    overlay.writeLine("Open this URL to continue authentication:");
    overlay.writeLink("Authentication URL ready.", googleUrl);
    overlay.writeLine("Complete the sign-in in your browser.");
    overlay.writeLine("Waiting for OAuth callback...");
    overlay.writeLine("Authentication URL copied to clipboard.");

    const visibleWindow = overlay.render(120).slice(0, 16);

    expect(visibleWindow.some((line) => line.includes("redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fcallback"))).toBe(true);
    expect(visibleWindow.some((line) => line.includes("state=struggle-login"))).toBe(true);
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
