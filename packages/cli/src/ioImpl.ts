import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IO } from "@struggle-ai/core";
import chalk from "chalk";

export const cliIO: IO = {
  async readFile(path) {
    return readFile(path, "utf8");
  },
  async writeFile(path, content) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  },
  async fileExists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  notify(level, message) {
    const prefix =
      level === "info" ? chalk.cyan("[info]") : level === "warn" ? chalk.yellow("[warn]") : chalk.red("[error]");
    process.stderr.write(`${prefix} ${message}\n`);
  },
  stream(chunk) {
    process.stdout.write(chunk);
  },
};
