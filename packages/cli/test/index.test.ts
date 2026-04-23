import { describe, expect, it } from "vitest";

import { createProgram } from "../src/index.js";

describe("cli entry", () => {
  it("loads without throwing and exposes a commander program", () => {
    const program = createProgram();
    expect(program.name()).toBe("struggle");
  });
});
