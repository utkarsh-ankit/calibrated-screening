import { systemOne } from "./jev";
import type {
  Candidate,
  ChoiceAnswer,
  Job,
  JevQuestion,
  NoulAnswer,
  RequirementResult,
  Route,
  ScoreAnswer,
  ScreeningResult,
} from "./types";

/** Thresholds for routing. Tune these on the day against labeled resumes. */
export const POLICY = {
  metAbove: 0.7, // P(met) >= this => "met"
  missingBelow: 0.3, // P(met) <= this => "missing"; in between => "unclear"
  minDecisionConfidence: 0.6, // below this, a human looks at it
};

const FIT_LEVELS = [
  "No meaningful overlap with the role",
  "Some adjacent experience, major gaps",
  "Meets about half of the core requirements",
  "Meets most requirements; minor gaps",
  "Strong match on essentially every requirement",
];

/** Build the question map for one candidate. One Jev call answers all of it in parallel. */
export function buildQuestions(job: Job): Record<string, JevQuestion> {
  const q: Record<string, JevQuestion> = {};
  for (const r of job.requirements) {
    q[`req_${r.id}`] = {
      type: "noul",
      instructions: `Does \`resume\` show concrete evidence that the candidate meets this requirement: "${r.text}"? Only count evidence stated in the resume, not assumptions.`,
    };
  }
  q.fit = {
    type: "score",
    instructions: "How well does `resume` match `job_description` overall?",
    criteria: FIT_LEVELS,
  };
  q.decision = {
    type: "choice",
    instructions: "Should the candidate in `resume` advance to a first interview for `job_title`?",
    criteria: {
      advance: "Clearly qualified; worth an interview",
      reject: "Clearly missing core requirements",
    },
  };
  return q;
}

export async function screenCandidate(job: Job, candidate: Candidate): Promise<ScreeningResult> {
  const t0 = Date.now();
  const res = await systemOne(
    { job_title: job.title, job_description: job.description, resume: candidate.resume },
    buildQuestions(job),
  );
  const latencyMs = Date.now() - t0;

  const requirements: RequirementResult[] = job.requirements.map((r) => {
    const pMet = (res.answers[`req_${r.id}`] as NoulAnswer).noul;
    const band = pMet >= POLICY.metAbove ? "met" : pMet <= POLICY.missingBelow ? "missing" : "unclear";
    return { requirement: r, pMet, band };
  });

  const fitA = res.answers.fit as ScoreAnswer;
  const decA = res.answers.decision as ChoiceAnswer;

  const { route, reasons } = routeCandidate(requirements, decA);

  return {
    candidate,
    requirements,
    fit: { score: fitA.score, max: FIT_LEVELS.length - 1, confidence: fitA.confidence, probabilities: fitA.probabilities },
    decision: { choice: decA.choice, confidence: decA.confidence, probabilities: decA.probabilities },
    route,
    reasons,
    latencyMs,
    inputTokens: res.usage.input_tokens,
    model: res.model,
  };
}

/**
 * The point of view: the model decides the clear cases, a human decides the uncertain ones.
 * Every routing reason is human-readable so it can be shown to the recruiter and the candidate.
 */
export function routeCandidate(reqs: RequirementResult[], dec: ChoiceAnswer): { route: Route; reasons: string[] } {
  const reasons: string[] = [];
  const unclearMust = reqs.filter((r) => r.requirement.mustHave && r.band === "unclear");
  const missingMust = reqs.filter((r) => r.requirement.mustHave && r.band === "missing");

  if (dec.confidence < POLICY.minDecisionConfidence) {
    reasons.push(`Model is unsure (confidence ${pct(dec.confidence)}).`);
  }
  for (const r of unclearMust) {
    reasons.push(`Resume is ambiguous on must-have: "${r.requirement.text}" (${pct(r.pMet)}).`);
  }
  if (reasons.length) return { route: "human_review", reasons };

  if (missingMust.length) {
    return {
      route: "reject",
      reasons: missingMust.map((r) => `No evidence for must-have: "${r.requirement.text}".`),
    };
  }
  if (dec.choice === "advance") {
    return { route: "advance", reasons: [`Meets all must-haves; model confident (${pct(dec.confidence)}).`] };
  }
  return { route: "reject", reasons: [`Model recommends reject with ${pct(dec.confidence)} confidence.`] };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
