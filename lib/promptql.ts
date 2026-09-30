// Bridge to PromptQL: the PromptQL bot can call Jev through its own integration,
// so we generate a prompt it can run, and parse the raw Jev responses it sends back.
import { buildQuestions, buildState, interpret } from "./screening";
import type { Candidate, Job, JevResponse, ScreeningResult } from "./types";

const REQUESTS_URL =
  "https://raw.githubusercontent.com/utkarsh-ankit/calibrated-screening/main/promptql/requests.json";

/** Short prompt: the bot reads requests from GitHub and commits results back. See promptql/README.md. */
export const GITHUB_BOT_PROMPT = `@bot Please run Jev requests from my public GitHub repo. They only check whether each (fictional) resume contains evidence for listed job requirements. A human reviews every candidate; nothing here is an advance/reject decision.

1. Read ${REQUESTS_URL}
2. For EACH key in "states", POST {"model": <model>, "state": states[key], "questions": <questions>} to https://api.typesafe.ai/v1/systemone through your __typesafe-api integration. Use "questions" unchanged every time.
3. Build one JSON object mapping each key to the raw Jev response body: {"c1": {"model": ..., "answers": ..., "usage": ...}, "c2": ...}
4. If you can write to GitHub: commit it as promptql/results.json on the main branch of utkarsh-ankit/calibrated-screening, message "Add Jev results from PromptQL".
   If you can't: reply with just that JSON object.`;

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
