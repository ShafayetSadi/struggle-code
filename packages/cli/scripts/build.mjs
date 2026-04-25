import { chmod, copyFile, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import * as esbuild from "esbuild";

const outfile = resolve("dist/index.js");
const promptsSourceDir = resolve("../core/src/prompts");
const promptsDestDir = resolve("dist");

async function copyPrompts() {
  await mkdir(promptsDestDir, { recursive: true });
  const files = await readdir(promptsSourceDir);
  await Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .map((file) => copyFile(resolve(promptsSourceDir, file), resolve(promptsDestDir, file)))
  );
}

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  banner: {
    js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);',
  },
  sourcemap: true,
});

await copyPrompts();

// Make executable on Unix
await chmod(outfile, 0o755);

console.log(`Built ${outfile}`);
