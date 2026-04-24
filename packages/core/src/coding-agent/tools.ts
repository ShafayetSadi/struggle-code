import { spawn } from "node:child_process";
import { readFile as readFileFromFs, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

import type { IO } from "../types.js";

const MAX_READ_CHARS = 120_000;
const MAX_SEARCH_RESULTS = 200;
const MAX_COMMAND_OUTPUT = 40_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;
const MAX_COMMAND_TIMEOUT_MS = 120_000;

interface ToolContext {
  projectPath: string;
  io: IO;
}

const readFileParameters = Type.Object({
  path: Type.String({ description: "Absolute or project-relative file path." }),
});

const writeFileParameters = Type.Object({
  path: Type.String({ description: "Absolute or project-relative file path." }),
  content: Type.String({ description: "Full file contents to write." }),
});

const listFilesParameters = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory path, defaults to the project root." })),
  recursive: Type.Optional(Type.Boolean({ description: "Whether to traverse subdirectories." })),
  maxDepth: Type.Optional(Type.Number({ description: "Maximum recursion depth when recursive is true." })),
});

const searchFilesParameters = Type.Object({
  query: Type.String({ description: "Exact text to search for." }),
  path: Type.Optional(Type.String({ description: "Directory path, defaults to the project root." })),
  maxDepth: Type.Optional(Type.Number({ description: "Maximum directory depth to scan." })),
});

const runCommandParameters = Type.Object({
  command: Type.String({ description: "Shell command to execute from the project root." }),
  timeoutMs: Type.Optional(Type.Number({ description: "Optional timeout in milliseconds." })),
});

function isPathInsideProject(projectPath: string, targetPath: string): boolean {
  const normalizedProjectPath = resolve(projectPath);
  const normalizedTargetPath = resolve(targetPath);
  return (
    normalizedTargetPath === normalizedProjectPath || normalizedTargetPath.startsWith(`${normalizedProjectPath}${sep}`)
  );
}

export function resolveProjectPath(projectPath: string, candidatePath: string): string {
  const resolvedPath = resolve(projectPath, candidatePath);
  if (!isPathInsideProject(projectPath, resolvedPath)) {
    throw new Error(`Path is outside the project root: ${candidatePath}`);
  }
  return resolvedPath;
}

