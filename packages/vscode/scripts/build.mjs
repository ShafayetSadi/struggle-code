import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const outfile = resolve("dist/extension.js");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  outfile,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  sourcemap: true,
});

async function ensureCommonJsScope() {
  const distPackage = resolve("dist/package.json");
  await mkdir(dirname(distPackage), { recursive: true });
  await writeFile(distPackage, `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`, "utf8");
}

async function copyPrompts() {
  const srcDir = resolve("../core/src/prompts");
  const destDir = resolve("dist");
  await mkdir(destDir, { recursive: true });
  const files = await readdir(srcDir);
  await Promise.all(
    files.filter((f) => f.endsWith(".md")).map((f) => copyFile(resolve(srcDir, f), resolve(destDir, f)))
  );
}

if (watch) {
  await ensureCommonJsScope();
  await copyPrompts();
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ensureCommonJsScope();
  await copyPrompts();
  await ctx.dispose();
}
