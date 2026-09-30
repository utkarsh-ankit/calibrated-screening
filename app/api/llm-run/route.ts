import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { OLLAMA_MODEL, ollamaAvailable, runOllama } from "@/lib/ollama";
import { buildQuestions, buildState } from "@/lib/screening";
import type { Candidate, Job } from "@/lib/types";

// A full run makes one call per requirement per resume, so it can take a minute or two.
export const maxDuration = 300;

/** Run the open-source LLM baseline live against a local Ollama server. */
export async function POST(req: Request) {
  if (!(await ollamaAvailable())) {
    return NextResponse.json(
      {
        error: `The open-source LLM runs on your own machine. Install Ollama (ollama.com), run "ollama pull ${OLLAMA_MODEL}", and use the app on localhost.`,
      },
      { status: 503 },
    );
  }

  const { job, candidates } = (await req.json()) as { job: Job; candidates: Candidate[] };
  const states = Object.fromEntries(candidates.map((c) => [c.id, buildState(job, c)]));
  const out = await runOllama(buildQuestions(job), states);

  // Keep the latest run on disk so the Compare view uses it too (read-only file systems just skip this).
  try {
    await writeFile(path.join(process.cwd(), "promptql", "llm-results.json"), JSON.stringify(out, null, 2) + "\n");
  } catch {
    /* ignore */
  }

  return NextResponse.json(out);
}
