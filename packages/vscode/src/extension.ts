import { homedir } from "node:os";
import { join, resolve } from "node:path";

import * as vscode from "vscode";
import { getModels } from "@mariozechner/pi-ai";

import {
  DEFAULT_CONFIGS,
  loadConfig,
  startSession,
  type ADR,
  type Mode,
  type OAuthCredentials,
  type Provider,
  type ProviderAuth,
  type ProviderConfig,
  type ResponseChunk,
  type Session,
  type TrailEntry,
} from "@struggle-ai/core";

import { createVSCodeIO } from "./ioImpl.js";
import { getPanelHtml } from "./panelHtml.js";

const CONFIG_DIR = join(homedir(), ".struggle-ai");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const AUTH_PATH = join(CONFIG_DIR, "auth.json");

type TranscriptRole = "user" | "assistant" | "system" | "error";

interface TranscriptEntry {
  role: TranscriptRole;
  text: string;
}

interface HydratePayload {
  transcript: TranscriptEntry[];
  busy: boolean;
  mode: Mode;
  providerLabel: string;
  projectLabel: string;
  status: string;
}

type StoredOAuthMap = Partial<Record<Provider, { type: "oauth" } & OAuthCredentials>>;

interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  cause?: SerializedError;
}

type WebviewRequest =
  | { type: "ready" }
  | { type: "send"; value: string }
  | { type: "setMode"; mode: Mode }
  | { type: "stuck" }
  | { type: "hint"; level?: 1 | 2 | 3 }
  | { type: "shareActiveFile" }
  | { type: "pickFileToShare" }
  | { type: "pickModel" }
  | { type: "exportTrail" };

class TrailProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  private trail: TrailEntry[] = [];
  private adrs: ADR[] = [];

  readonly onDidChangeTreeData = this.emitter.event;

  setData(trail: TrailEntry[], adrs: ADR[]): void {
    this.trail = trail;
    this.adrs = adrs;
    this.emitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      if (this.trail.length === 0 && this.adrs.length === 0) {
        return [new vscode.TreeItem("No trail entries yet. Start a session to begin.")];
      }

      const roots: vscode.TreeItem[] = [];
      const trailRoot = new vscode.TreeItem(`Trail (${this.trail.length})`, vscode.TreeItemCollapsibleState.Expanded);
      trailRoot.id = "trail-root";
      roots.push(trailRoot);

      if (this.adrs.length > 0) {
        const adrRoot = new vscode.TreeItem(`ADRs (${this.adrs.length})`, vscode.TreeItemCollapsibleState.Expanded);
        adrRoot.id = "adr-root";
        roots.push(adrRoot);
      }

      return roots;
    }

    if (element.id === "trail-root") {
      return this.trail
        .slice()
        .reverse()
        .map((entry) => {
          const item = new vscode.TreeItem(`${formatTrailType(entry.type)}  ${summarizeTrailEntry(entry)}`);
          item.description = new Date(entry.timestamp).toLocaleTimeString();
          item.tooltip = JSON.stringify(entry.payload, null, 2);
          item.iconPath = new vscode.ThemeIcon(iconForTrail(entry.type));
          return item;
        });
    }

    if (element.id === "adr-root") {
      return this.adrs
        .slice()
        .reverse()
        .map((adr) => {
          const item = new vscode.TreeItem(adr.title, vscode.TreeItemCollapsibleState.Collapsed);
          item.id = `adr-${adr.id}`;
          item.description = adr.createdAt;
          item.iconPath = new vscode.ThemeIcon("book");
          return item;
        });
    }

    if (element.id?.startsWith("adr-")) {
      const adr = this.adrs.find((entry) => `adr-${entry.id}` === element.id);
      if (!adr) {
        return [];
      }

      return [
        new vscode.TreeItem(`Decision: ${adr.decision}`),
        new vscode.TreeItem(`Context: ${adr.context}`),
        new vscode.TreeItem(`Consequences: ${adr.consequences}`),
      ];
    }

    return [];
  }
}

function formatTrailType(type: TrailEntry["type"]): string {
  return type.replace(/_/g, " ");
}

