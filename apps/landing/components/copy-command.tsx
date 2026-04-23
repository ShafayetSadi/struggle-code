"use client";

import { useState } from "react";

import { Copy, CopyCheck } from "lucide-react";

import { Button } from "./ui/button";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button onClick={handleCopy} className="gap-2">
      {copied ? <CopyCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy command"}
    </Button>
  );
}
