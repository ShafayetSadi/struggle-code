import type { IO } from "@struggle-ai/core";
import * as vscode from "vscode";

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function createVSCodeIO(getActiveWebview: () => vscode.Webview | undefined): IO {
  return {
    async readFile(path) {
      const data = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
      return decode(data);
    },
    async writeFile(path, content) {
      await vscode.workspace.fs.writeFile(vscode.Uri.file(path), encode(content));
    },
    async fileExists(path) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(path));
        return true;
      } catch {
        return false;
      }
    },
    notify(level, message) {
      if (level === "info") {
        void vscode.window.showInformationMessage(message);
      } else if (level === "warn") {
        void vscode.window.showWarningMessage(message);
      } else {
        void vscode.window.showErrorMessage(message);
      }
    },
    stream(chunk) {
      const webview = getActiveWebview();
      if (webview) {
        void webview.postMessage({ type: "stream", chunk });
      }
    },
  };
}
