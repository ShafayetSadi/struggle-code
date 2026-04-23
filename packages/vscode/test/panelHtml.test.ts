import { describe, expect, it } from "vitest";

import { getPanelHtml } from "../src/panelHtml.js";

describe("getPanelHtml", () => {
  it("returns the placeholder panel markup", () => {
    const html = getPanelHtml();
    expect(html).toContain("Struggle AI");
    expect(html).toContain("Chat UI coming soon");
    expect(html).toContain("<button");
  });
});
