import type { Mode, TrailEntry } from "@struggle-ai/core";
import * as vscode from "vscode";

import { type CliProcess, type DaemonMessage, spawnCliDaemon } from "./cliProcess.js";
import { getPanelHtml } from "./panelHtml.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type TranscriptEntry = { role: "user" | "assistant" | "system" | "error"; text: string };

type WebviewMessage =
  | { type: "ready" }
  | { type: "send"; value: string }
  | { type: "hint"; level: 1 | 2 | 3 }
  | { type: "stuck" }
  | { type: "shareActiveFile" }
  | { type: "pickFileToShare" }
  | { type: "exportTrail" }
  | { type: "setMode"; mode: Mode }
  | { type: "pickModel" }
  | { type: "login" }
  | { type: "logout" };

// ── Trail sidebar ─────────────────────────────────────────────────────────────

class TrailProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly emitter = new vscode.EventEmitter<vscode.TreeItem | null | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private entries: TrailEntry[] = [];

  refresh(entries: TrailEntry[]): void {
    this.entries = entries;
    this.emitter.fire(null);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    if (this.entries.length === 0) {
      return [new vscode.TreeItem("No trail entries yet. Start a session to begin.")];
    }
    return this.entries.map((e) => {
      const item = new vscode.TreeItem(`${e.type} — ${new Date(e.timestamp).toLocaleTimeString()}`);
      item.tooltip = JSON.stringify(e.payload, null, 2);
      return item;
    });
  }
}

// ── Chunk → plain text ────────────────────────────────────────────────────────

function chunkToText(msg: DaemonMessage): string {
  if (msg.type !== "chunk") return "";
  const c = msg.payload;
  switch (c.kind) {
    case "text":        return c.value;
    case "code":        return `\`\`\`${c.language}\n${c.value}\n\`\`\`\n`;
    case "question":    return `\n❓ ${c.text}\n`;
    case "adr":         return `\n[ADR] ${c.adr.title}\n${c.adr.decision}\n`;
    case "checkpoint":  return `\n— ${c.label ?? c.kind2} —\n`;
    case "sub_problem": return `\n[${c.subProblem.order + 1}] ${c.subProblem.description}\n`;
    default:            return "";
  }
}

// ── Streaming helper ──────────────────────────────────────────────────────────

async function streamToPanelText(
  iterable: AsyncIterable<DaemonMessage>,
  panel: vscode.WebviewPanel,
  transcript: TranscriptEntry[],
  log: (msg: string) => void = () => {}
): Promise<void> {
  let assistantText = "";

  for await (const msg of iterable) {
    if (msg.type === "chunk" || msg.type === "stream") {
      const text = msg.type === "chunk" ? chunkToText(msg) : msg.chunk;
      if (text) {
        assistantText += text;
        void panel.webview.postMessage({ type: "patchLastAssistant", text });
      }
    } else if (msg.type === "error") {
      log(`[stream] daemon error message: ${msg.message}`);
      const entry: TranscriptEntry = { role: "error", text: msg.message };
      transcript.push(entry);
      void panel.webview.postMessage({ type: "append", entry });
    } else {
      log(`[stream] unhandled msg type=${msg.type}`);
    }
  }

  if (assistantText) {
    transcript.push({ role: "assistant", text: assistantText });
  }
}

