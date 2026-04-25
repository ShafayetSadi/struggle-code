import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

import type { ADR, Mode, ResponseChunk, SessionState, TrailEntry } from "@struggle-ai/core";

// ── IPC message types ────────────────────────────────────────────────────────

export type DaemonMessage =
  | { type: "daemon_ready" }
  | { id: string; type: "ok" }
  | { id: string; type: "session_ready"; state: SessionState }
  | { id: string; type: "chunk"; payload: ResponseChunk }
  | { id: string; type: "stream"; chunk: string }
  | { id: string; type: "stream_start" }
  | { id: string; type: "stream_end" }
  | { id: string; type: "trail"; entries: TrailEntry[] }
  | { id: string; type: "adrs"; adrs: ADR[] }
  | { id: string; type: "models"; provider: string; models: string[]; currentModel: string }
  | { id: string; type: "error"; message: string };

type Handler = (msg: DaemonMessage) => void;

export type Log = (msg: string) => void;

// ── CliProcess ───────────────────────────────────────────────────────────────

export class CliProcess {
  private readonly proc: ChildProcess;
  private readonly handlers = new Map<string, Handler[]>();
  private idCounter = 0;
  private readonly log: Log;

  constructor(proc: ChildProcess, log: Log = () => {}) {
    this.proc = proc;
    this.log = log;

    if (!proc.stdout) throw new Error("CLI daemon has no stdout");

    const rl = createInterface({ input: proc.stdout, terminal: false });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as DaemonMessage;
        // Log every incoming message except noisy chunk/stream payloads
        if (msg.type === "chunk" || msg.type === "stream") {
          this.log(`[ipc ←] ${msg.type} id=${(msg as { id: string }).id}`);
        } else {
          this.log(`[ipc ←] ${JSON.stringify(msg)}`);
        }
        const id = "id" in msg ? (msg as { id: string }).id : undefined;
        for (const h of this.handlers.get(id ?? "") ?? []) h(msg);
        for (const h of this.handlers.get("*") ?? []) h(msg);
      } catch (err) {
        this.log(`[ipc ←] malformed line (parse error: ${err}): ${trimmed.slice(0, 200)}`);
      }
    });

    proc.on("error", (err) => {
      this.log(`[daemon] process error: ${err.message}`);
    });

    proc.on("exit", (code, signal) => {
      this.log(`[daemon] process exited — code=${code ?? "null"} signal=${signal ?? "null"}`);
    });
  }

  private nextId(): string {
    return String(++this.idCounter);
  }

  private send(method: string, params?: Record<string, unknown>): string {
    const id = this.nextId();
    const payload = JSON.stringify({ id, method, params });
    this.log(`[ipc →] ${payload}`);
    this.proc.stdin?.write(`${payload}\n`);
    return id;
  }

  private once(id: string, handler: Handler): void {
    const list = this.handlers.get(id) ?? [];
    const wrapped: Handler = (msg) => {
      handler(msg);
      const updated = this.handlers.get(id)?.filter((h) => h !== wrapped) ?? [];
      if (updated.length === 0) this.handlers.delete(id);
      else this.handlers.set(id, updated);
    };
    list.push(wrapped);
    this.handlers.set(id, list);
  }

  private on(id: string, handler: Handler): () => void {
    const list = this.handlers.get(id) ?? [];
    list.push(handler);
    this.handlers.set(id, list);
    return () => {
      const updated = this.handlers.get(id)?.filter((h) => h !== handler) ?? [];
      if (updated.length === 0) this.handlers.delete(id);
      else this.handlers.set(id, updated);
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  startSession(projectPath: string): Promise<SessionState> {
    this.log(`[session] startSession path=${projectPath}`);
    const id = this.send("startSession", { projectPath });
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "session_ready") {
          this.log(`[session] ready — mode=${msg.state.mode}`);
          resolve(msg.state);
        } else if (msg.type === "error") {
          this.log(`[session] startSession error: ${msg.message}`);
          reject(new Error(msg.message));
        }
      });
    });
  }

  sendMessage(text: string): AsyncIterable<DaemonMessage> {
    this.log(`[session] sendMessage: ${text.slice(0, 120)}`);
    return this.streamRequest("sendMessage", { text });
  }

  listModels(provider?: string): Promise<{ provider: string; models: string[]; currentModel: string }> {
    const id = this.send("listModels", provider ? { provider } : {});
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "models") resolve({ provider: msg.provider, models: msg.models, currentModel: msg.currentModel });
        else if (msg.type === "error") reject(new Error(msg.message));
      });
    });
  }

  setModel(model: string, provider?: string): Promise<void> {
    const id = this.send("setModel", provider ? { model, provider } : { model });
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "ok") resolve();
        else if (msg.type === "error") reject(new Error(msg.message));
      });
    });
  }

  setMode(mode: Mode): Promise<SessionState> {
    const id = this.send("setMode", { mode });
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "session_ready") resolve(msg.state);
        else if (msg.type === "error") reject(new Error(msg.message));
      });
    });
  }

  invokeStuck(): AsyncIterable<DaemonMessage> {
    return this.streamRequest("invokeStuck");
  }

  invokeHint(level: 1 | 2 | 3): AsyncIterable<DaemonMessage> {
    return this.streamRequest("invokeHint", { level });
  }

  shareFile(path: string): Promise<void> {
    const id = this.send("shareFile", { path });
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "ok") resolve();
        else if (msg.type === "error") reject(new Error(msg.message));
      });
    });
  }

  exportTrail(outputPath: string, format: "md" | "pdf"): Promise<void> {
    const id = this.send("exportTrail", { outputPath, format });
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "ok") resolve();
        else if (msg.type === "error") reject(new Error(msg.message));
      });
    });
  }

  getTrail(): Promise<TrailEntry[]> {
    const id = this.send("getTrail");
    return new Promise((resolve, reject) => {
      this.once(id, (msg) => {
        if (msg.type === "trail") resolve(msg.entries);
        else if (msg.type === "error") reject(new Error(msg.message));
      });
    });
  }

  dispose(): void {
    try {
      this.proc.stdin?.write(`${JSON.stringify({ id: this.nextId(), method: "shutdown" })}\n`);
    } catch {
      // process may already be dead
    }
    this.proc.kill();
  }

  private streamRequest(method: string, params?: Record<string, unknown>): AsyncIterable<DaemonMessage> {
    this.log(`[stream] start — method=${method}`);
    const id = this.send(method, params);
    const queue: DaemonMessage[] = [];
    let done = false;
    let notify: (() => void) | undefined;

    const off = this.on(id, (msg) => {
      queue.push(msg);
      notify?.();
      notify = undefined;
      if (msg.type === "stream_end") {
        this.log(`[stream] end — method=${method} id=${id}`);
        done = true;
        off();
      } else if (msg.type === "error") {
        this.log(`[stream] error — method=${method} id=${id}: ${msg.message}`);
        done = true;
        off();
      }
    });

    return {
      async *[Symbol.asyncIterator]() {
        while (!done || queue.length > 0) {
          if (queue.length === 0) {
            await new Promise<void>((res) => { notify = res; });
            continue;
          }
          const item = queue.shift();
          if (item) yield item;
        }
      },
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

const CLI_NOT_FOUND_PATTERNS = /not recognized|not found|No such file|command not found|cannot find/i;

export function spawnCliDaemon(
  extensionPath: string,
  log: Log = () => {},
  onCliNotFound?: () => void
): CliProcess {
  const devCliPath = resolve(extensionPath, "../cli/dist/index.js");
  const devExists = existsSync(devCliPath);

  log(`[daemon] extensionPath=${extensionPath}`);
  log(`[daemon] devCliPath=${devCliPath} exists=${devExists}`);

  let proc: ChildProcess;
  if (devExists) {
    log(`[daemon] spawning: node ${devCliPath} daemon`);
    proc = spawn("node", [devCliPath, "daemon"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
  } else {
    log(`[daemon] spawning: struggle daemon (global install)`);
    proc = spawn("struggle", ["daemon"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      env: process.env,
    });
  }

  let sawNotFound = false;

  if (proc.stderr) {
    const rl = createInterface({ input: proc.stderr, terminal: false });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      log(`[daemon stderr] ${trimmed}`);
      if (CLI_NOT_FOUND_PATTERNS.test(trimmed)) {
        sawNotFound = true;
      }
    });
  }

  proc.on("exit", (code) => {
    if (code !== 0 && sawNotFound) {
      log(`[daemon] CLI not found — triggering onCliNotFound`);
      onCliNotFound?.();
    }
  });

  return new CliProcess(proc, log);
}
