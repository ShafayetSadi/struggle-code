import { describe, expect, it } from "vitest";

import { filterAllowlistedDocLinks, validateADR } from "../src/validation/adr.js";

describe("ADR validation", () => {
  it("preserves allowlisted documentation links and strips bad ones", () => {
    expect(
      filterAllowlistedDocLinks([
        "https://react.dev/learn",
        "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
        "https://example.com/not-allowed",
        "not-a-url",
      ])
    ).toEqual([
      "https://react.dev/learn",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    ]);
  });

  it("caps concepts and risks and rejects broken shapes", () => {
    const adr = validateADR({
      id: "adr-1",
      title: "Choose React",
      context: "Need a UI layer",
      decision: "Use React",
      consequences: "Team can iterate quickly",
      concepts: ["components", "state", "composition", "ignored"],
      risks: ["bundle growth", "state drift", "ignored"],
      docLinks: ["https://react.dev/learn", "https://example.com/nope"],
      createdAt: new Date().toISOString(),
    });

    expect(adr.concepts).toEqual(["components", "state", "composition"]);
    expect(adr.risks).toEqual(["bundle growth", "state drift"]);
    expect(adr.docLinks).toEqual(["https://react.dev/learn"]);
    expect(() =>
      validateADR({
        id: "broken",
        title: "",
        context: "x",
        decision: "y",
        consequences: "z",
        concepts: [],
        risks: [],
        docLinks: [],
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});
