import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createProjectTools } from "../src/coding-agent/tools.js";
import { MemoryIO } from "./test-helpers.js";

function getTool<T extends { name: string }>(tools: T[], name: string): T {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool;
}

describe("project tools", () => {
  it("reads and writes files inside the project root", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "struggle-tools-"));
    const io = new MemoryIO();
    const tools = createProjectTools({ projectPath, io });

    const writeTool = getTool(tools, "write_file");
    const readTool = getTool(tools, "read_file");

    await writeTool.execute("1", { path: "src/example.ts", content: "export const value = 1;\n" });
    expect(io.writes.get(join(projectPath, "src/example.ts"))).toBe("export const value = 1;\n");

    const result = await readTool.execute("2", { path: "src/example.ts" });
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0] && "text" in result.content[0] ? result.content[0].text : "").toContain(
      "export const value = 1;"
    );
  });

  it("rejects paths outside the project root", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "struggle-tools-"));
    const io = new MemoryIO();
    const tools = createProjectTools({ projectPath, io });
    const readTool = getTool(tools, "read_file");

    await expect(readTool.execute("1", { path: "../outside.ts" })).rejects.toThrow("outside the project root");
  });

  it("lists, searches, and runs commands in the project root", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "struggle-tools-"));
    const io = new MemoryIO();
    const tools = createProjectTools({ projectPath, io });

    await writeFile(join(projectPath, "alpha.ts"), "export const alpha = 'needle';\n", "utf8");
    await writeFile(join(projectPath, "beta.ts"), "export const beta = 2;\n", "utf8");

    const listTool = getTool(tools, "list_files");
    const searchTool = getTool(tools, "search_files");
    const runTool = getTool(tools, "run_command");

    const listed = await listTool.execute("1", { path: ".", recursive: false });
    const listedText = listed.content[0] && "text" in listed.content[0] ? listed.content[0].text : "";
    expect(listedText).toContain("alpha.ts");
    expect(listedText).toContain("beta.ts");

    const searched = await searchTool.execute("2", { query: "needle", path: "." });
    const searchedText = searched.content[0] && "text" in searched.content[0] ? searched.content[0].text : "";
    expect(searchedText).toContain("alpha.ts:1");

    const command = await runTool.execute("3", { command: "printf 'tool-ok'" });
    const commandText = command.content[0] && "text" in command.content[0] ? command.content[0].text : "";
    expect(commandText).toContain("EXIT CODE: 0");
    expect(commandText).toContain("tool-ok");
  });

  it("reads project files from disk when they were not written through IO", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "struggle-tools-"));
    const io = new MemoryIO();
    const tools = createProjectTools({ projectPath, io });
    const readTool = getTool(tools, "read_file");

    await writeFile(join(projectPath, "package.json"), '{ "name": "demo" }\n', "utf8");
    const diskContent = await readFile(join(projectPath, "package.json"), "utf8");
    expect(diskContent).toContain('"demo"');

    const result = await readTool.execute("1", { path: "package.json" });
    const text = result.content[0] && "text" in result.content[0] ? result.content[0].text : "";
    expect(text).toContain('"demo"');
  });
});
