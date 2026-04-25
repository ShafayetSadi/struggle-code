import { spawn } from "node:child_process";
import * as process from "node:process";

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
  if (process.platform === "win32") {
    await runClipboardCommand("clip", [], text);
    return;
  }

  if (process.platform === "darwin") {
    await runClipboardCommand("pbcopy", [], text);
    return;
  }

  try {
    await runClipboardCommand("wl-copy", [], text);
    return;
  } catch {}

  try {
    await runClipboardCommand("xclip", ["-selection", "clipboard"], text);
    return;
  } catch {}

  await runClipboardCommand("xsel", ["--clipboard", "--input"], text);
}
