export type Mode = "full-socratic" | "guided" | "standard";
export type Intent = "quick_help" | "debug" | "project";
export type Provider = "anthropic" | "google" | "openai";

export interface ProviderConfig {
  provider: Provider;
  model: string; // e.g., "claude-sonnet-4-5", "gemini-2.5-flash", "gpt-4o"
  apiKeyEnv: string; // name of env var, not the key itself
}

export interface SessionState {
  id: string;
  projectPath: string;
  mode: Mode;
  modePhase?: "idle" | "planning" | "awaiting-approval" | "awaiting-validation" | "executing" | "verifying";
  understandingScore: number; // 0-100
  activeMilestone?: string;
  activeSubProblem?: string;
  sharedFiles: string[];
  createdAt: string;
  lastActive: string;
}

export type TrailEntryType =
  | "session_start"
  | "user_turn"
  | "ai_response"
  | "mode_change"
  | "file_share"
  | "milestone_start"
  | "milestone_complete"
  | "sub_problem_start"
  | "sub_problem_complete"
  | "comprehension_check"
  | "explain_it_back"
  | "adr_generated"
  | "stuck_session"
  | "hint"
  | "bypass"
  | "session_end";

export interface TrailEntry {
  id: string;
  timestamp: string;
  type: TrailEntryType;
  mode: Mode;
  intent?: Intent;
  payload: unknown;
}

export interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  concepts: string[]; // "Concepts You Should Know" (3 bullets max)
  risks: string[]; // "What Could Break" (2 scenarios max)
  docLinks: string[]; // Real URLs from allowlisted sources only
  createdAt: string;
}

export interface ImplementationPlanFile {
  path: string;
  action: "create" | "update";
  why: string;
}

export interface ImplementationPhase {
  id: string;
  title: string;
  summary: string;
  files: ImplementationPlanFile[];
  verification: string[];
}

export interface ImplementationPlan {
  goal: string;
  summary: string;
  architecture: string[];
  phases: ImplementationPhase[];
}

export interface SubProblem {
  id: string;
  description: string;
  questions: string[];
  resolved: boolean;
  order: number;
}

export interface ValidationQuestion {
  id: string;
  prompt: string;
  expectedKeywords: string[];
}

export type ResponseChunk =
  | { kind: "text"; value: string }
  | { kind: "code"; language: string; value: string }
  | { kind: "adr"; adr: ADR }
  | { kind: "question"; text: string; awaitsInput: true }
  | { kind: "checkpoint"; label: string; kind2: "comprehension" | "explain_it_back" }
  | { kind: "sub_problem"; subProblem: SubProblem };

export interface IO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  notify(level: "info" | "warn" | "error", message: string): void;
  stream(chunk: string): void; // for live streaming display
}
