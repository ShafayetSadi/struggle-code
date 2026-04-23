import { z } from "zod";

import type { ADR } from "../types.js";

const allowedHosts = new Set([
  "developer.mozilla.org",
  "docs.python.org",
  "react.dev",
  "fastapi.tiangolo.com",
  "docs.djangoproject.com",
  "docs.djangoproject.com",
  "nodejs.org",
  "typescriptlang.org",
  "www.typescriptlang.org",
]);

const adrSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.string().min(1),
  concepts: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string().min(1)),
  docLinks: z.array(z.string()).default([]),
  createdAt: z.string().min(1),
});

export function filterAllowlistedDocLinks(docLinks: string[]): string[] {
  return docLinks.flatMap((docLink) => {
    try {
      const url = new URL(docLink);
      return allowedHosts.has(url.hostname) ? [url.toString()] : [];
    } catch {
      return [];
    }
  });
}

export function validateADR(candidate: unknown): ADR {
  const parsed = adrSchema.parse(candidate);
  return {
    ...parsed,
    concepts: parsed.concepts.slice(0, 3),
    risks: parsed.risks.slice(0, 2),
    docLinks: filterAllowlistedDocLinks(parsed.docLinks),
  };
}