function iconForTrail(type: TrailEntry["type"]): string {
  switch (type) {
    case "user_turn":
      return "person";
    case "ai_response":
      return "comment-discussion";
    case "mode_change":
      return "settings-gear";
    case "file_share":
      return "file";
    case "milestone_start":
    case "milestone_complete":
      return "target";
    case "hint":
      return "lightbulb";
    case "stuck_session":
      return "question";
    default:
      return "history";
  }
}

function summarizeTrailEntry(entry: TrailEntry): string {
  if (entry.type === "user_turn") {
    const message = (entry.payload as { message?: unknown })?.message;
    return typeof message === "string" ? truncate(message, 52) : "User message";
  }

  if (entry.type === "ai_response") {
    const chunks = (entry.payload as { chunks?: Array<{ value?: string; text?: string }> })?.chunks;
    const text = chunks?.map((chunk) => chunk.value ?? chunk.text ?? "").join("").trim();
    return text ? truncate(text, 52) : "Assistant response";
  }

  if (entry.type === "file_share") {
    const path = (entry.payload as { path?: unknown })?.path;
    return typeof path === "string" ? truncate(path, 52) : "Shared file";
  }

  if (entry.type === "mode_change") {
    const mode = (entry.payload as { mode?: unknown })?.mode;
    return typeof mode === "string" ? `Switched to ${mode}` : "Mode updated";
  }

  const text = JSON.stringify(entry.payload);
  return truncate(text ?? "Trail entry", 52);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const candidate = error as Error & { cause?: unknown };
    return {
      ...(error.name ? { name: error.name } : {}),
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(candidate.cause ? { cause: serializeError(candidate.cause) } : {}),
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

function formatSerializedError(error: SerializedError, depth = 0): string[] {
  const prefix = depth === 0 ? "Error" : `Cause ${depth}`;
  const lines = [`${prefix}: ${error.name ? `${error.name}: ` : ""}${error.message}`];

  if (error.stack) {
    lines.push("Stack:");
    lines.push(error.stack);
  }

  if (error.cause) {
    lines.push(...formatSerializedError(error.cause, depth + 1));
  }

  return lines;
}

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getProjectLabel(projectPath: string): string {
  const parts = projectPath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || projectPath;
}

function toRelativePath(projectPath: string, targetPath: string): string {
  const normalizedProject = projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedTarget = targetPath.replace(/\\/g, "/");
  return normalizedTarget.startsWith(`${normalizedProject}/`)
    ? normalizedTarget.slice(normalizedProject.length + 1)
    : targetPath;
}

function getProviderLabel(provider: Provider): string {
  switch (provider) {
    case "openai-codex":
      return "OpenAI Codex";
    case "google-antigravity":
      return "Antigravity";
    case "openrouter":
      return "OpenRouter";
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "google":
      return "Google";
  }
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function readText(path: string): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
    return decode(bytes);
  } catch {
    return undefined;
  }
}

async function readAuthStore(): Promise<StoredOAuthMap> {
  const raw = await readText(AUTH_PATH);
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as StoredOAuthMap;
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(join(path, "..")));
  await vscode.workspace.fs.writeFile(vscode.Uri.file(path), bytes);
}

function attachRuntimeAuth(config: ProviderConfig, authStore: StoredOAuthMap): ProviderConfig {
  const storedAuth = authStore[config.provider];
  if (!storedAuth) {
    return config;
  }

  return {
    ...config,
    auth: {
      type: "oauth",
      credentials: {
        refresh: storedAuth.refresh,
        access: storedAuth.access,
        expires: storedAuth.expires,
        ...(storedAuth.enterpriseUrl ? { enterpriseUrl: storedAuth.enterpriseUrl } : {}),
        ...(storedAuth.projectId ? { projectId: storedAuth.projectId } : {}),
        ...(storedAuth.email ? { email: storedAuth.email } : {}),
        ...(storedAuth.accountId ? { accountId: storedAuth.accountId } : {}),
      },
    },
    onAuthRefresh: async (auth: ProviderAuth) => {
      if (auth.type !== "oauth") {
        return;
      }

      const nextStore = await readAuthStore();
      nextStore[config.provider] = { type: "oauth", ...auth.credentials };
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(AUTH_PATH),
        new TextEncoder().encode(`${JSON.stringify(nextStore, null, 2)}\n`)
      );
    },
  };
}

