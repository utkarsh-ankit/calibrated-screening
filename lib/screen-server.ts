// Server-only: calls Jev (or the mock) and interprets the result.
import { systemOne } from "./jev";
import { buildQuestions, buildState, interpret } from "./screening";
import type { Candidate, Job, ScreeningResult } from "./types";

export async function screenCandidate(job: Job, candidate: Candidate): Promise<ScreeningResult> {
  const t0 = Date.now();
  const res = await systemOne(buildState(job, candidate), buildQuestions(job));
  return interpret(job, candidate, res, Date.now() - t0);
}
