// Bridge to PromptQL: the PromptQL bot can call Jev through its own integration,
// so we generate a prompt it can run, and parse the raw Jev responses it sends back.
import { buildQuestions, buildState, interpret } from "./screening";
import type { Candidate, Job, JevResponse, ScreeningResult } from "./types";

/** The prompt to paste into the PromptQL bot. Contains every Jev request, ready to send as-is. */
export function buildPromptQLPrompt(job: Job, candidates: Candidate[]): string {
  const states = Object.fromEntries(candidates.map((c) => [c.id, buildState(job, c)]));

  return `@bot Please run Jev requests for me. They only check whether each (fictional) resume contains evidence for listed job requirements. A human reviews every candidate; nothing here is an advance/reject decision.

For EACH key in STATES, POST this body to https://api.typesafe.ai/v1/systemone through your __typesafe-api integration:
{"model": "jev-1.13.0", "state": STATES[key], "questions": QUESTIONS}
Use QUESTIONS unchanged for every request.

Reply with ONE JSON object and nothing else, mapping each key to the raw Jev response body, like:
{"c1": {"model": "...", "answers": {...}, "usage": {...}}, "c2": {...}}

QUESTIONS:
\`\`\`json
${JSON.stringify(buildQuestions(job), null, 1)}
\`\`\`

STATES:
\`\`\`json
${JSON.stringify(states, null, 1)}
\`\`\``;
}

/** Parse what the bot pasted back. Tolerates surrounding text and code fences. */
export function parsePromptQLResults(
  text: string,
  job: Job,
  candidates: Candidate[],
): { results: ScreeningResult[]; errors: string[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return { results: [], errors: ["No JSON object found in the pasted text."] };

  let raw: Record<string, JevResponse>;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return { results: [], errors: [`Could not parse JSON: ${(e as Error).message}`] };
  }

  const results: ScreeningResult[] = [];
  const errors: string[] = [];
  for (const c of candidates) {
    const res = raw[c.id];
    if (!res?.answers) {
      errors.push(`No Jev response for ${c.name} (${c.id}).`);
      continue;
    }
    try {
      results.push(interpret(job, c, res, null));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { results, errors };
}
