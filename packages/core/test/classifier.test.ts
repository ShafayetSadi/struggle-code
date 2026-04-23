import { describe, expect, it } from "vitest";

import { classifyIntent } from "../src/index.js";

describe("classifyIntent", () => {
  it("detects project-oriented requests", async () => {
    await expect(classifyIntent("Help me build a portfolio website")).resolves.toBe("project");
  });

  it("detects debugging requests", async () => {
    await expect(classifyIntent("Why does this error throw on startup?")).resolves.toBe("debug");
  });

  it("defaults to quick help", async () => {
    await expect(classifyIntent("What does map do in JavaScript?")).resolves.toBe("quick_help");
  });
});
