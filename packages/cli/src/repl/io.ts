import type { IO } from "@struggle-ai/core";

import { chalk, P } from "./palette.js";

export function createTuiIO(base: IO, writeLine: (value: string) => void): IO {
  return {
    ...base,
    notify(level, message) {
      const prefix =
        level === "info"
          ? chalk.hex(P.blue)("info")
          : level === "warn"
            ? chalk.hex(P.yellow)("warn")
            : chalk.hex(P.red)("error");
      writeLine(`${prefix}  ${message}`);
    },
    stream() {
      // Response chunks are routed through the REPL event loop.
    },
  };
}
