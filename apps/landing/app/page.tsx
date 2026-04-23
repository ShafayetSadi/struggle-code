import { ArrowRight, GraduationCap, ScrollText, Sparkles } from "lucide-react";

import { CopyCommand } from "../components/copy-command";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const sections = [
  {
    icon: ScrollText,
    title: "Manifesto",
    body: "TODO: Explain why Struggle AI values guided comprehension over instant code generation.",
  },
  {
    icon: GraduationCap,
    title: "How It Works",
    body: "TODO: Describe the three-beat learning loop that turns requests into understanding checkpoints.",
  },
  {
    icon: Sparkles,
    title: "Three Modes",
    body: "TODO: Outline Full Socratic, Guided, and Standard modes with the right product copy.",
  },
];

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 md:px-10">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-sky-950/30 backdrop-blur md:p-12">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              Hackathon scaffold
            </div>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Struggle AI</p>
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white md:text-6xl">Struggle AI</h1>
              <p className="max-w-2xl text-lg text-slate-300">[tagline to be written by Dev D]</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled variant="outline">
                Watch demo
              </Button>
              <Button className="gap-2">
                View architecture
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="border-white/10 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Install the CLI</CardTitle>
              <CardDescription>Use the placeholder global install command while the packages mature.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-sky-100">
                npm install -g @struggle-ai/cli
              </div>
              <CopyCommand command="npm install -g @struggle-ai/cli" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* TODO: Replace placeholder landing-page sections with final copy and visuals. */}
      <div className="grid gap-6 md:grid-cols-3">
        {sections.map(({ icon: Icon, title, body }) => (
          <section key={title}>
            <Card className="h-full border-white/10 bg-[var(--card)]">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-300">{body}</p>
              </CardContent>
            </Card>
          </section>
        ))}
      </div>

      <footer className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <p>Struggle AI</p>
        <p>TODO: Add team credits and final launch links.</p>
      </footer>
    </main>
  );
}