function truncateOutput(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n... truncated ...`;
}

async function walkFiles(rootPath: string, maxDepth: number, basePath = rootPath, currentDepth = 0): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const absolutePath = resolve(rootPath, entry.name);
    const displayPath = relative(basePath, absolutePath) || ".";
    if (entry.isDirectory()) {
      paths.push(`${displayPath}/`);
      if (currentDepth < maxDepth) {
        const nested = await walkFiles(absolutePath, maxDepth, basePath, currentDepth + 1);
        paths.push(...nested);
      }
      continue;
    }

    paths.push(displayPath);
  }

  return paths.sort((left, right) => left.localeCompare(right));
}

async function searchTextFiles(rootPath: string, query: string, maxDepth: number, currentDepth = 0): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const matches: string[] = [];

  for (const entry of entries) {
    if (matches.length >= MAX_SEARCH_RESULTS) {
      break;
    }
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    const absolutePath = resolve(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (currentDepth < maxDepth) {
        matches.push(...(await searchTextFiles(absolutePath, query, maxDepth, currentDepth + 1)));
      }
      continue;
    }

    let content: string;
    try {
      content = await readFileFromFs(absolutePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index]?.includes(query)) {
        continue;
      }
      matches.push(`${relative(rootPath, absolutePath)}:${index + 1}: ${lines[index]}`);
      if (matches.length >= MAX_SEARCH_RESULTS) {
        break;
      }
    }
  }

  return matches;
}

function assertSafeCommand(command: string): void {
  const normalized = command.trim().toLowerCase();
  const bannedPatterns = ["rm -rf /", "sudo ", "mkfs", "dd ", "git reset --hard", "git checkout --"];

  for (const pattern of bannedPatterns) {
    if (normalized.includes(pattern)) {
      throw new Error(`Refusing to run unsafe command: ${pattern}`);
    }
  }
}

async function runShellCommand(
  command: string,
  projectPath: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  assertSafeCommand(command);
  const shell = process.env.SHELL ?? "/bin/sh";

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(shell, ["-lc", command], {
      cwd: projectPath,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const finish = (error?: Error, result?: { exitCode: number; stdout: string; stderr: string }) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise(result as { exitCode: number; stdout: string; stderr: string });
    };

    const onAbort = () => {
      child.kill("SIGTERM");
      finish(new Error("Command aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout = truncateOutput(`${stdout}${chunk.toString()}`, MAX_COMMAND_OUTPUT);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr = truncateOutput(`${stderr}${chunk.toString()}`, MAX_COMMAND_OUTPUT);
    });

    child.on("error", (error) => {
      finish(error);
    });

    child.on("close", (code) => {
      finish(undefined, {
        exitCode: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

export function createProjectTools({ projectPath, io }: ToolContext) {
  const readFileTool: AgentTool<typeof readFileParameters> = {
    name: "read_file",
    label: "Read File",
    description: "Read the contents of a UTF-8 text file inside the current project.",
    parameters: readFileParameters,
    async execute(_toolCallId, params) {
      const filePath = resolveProjectPath(projectPath, params.path);
      const content = await io.readFile(filePath);
      const truncated = truncateOutput(content, MAX_READ_CHARS);
      return {
        content: [{ type: "text", text: `FILE: ${filePath}\n${truncated}` }],
        details: { path: filePath, truncated: truncated.length !== content.length },
      };
    },
  };

  const writeFileTool: AgentTool<typeof writeFileParameters> = {
    name: "write_file",
    label: "Write File",
    description: "Create or overwrite a UTF-8 text file inside the current project.",
    parameters: writeFileParameters,
    async execute(_toolCallId, params) {
      const filePath = resolveProjectPath(projectPath, params.path);
      await io.writeFile(filePath, params.content);
      return {
        content: [{ type: "text", text: `Wrote ${params.content.length} characters to ${filePath}` }],
        details: { path: filePath, characters: params.content.length },
      };
    },
  };

  const listFilesTool: AgentTool<typeof listFilesParameters> = {
    name: "list_files",
    label: "List Files",
    description: "List files and directories inside the current project.",
    parameters: listFilesParameters,
    async execute(_toolCallId, params) {
      const targetPath = resolveProjectPath(projectPath, params.path ?? ".");
      const maxDepth = params.recursive ? Math.max(0, Math.min(6, Math.floor(params.maxDepth ?? 2))) : 0;
      const entries = await walkFiles(targetPath, maxDepth);
      const output = entries.length > 0 ? entries.join("\n") : "(empty directory)";
      return {
        content: [{ type: "text", text: `DIRECTORY: ${targetPath}\n${truncateOutput(output, MAX_READ_CHARS)}` }],
        details: { path: targetPath, entries: entries.length },
      };
    },
  };

  const searchFilesTool: AgentTool<typeof searchFilesParameters> = {
    name: "search_files",
    label: "Search Files",
    description: "Search for an exact text snippet across project files.",
    parameters: searchFilesParameters,
    async execute(_toolCallId, params) {
      const targetPath = resolveProjectPath(projectPath, params.path ?? ".");
      const matches = await searchTextFiles(
        targetPath,
        params.query,
        Math.max(0, Math.min(6, Math.floor(params.maxDepth ?? 4)))
      );
      const output = matches.length > 0 ? matches.join("\n") : "No matches found.";
      return {
        content: [{ type: "text", text: truncateOutput(output, MAX_READ_CHARS) }],
        details: { path: targetPath, query: params.query, matches: matches.length },
      };
    },
  };

  const runCommandTool: AgentTool<typeof runCommandParameters> = {
    name: "run_command",
    label: "Run Command",
    description: "Run a shell command in the project root and capture stdout and stderr.",
    parameters: runCommandParameters,
    async execute(_toolCallId, params, signal) {
      const timeoutMs = Math.max(
        1_000,
        Math.min(MAX_COMMAND_TIMEOUT_MS, Math.floor(params.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS))
      );
      const result = await runShellCommand(params.command, projectPath, timeoutMs, signal);
      const sections = [
        `COMMAND: ${params.command}`,
        `EXIT CODE: ${result.exitCode}`,
        "",
        "STDOUT:",
        result.stdout || "(empty)",
        "",
        "STDERR:",
        result.stderr || "(empty)",
      ];

      return {
        content: [{ type: "text", text: sections.join("\n") }],
        details: {
          command: params.command,
          exitCode: result.exitCode,
          stdoutLength: result.stdout.length,
          stderrLength: result.stderr.length,
        },
      };
    },
  };

  return [readFileTool, writeFileTool, listFilesTool, searchFilesTool, runCommandTool];
}
