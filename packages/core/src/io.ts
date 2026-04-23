import type { IO } from "./types.js";

export const NoopIO: IO = {
  async readFile(path) {
    return `// NoopIO mock read for ${path}\nexport const placeholder = true;\n`;
  },
  async writeFile() {
    return;
  },
  async fileExists() {
    return false;
  },
  notify() {
    return;
  },
  stream() {
    return;
  },
};
