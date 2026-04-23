import { describe, expect, it } from "vitest";

import { cn } from "../lib/utils";

describe("cn", () => {
  it("joins truthy class values", () => {
    expect(cn("base", false && "hidden", "accent")).toBe("base accent");
  });
});
