import * as vscode from "vscode";

import { getPanelHtml } from "./panelHtml.js";

class TrailProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly emitter = new vscode.EventEmitter<vscode.TreeItem | null | undefined>();

  readonly onDidChangeTreeData = this.emitter.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return [new vscode.TreeItem("No trail entries yet. Start a session to begin.")];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  let activePanel: vscode.WebviewPanel | undefined;

  const trailProvider = new TrailProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("struggle.trailView", trailProvider),
    vscode.commands.registerCommand("struggle.start", () => {
      activePanel = vscode.window.createWebviewPanel("struggle.panel", "Struggle AI", vscode.ViewColumn.One, {
        enableScripts: true,
      });
      activePanel.webview.html = getPanelHtml();
      activePanel.onDidDispose(() => {
        activePanel = undefined;
      });
    })
  );
}

export function deactivate(): void {
  return;
}
