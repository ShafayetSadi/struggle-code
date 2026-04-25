import { describe, expect, it } from "vitest";

import { createOsc8Hyperlink, formatTerminalLink, shortenMiddle } from "../src/repl/terminalLinks.js";

describe("terminalLinks", () => {
  it("builds OSC-8 hyperlinks", () => {
    const link = createOsc8Hyperlink("https://example.com/auth", "Open auth");
    expect(link).toContain("\u001B]8;;https://example.com/auth\u001B\\");
    expect(link).toContain("Open auth");
    expect(link).toContain("\u001B]8;;\u001B\\");
  });

  it("falls back to plain text when OSC-8 is unavailable", () => {
    const link = formatTerminalLink("https://example.com/auth", "Open auth");
    expect(link).toContain("Open auth");
    expect(link).toContain("https://example.com/auth");
  });

  it("shortens long URLs from the middle", () => {
    const value =
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&redirect_uri=http%3A%2F%2Flocalhost%3A51121%2Foauth-callback";
    const shortened = shortenMiddle(value, 48);
    expect(shortened.length).toBeLessThanOrEqual(48);
    expect(shortened).toContain("…");
    expect(shortened.startsWith("https://")).toBe(true);
  });
});
