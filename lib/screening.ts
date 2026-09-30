// Pure logic: no network, no env vars. Used by the server (live/mock) AND the browser (PromptQL import).
import type {
  Candidate,
  Job,
  JevQuestion,
  JevResponse,
  Lane,
  NoulAnswer,
  RequirementResult,
  ScoreAnswer,
  ScreeningResult,
} from "./types";

/**
 * Thresholds on Jev's P(evidence). Tune these on the day against the sample resumes.
 *   >= evidencedAbove  -> "evidenced"
 *   <= notFoundBelow   -> "not_found"
 *   in between         -> "unclear"  (the model isn't sure: a human should look)
 */
export const POLICY = { evidencedAbove: 0.7, notFoundBelow: 0.3 };

const COVERAGE_LEVELS = [
  "The resume shows evidence for none of the listed requirements",
  "Evidence for a few requirements",
  "Evidence for about half of the requirements",
  "Evidence for most requirements",
  "Evidence for essentially every requirement",
];

/**
 * Questions Jev answers for ONE candidate, all in one call.
 * Every question asks about evidence in the text, never "should we hire".
 */
export function buildQuestions(job: Job): Record<string, JevQuestion> {
  const q: Record<string, JevQuestion> = {};
  for (const r of job.requirements) {
    q[`req_${r.id}`] = {
      type: "noul",
      instructions: `Does \`resume\` contain concrete evidence for this requirement: "${r.text}"? Only count what is stated in the resume.`,
    };
  }
  q.coverage = {
    type: "score",
    instructions: "How many of the requirements in `requirements` are evidenced in `resume`?",
    criteria: COVERAGE_LEVELS,
  };
  return q;
}

/** The `state` Jev sees for one candidate. */
export function buildState(job: Job, candidate: Candidate) {
  return {
    job_title: job.title,
    requirements: job.requirements.map((r) => r.text).join("\n"),
    resume: candidate.resume,
  };
}

/** Turn a raw Jev response into a review-queue entry. */
export function interpret(
  job: Job,
  candidate: Candidate,
  res: JevResponse,
  latencyMs: number | null,
): ScreeningResult {
  const requirements: RequirementResult[] = job.requirements.map((r) => {
    const a = res.answers[`req_${r.id}`] as NoulAnswer | undefined;
    if (!a) throw new Error(`Missing answer "req_${r.id}" for ${candidate.name}`);
    const p = a.noul;
    const band = p >= POLICY.evidencedAbove ? "evidenced" : p <= POLICY.notFoundBelow ? "not_found" : "unclear";
    return { requirement: r, pEvidence: p, band };
  });

  const cov = res.answers.coverage as ScoreAnswer | undefined;
  const { lane, reasons } = assignLane(requirements);

  return {
    candidate,
    requirements,
    coverage: {
      score: cov?.score ?? 0,
      max: COVERAGE_LEVELS.length - 1,
      confidence: cov?.confidence ?? 0,
    },
    lane,
    reasons,
    latencyMs,
    inputTokens: res.usage?.input_tokens ?? 0,
    model: res.model,
  };
}

/**
 * Where should a reviewer look first?
 *   1. Any must-have with NO evidence found     -> gaps         (a human confirms; nobody is auto-rejected)
 *   2. Else, any must-have the model is UNSURE -> closer_look  (uncertainty is surfaced, not hidden)
 *   3. Every must-have evidenced                -> strong
 */
export function assignLane(reqs: RequirementResult[]): { lane: Lane; reasons: string[] } {
  const must = reqs.filter((r) => r.requirement.mustHave);
  const unclear = must.filter((r) => r.band === "unclear");
  const notFound = must.filter((r) => r.band === "not_found");

  const unclearReasons = unclear.map((r) => `Unclear evidence for must-have "${r.requirement.text}" (${pct(r.pEvidence)}).`);

  // A clear gap outweighs uncertainty elsewhere: send to "gaps" first.
  if (notFound.length) {
    return {
      lane: "gaps",
      reasons: [
        ...notFound.map((r) => `No evidence found for must-have "${r.requirement.text}" (${pct(r.pEvidence)}).`),
        ...unclearReasons,
      ],
    };
  }
  // Nothing clearly missing, but the model is unsure about something: a human should look.
  if (unclear.length) {
    return { lane: "closer_look", reasons: unclearReasons };
  }
  return { lane: "strong", reasons: [`Evidence found for all ${must.length} must-haves.`] };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