async function loadSharedProviderConfig(): Promise<ProviderConfig> {
  const [config, authStore] = await Promise.all([
    loadConfig(CONFIG_PATH, {
      env: process.env,
      readText,
    }),
    readAuthStore(),
  ]);

  return attachRuntimeAuth(config, authStore);
}

async function saveSharedProviderConfig(config: ProviderConfig): Promise<void> {
  const { onAuthRefresh: _ignored, ...serializable } = config;
  const dir = CONFIG_DIR;
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(CONFIG_PATH),
    new TextEncoder().encode(`${JSON.stringify(serializable, null, 2)}\n`)
  );
}

function formatChunk(chunk: ResponseChunk): string {
  switch (chunk.kind) {
    case "text":
      return chunk.value;
    case "code":
      return `\n\`\`\`${chunk.language}\n${chunk.value}\n\`\`\`\n`;
    case "question":
      return `\nQuestion: ${chunk.text}\n`;
    case "checkpoint":
      return `\nCheckpoint (${chunk.kind2}): ${chunk.label}\n`;
    case "sub_problem":
      return `\nSub-problem: ${chunk.subProblem.description}\n${chunk.subProblem.questions.map((q) => `- ${q}`).join("\n")}\n`;
    case "adr":
      return `\nADR: ${chunk.adr.title}\nDecision: ${chunk.adr.decision}\n`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Struggle AI");
  let activePanel: vscode.WebviewPanel | undefined;
  let session: Session | undefined;
  let projectPath = getWorkspacePath();
  let providerConfig: ProviderConfig = DEFAULT_CONFIGS.anthropic;
  let transcript: TranscriptEntry[] = [];
  let busy = false;
  let status = "Start a session to begin.";

  const trailProvider = new TrailProvider();

  const getActiveWebview = () => activePanel?.webview;
  const io = createVSCodeIO(getActiveWebview);

  const postMessage = async (message: unknown) => {
    if (!activePanel) {
      return;
    }
    await activePanel.webview.postMessage(message);
  };

  const refreshTrail = () => {
    trailProvider.setData(session?.getTrail() ?? [], session?.getADRs() ?? []);
  };

  const syncWebview = async () => {
    if (!activePanel || !projectPath) {
      return;
    }

    const payload: HydratePayload = {
      transcript,
      busy,
      mode: session?.state.mode ?? "guided",
      providerLabel: `${getProviderLabel(providerConfig.provider)}/${providerConfig.model}`,
      projectLabel: getProjectLabel(projectPath),
      status,
    };

    await postMessage({ type: "hydrate", payload });
  };

  const appendTranscript = async (role: TranscriptRole, text: string) => {
    transcript.push({ role, text });
    await postMessage({ type: "append", entry: { role, text } });
  };

  const appendChunkToAssistant = async (text: string) => {
    const last = transcript[transcript.length - 1];
    if (!last || last.role !== "assistant") {
      transcript.push({ role: "assistant", text });
      await postMessage({ type: "append", entry: { role: "assistant", text } });
      return;
    }

    last.text += text;
    await postMessage({ type: "patchLastAssistant", text });
  };

  const ensureWorkspace = (): string | undefined => {
    projectPath = getWorkspacePath();
    if (!projectPath) {
      void vscode.window.showErrorMessage("Open a workspace folder before starting Struggle AI.");
      return undefined;
    }
    return projectPath;
  };

  const ensureSession = async (): Promise<boolean> => {
    const rootPath = ensureWorkspace();
    if (!rootPath) {
      return false;
    }

    if (session && session.state.projectPath === rootPath) {
      return true;
    }

    providerConfig = await loadSharedProviderConfig();
    session = await startSession(rootPath, io, providerConfig);
    transcript = [];
    status = "Session started. Ask about the codebase or use the quick actions.";
    refreshTrail();
    await appendTranscript(
      "system",
      `Connected to ${getProviderLabel(providerConfig.provider)} using model ${providerConfig.model}.`
    );
    await syncWebview();
    return true;
  };

  const streamIterable = async (iterable: AsyncIterable<ResponseChunk>) => {
    let startedAssistant = false;
    for await (const chunk of iterable) {
      if (!startedAssistant) {
        transcript.push({ role: "assistant", text: "" });
        await postMessage({ type: "append", entry: { role: "assistant", text: "" } });
        startedAssistant = true;
      }
      await appendChunkToAssistant(formatChunk(chunk));
    }
    refreshTrail();
    await syncWebview();
  };

  const executeSlashCommand = async (value: string): Promise<boolean> => {
    if (!session || !projectPath) {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("/")) {
      return false;
    }

    if (trimmed === "/help") {
      await appendTranscript(
        "system",
        [
          "Available commands:",
          "/mode <guided|standard|socratic>",
          "/stuck",
          "/hint [1|2|3]",
          "/share <relative-path>",
          "/trail export",
        ].join("\n")
      );
      return true;
    }

    if (trimmed.startsWith("/mode ")) {
      const mode = trimmed.slice("/mode ".length).trim();
      if (mode === "guided" || mode === "standard" || mode === "socratic") {
        session.setMode(mode);
        status = `Mode set to ${mode}.`;
        await syncWebview();
        refreshTrail();
        return true;
      }
      await appendTranscript("error", `Unknown mode: ${mode}`);
      return true;
    }

    if (trimmed === "/stuck") {
      await streamIterable(session.invokeStuck());
      status = "Shared a stuck-session prompt.";
      return true;
    }

    if (trimmed.startsWith("/hint")) {
      const rawLevel = trimmed.split(/\s+/)[1];
      const level =
        rawLevel === "1" || rawLevel === "2" || rawLevel === "3" ? (Number(rawLevel) as 1 | 2 | 3) : 1;
      await streamIterable(session.invokeHint(level));
      status = `Shared hint level ${level}.`;
      return true;
    }

    if (trimmed.startsWith("/share ")) {
      const relativePath = trimmed.slice("/share ".length).trim();
      const resolvedPath = resolve(projectPath, relativePath);
      await session.shareFile(resolvedPath);
      status = `Shared ${relativePath} with the session.`;
      await appendTranscript("system", `Shared file: ${relativePath}`);
      refreshTrail();
      await syncWebview();
      return true;
    }

    if (trimmed === "/trail export") {
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(join(projectPath, ".struggle-ai", `trail-${session.state.id}.md`)),
        filters: { Markdown: ["md"] },
      });
      if (!target) {
        return true;
      }
      await session.exportTrail(target.fsPath, "md");
      status = `Trail exported to ${target.fsPath}.`;
      refreshTrail();
      await syncWebview();
      return true;
    }

    return false;
  };

  const sendUserMessage = async (value: string) => {
    if (busy) {
      return;
    }

    if (!(await ensureSession()) || !session) {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    busy = true;
    status = "Working on your request...";
    await appendTranscript("user", trimmed);
    await syncWebview();

    try {
      const handled = await executeSlashCommand(trimmed);
      if (!handled) {
        await streamIterable(session.sendMessage(trimmed));
        status = "Ready for the next turn.";
      }
    } catch (error) {
      const serialized = serializeError(error);
      const timestamp = new Date().toISOString();

      output.appendLine(`[${timestamp}] sendUserMessage failed`);
      output.appendLine(`request: ${trimmed}`);
      output.appendLine(`provider: ${providerConfig.provider}`);
      output.appendLine(`model: ${providerConfig.model}`);
      output.appendLine(`mode: ${session.state.mode}`);
      for (const line of formatSerializedError(serialized)) {
        output.appendLine(line);
      }
      output.appendLine("");
      output.show(true);

      const message = serialized.message || "Unknown extension error";
      await appendTranscript("error", `${message}\n\nSee the "Struggle AI" Output panel for details.`);
      status = "The last request failed.";
    } finally {
      busy = false;
      refreshTrail();
      await syncWebview();
    }
  };

  const shareActiveFile = async () => {
    if (!(await ensureSession()) || !session) {
      return;
    }

    if (!projectPath) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      await appendTranscript("error", "Open a file first so Struggle AI can share it with the session.");
      return;
    }

    await session.shareFile(editor.document.uri.fsPath);
    const sharedPath = toRelativePath(projectPath, editor.document.uri.fsPath);
    status = `Shared ${sharedPath} with the session.`;
    await appendTranscript("system", `Shared file: ${sharedPath}`);
    refreshTrail();
    await syncWebview();
  };

  const pickFileToShare = async () => {
    if (!(await ensureSession()) || !session || !projectPath) {
      return;
    }

    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(projectPath),
      openLabel: "Share with Struggle AI",
    });

    const file = picked?.[0];
    if (!file) {
      return;
    }

    await session.shareFile(file.fsPath);
    const sharedPath = toRelativePath(projectPath, file.fsPath);
    status = `Shared ${sharedPath} with the session.`;
    await appendTranscript("system", `Shared file: ${sharedPath}`);
    refreshTrail();
    await syncWebview();
  };

  const exportTrail = async () => {
    if (!(await ensureSession()) || !session || !projectPath) {
      return;
    }

    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(join(projectPath, ".struggle-ai", `trail-${session.state.id}.md`)),
      filters: { Markdown: ["md"] },
    });

    if (!target) {
      return;
    }

    await session.exportTrail(target.fsPath, "md");
    status = `Trail exported to ${target.fsPath}.`;
    refreshTrail();
    await syncWebview();
  };

  const pickModel = async () => {
    if (!(await ensureSession()) || !session) {
      return;
    }

    const models = getModels(providerConfig.provider)
      .map((model) => model.id)
      .sort((a, b) => a.localeCompare(b));

    const selected = await vscode.window.showQuickPick(
      models.map((model) => ({
        label: model,
        description: model === providerConfig.model ? "current" : "",
      })),
      {
        title: `Choose model for ${getProviderLabel(providerConfig.provider)}`,
        placeHolder: "Select a model",
      }
    );

    if (!selected || selected.label === providerConfig.model) {
      return;
    }

    providerConfig = {
      ...providerConfig,
      model: selected.label,
    };
    session.setProviderConfig(providerConfig);
    await saveSharedProviderConfig(providerConfig);
    status = `Model set to ${providerConfig.model}.`;
    await appendTranscript("system", `Model changed to ${getProviderLabel(providerConfig.provider)}/${providerConfig.model}`);
    refreshTrail();
    await syncWebview();
  };

  const startPanel = async () => {
    if (activePanel) {
      activePanel.reveal(vscode.ViewColumn.One);
      await syncWebview();
      return;
    }

    activePanel = vscode.window.createWebviewPanel("struggle.panel", "Struggle AI", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    activePanel.webview.html = getPanelHtml();

    activePanel.webview.onDidReceiveMessage(async (message: WebviewRequest) => {
      switch (message.type) {
        case "ready":
          await syncWebview();
          break;
        case "send":
          await sendUserMessage(message.value);
          break;
        case "setMode":
          if (await ensureSession() && session) {
            session.setMode(message.mode);
            status = `Mode set to ${message.mode}.`;
            refreshTrail();
            await syncWebview();
          }
          break;
        case "stuck":
          if (await ensureSession() && session) {
            await streamIterable(session.invokeStuck());
            status = "Shared a stuck-session prompt.";
          }
          break;
        case "hint":
          if (await ensureSession() && session) {
            await streamIterable(session.invokeHint(message.level ?? 1));
            status = `Shared hint level ${message.level ?? 1}.`;
          }
          break;
        case "shareActiveFile":
          await shareActiveFile();
          break;
        case "pickFileToShare":
          await pickFileToShare();
          break;
        case "pickModel":
          await pickModel();
          break;
        case "exportTrail":
          await exportTrail();
          break;
      }
    });

    activePanel.onDidDispose(() => {
      activePanel = undefined;
    });

    if (await ensureSession()) {
      await syncWebview();
    }
  };

  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider("struggle.trailView", trailProvider),
    vscode.commands.registerCommand("struggle.start", async () => {
      await startPanel();
    })
  );
}

export function deactivate(): void {
  return;
}
