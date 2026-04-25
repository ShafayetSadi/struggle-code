import { spawn } from "node:child_process";
import * as process from "node:process";

const ANSI_CSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const ANSI_OSC_PATTERN = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g;

function stripAnsiSequences(text: string): string {
  return text.replace(ANSI_OSC_PATTERN, "").replace(ANSI_CSI_PATTERN, "");
}

function runClipboardCommand(command: string, args: string[], text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const succeed = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    child.on("error", (error) => fail(error));
    child.on("close", (code) => {
      if (code === 0) {
        succeed();
        return;
      }
      fail(new Error(`Clipboard command failed: ${command}`));
    });

    child.stdin.on("error", (error) => fail(error));
    child.stdin.end(text);
  });
}

export async function copyToClipboard(text: string): Promise<void> {
  const plainText = stripAnsiSequences(text);

  if (process.platform === "win32") {
    await runClipboardCommand("clip", [], plainText);
    return;
  }

  if (process.platform === "darwin") {
    await runClipboardCommand("pbcopy", [], plainText);
    return;
  }

  try {
    await runClipboardCommand("wl-copy", [], plainText);
    return;
  } catch {}

  try {
    await runClipboardCommand("xclip", ["-selection", "clipboard"], plainText);
    return;
  } catch {}

  await runClipboardCommand("xsel", ["--clipboard", "--input"], plainText);
}