// ── Activate ──────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel("Struggle AI");
  context.subscriptions.push(out);

  function log(msg: string): void {
    out.appendLine(`[${new Date().toISOString()}] ${msg}`);
  }

  log(`activate — extensionPath=${context.extensionPath}`);

  let activePanel: vscode.WebviewPanel | undefined;
  let cli: CliProcess | undefined;
  let currentMode: Mode = "guided";
  let providerLabel = "claude sonnet";
  let isAuthenticated = false;
  const transcript: TranscriptEntry[] = [];

  const trailProvider = new TrailProvider();

  function hydrate(panel: vscode.WebviewPanel): void {
    void panel.webview.postMessage({
      type: "hydrate",
      payload: { transcript, mode: currentMode, providerLabel, isAuthenticated, busy: false },
    });
  }

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("struggle.trailView", trailProvider),

    vscode.commands.registerCommand("struggle.start", async () => {
      log(`command struggle.start — panel already open=${!!activePanel}`);
      if (activePanel) { activePanel.reveal(); return; }

      out.show(true);
      log(`spawning CLI daemon`);
      cli = spawnCliDaemon(context.extensionPath, log, () => {
        void vscode.window.showErrorMessage(
          "Struggle AI: CLI not found. Install it globally first.",
          "Show install command"
        ).then((choice) => {
          if (choice === "Show install command") {
            const terminal = vscode.window.createTerminal("Struggle AI Setup");
            terminal.show();
            terminal.sendText("npm install -g @struggle-ai/cli");
          }
        });
      });

      activePanel = vscode.window.createWebviewPanel("struggle.panel", "Struggle AI", vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });

      activePanel.webview.html = getPanelHtml();

      const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      log(`projectPath=${projectPath}`);

      try {
        log(`calling startSession…`);
        const state = await cli.startSession(projectPath);
        log(`startSession resolved — mode=${state.mode}`);
        currentMode = state.mode;
        hydrate(activePanel);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`startSession failed: ${message}`);
        vscode.window.showErrorMessage(`Struggle AI: ${message}`);
      }

      activePanel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
        log(`[webview →] type=${msg.type}`);
        if (!cli || !activePanel) {
          log(`[webview →] ignored — cli=${!!cli} panel=${!!activePanel}`);
          return;
        }

        switch (msg.type) {
          case "ready":
            log(`webview ready — hydrating`);
            hydrate(activePanel);
            break;

          case "send": {
            log(`send: "${msg.value.slice(0, 120)}"`);
            const userEntry: TranscriptEntry = { role: "user", text: msg.value };
            transcript.push(userEntry);
            void activePanel.webview.postMessage({ type: "append", entry: userEntry });
            try {
              await streamToPanelText(cli.sendMessage(msg.value), activePanel, transcript, log);
              log(`send complete — fetching trail`);
              const trail = await cli.getTrail();
              log(`trail fetched — ${trail.length} entries`);
              trailProvider.refresh(trail);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              log(`send error: ${message}`);
            }
            break;
          }

          case "hint":
            log(`hint level=${msg.level}`);
            try {
              await streamToPanelText(cli.invokeHint(msg.level), activePanel, transcript, log);
            } catch (err) {
              log(`hint error: ${err instanceof Error ? err.message : String(err)}`);
            }
            break;

          case "stuck":
            log(`stuck`);
            try {
              await streamToPanelText(cli.invokeStuck(), activePanel, transcript, log);
            } catch (err) {
              log(`stuck error: ${err instanceof Error ? err.message : String(err)}`);
            }
            break;

          case "setMode": {
            log(`setMode mode=${msg.mode}`);
            try {
              const state = await cli.setMode(msg.mode);
              currentMode = state.mode;
              log(`setMode resolved — mode=${currentMode}`);
              hydrate(activePanel);
            } catch (err) {
              log(`setMode error: ${err instanceof Error ? err.message : String(err)}`);
            }
            break;
          }

          case "pickFileToShare": {
            const uris = await vscode.window.showOpenDialog({
              canSelectMany: false,
              canSelectFiles: true,
              canSelectFolders: false,
              openLabel: "Share with Struggle AI",
            });
            const picked = uris?.[0];
            if (!picked) { log(`pickFileToShare cancelled`); break; }
            log(`pickFileToShare: ${picked.fsPath}`);
            await cli.shareFile(picked.fsPath);
            const sysEntry: TranscriptEntry = { role: "system", text: `Shared: ${picked.fsPath}` };
            transcript.push(sysEntry);
            void activePanel.webview.postMessage({ type: "append", entry: sysEntry });
            break;
          }

          case "shareActiveFile": {
            const activeUri = vscode.window.activeTextEditor?.document.uri;
            if (!activeUri) { log(`shareActiveFile — no active editor`); vscode.window.showWarningMessage("No active file to share."); break; }
            log(`shareActiveFile: ${activeUri.fsPath}`);
            await cli.shareFile(activeUri.fsPath);
            const sysEntry: TranscriptEntry = { role: "system", text: `Shared: ${activeUri.fsPath}` };
            transcript.push(sysEntry);
            void activePanel.webview.postMessage({ type: "append", entry: sysEntry });
            break;
          }

          case "exportTrail": {
            const projPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
            const dest = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(`${projPath}/struggle-trail.md`),
              filters: { Markdown: ["md"], PDF: ["pdf"] },
              title: "Export Learning Trail",
            });
            if (!dest) { log(`exportTrail cancelled`); break; }
            const format = dest.fsPath.endsWith(".pdf") ? "pdf" : "md";
            log(`exportTrail format=${format} dest=${dest.fsPath}`);
            await cli.exportTrail(dest.fsPath, format);
            void vscode.window.showInformationMessage(`Trail exported to ${dest.fsPath}`);
            break;
          }

          case "pickModel": {
            log(`pickModel — fetching model list from daemon`);
            let modelList: { provider: string; models: string[]; currentModel: string };
            try {
              modelList = await cli.listModels();
              log(`pickModel — got ${modelList.models.length} models for provider=${modelList.provider}, current=${modelList.currentModel}`);
            } catch (err) {
              log(`pickModel — listModels failed: ${err instanceof Error ? err.message : String(err)}`);
              vscode.window.showErrorMessage("Struggle AI: Could not fetch model list.");
              break;
            }

            const items: vscode.QuickPickItem[] = modelList.models.map((m) =>
              m === modelList.currentModel ? { label: m, description: "current" } : { label: m }
            );

            const picked = await vscode.window.showQuickPick(items, {
              title: `Select model (${modelList.provider})`,
              placeHolder: "Use ↑↓ to choose, Enter to apply, Esc to close.",
              matchOnDescription: false,
            });
            if (!picked) { log(`pickModel cancelled`); break; }

            log(`pickModel — setting model: ${picked.label}`);
            try {
              await cli.setModel(picked.label);
              providerLabel = `${modelList.provider}/${picked.label}`;
              log(`pickModel — applied: ${providerLabel}`);
              hydrate(activePanel);
            } catch (err) {
              log(`pickModel — setModel failed: ${err instanceof Error ? err.message : String(err)}`);
            }
            break;
          }

          case "login": {
            isAuthenticated = true;
            log(`login requested`);
            hydrate(activePanel);
            void vscode.window.showInformationMessage("Struggle AI: Logged in.");
            break;
          }

          case "logout": {
            isAuthenticated = false;
            log(`logout requested`);
            hydrate(activePanel);
            void vscode.window.showInformationMessage("Struggle AI: Logged out.");
            break;
          }
        }
      });

      activePanel.onDidDispose(() => {
        log(`panel disposed — cleaning up`);
        cli?.dispose();
        cli = undefined;
        activePanel = undefined;
        transcript.length = 0;
      });
    })
  );
}

export function deactivate(): void {
  return;
}
