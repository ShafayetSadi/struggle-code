import { describe, expect, it } from "vitest";

import { getPanelHtml } from "../src/panelHtml.js";

describe("getPanelHtml", () => {
  it("returns the wired chat panel markup", () => {
    const html = getPanelHtml();
    expect(html).toContain("Struggle AI");
    expect(html).toContain("change model");
    expect(html).toContain("guided");
    expect(html).toContain("export");
    expect(html).toContain("acquireVsCodeApi");
  });
});
