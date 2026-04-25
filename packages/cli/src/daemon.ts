import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

import { getModels } from "@mariozechner/pi-ai";
import { type IO, type Mode, type Provider, type ResponseChunk, type Session, startSession } from "@struggle-ai/core";

import { CONFIG_PATH, getCurrentConfig, writeConfigFile } from "./configStore.js";

function writeLine(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

// Tag stream() calls with the active request id so the extension can correlate them
let activeRequestId: string | null = null;

const daemonIO: IO = {
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
    process.stderr.write(`${JSON.stringify({ type: "notify", level, message })}\n`);
  },
  stream(chunk) {
    if (activeRequestId !== null) {
      writeLine({ id: activeRequestId, type: "stream", chunk });
    }
  },
};

async function handleStream(id: string, iterable: AsyncIterable<ResponseChunk>): Promise<void> {
  activeRequestId = id;
  writeLine({ id, type: "stream_start" });
  try {
    for await (const chunk of iterable) {
      writeLine({ id, type: "chunk", payload: chunk });
    }
    writeLine({ id, type: "stream_end" });
  } finally {
    activeRequestId = null;
  }
}

export async function runDaemon(): Promise<void> {
  let session: Session | undefined;

  writeLine({ type: "daemon_ready" });

  const rl = createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let req: { id: string; method: string; params?: Record<string, unknown> };
    try {
      req = JSON.parse(trimmed) as typeof req;
    } catch {
      writeLine({ id: "?", type: "error", message: "Invalid JSON" });
      continue;
    }

    const { id, method, params = {} } = req;

    try {
      switch (method) {
        case "startSession": {
          const projectPath = typeof params.projectPath === "string" ? params.projectPath : process.cwd();
          const config = await getCurrentConfig();
          session = await startSession(projectPath, daemonIO, config);
          writeLine({ id, type: "session_ready", state: session.state });
          break;
        }

        case "sendMessage": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          const text = typeof params.text === "string" ? params.text : "";
          await handleStream(id, session.sendMessage(text));
          break;
        }

        case "setMode": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          session.setMode(params.mode as Mode);
          writeLine({ id, type: "session_ready", state: session.state });
          break;
        }

        case "invokeStuck": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          await handleStream(id, session.invokeStuck());
          break;
        }

        case "invokeHint": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          await handleStream(id, session.invokeHint(params.level as 1 | 2 | 3));
          break;
        }

        case "shareFile": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          const filePath = typeof params.path === "string" ? params.path : "";
          await session.shareFile(filePath);
          writeLine({ id, type: "ok" });
          break;
        }

        case "exportTrail": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          const outputPath = typeof params.outputPath === "string" ? params.outputPath : "";
          const format = params.format === "pdf" ? "pdf" : "md";
          await session.exportTrail(outputPath, format);
          writeLine({ id, type: "ok" });
          break;
        }

        case "getTrail": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          writeLine({ id, type: "trail", entries: session.getTrail() });
          break;
        }

        case "getADRs": {
          if (!session) { writeLine({ id, type: "error", message: "No active session" }); break; }
          writeLine({ id, type: "adrs", adrs: session.getADRs() });
          break;
        }

        case "listModels": {
          const config = await getCurrentConfig();
          const provider = (typeof params.provider === "string" ? params.provider : config.provider) as Provider;
          const models = (getModels(provider as Parameters<typeof getModels>[0]) as { id: string }[]).map((m) => m.id);
          writeLine({ id, type: "models", provider, models, currentModel: config.model });
          break;
        }

        case "setModel": {
          const config = await getCurrentConfig();
          const model = typeof params.model === "string" ? params.model : config.model;
          const provider = (typeof params.provider === "string" ? params.provider : config.provider) as Provider;
          const nextConfig = { ...config, provider, model };
          await writeConfigFile(CONFIG_PATH, nextConfig);
          if (session) session.setProviderConfig(nextConfig);
          writeLine({ id, type: "ok" });
          break;
        }

        case "shutdown":
          writeLine({ id, type: "ok" });
          process.exit(0);
          break;

        default:
          writeLine({ id, type: "error", message: `Unknown method: ${method}` });
      }
    } catch (err) {
      activeRequestId = null;
      const message = err instanceof Error ? err.message : String(err);
      writeLine({ id, type: "error", message });
    }
  }
}
