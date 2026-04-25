import { describe, expect, it } from "vitest";

import { SelectList, visibleWidth } from "../src/pi-tui/src/index.js";
import { ResumeMenu } from "../src/repl/resumeMenu.js";

describe("SelectList", () => {
  it("keeps rendered rows within the requested width", () => {
    const list = new SelectList([
      {
        value: "session-a",
        label: "this is a new test for session 2",
        description:
          "2026-04-25 03:53  2 msgs  Got it — session 2 test received. I'm ready for the next task whenever you are.",
      },
    ]);

    const lines = list.render(60);

    expect(lines).not.toHaveLength(0);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(60);
    }
  });

  it("keeps resume menu panel lines within the requested width", () => {
    const menu = new ResumeMenu(
      [
        {
          value: "session-a",
          label: "this is a new test for session 2",
          description:
            "2026-04-25 03:53  2 msgs  Got it — session 2 test received. I'm ready for the next task whenever you are.",
        },
      ],
      "session-a",
      () => {},
      () => {}
    );

    const lines = menu.render(80);

    expect(lines).not.toHaveLength(0);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(80);
    }
  });
});
