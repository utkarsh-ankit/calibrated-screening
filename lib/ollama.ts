// Open-source LLM baseline via a local Ollama server. Shared by scripts/run-ollama.ts and /api/llm-run.
// It gets the SAME evidence questions Jev gets and returns answers in the same shape as a Jev response.
// The LLM's "confidence" is a number it writes in its answer, not a model probability.

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

type Question = { type: string; instructions: string };
type Answer = { p: number; ok: boolean; inTok: number; outTok: number; evidence: string };

const requirementText = (q: Question, key: string) => q.instructions.match(/"([^"]+)"/)?.[1] ?? key;

async function ask(resume: string, requirement: string): Promise<Answer> {
  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    format: {
      type: "object",
      // Evidence comes FIRST: small models answer far more accurately when they must quote the resume before deciding.
      properties: {
        evidence: { type: "string" },
        answer: { type: "string", enum: ["yes", "no"] },
        confidence: { type: "number" },
      },
      required: ["evidence", "answer", "confidence"],
    },
    options: { temperature: 0 },
    messages: [
      {
        role: "system",
        content:
          "You check resumes for evidence of a job requirement. Use only what the resume states. " +
          'Step 1: in "evidence", copy the resume line that best shows the requirement is met, or "" if there is none. ' +
          "Different wording for the same skill counts, and a framework implies its language. " +
          'Step 2: "answer" is "yes" if that evidence shows the requirement is met, otherwise "no". ' +
          'Step 3: "confidence" is how sure you are of your answer, 0-100. ' +
          'Reply with JSON: {"evidence": "...", "answer": "yes" or "no", "confidence": 0-100}.',
      },
      {
        role: "user",
        content: `Resume:\n${resume}\n\nRequirement: ${requirement}\n\nDoes the resume contain concrete evidence for this requirement?`,
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const inTok = data.prompt_eval_count ?? 0;
    const outTok = data.eval_count ?? 0;
    try {
      const parsed = JSON.parse(data.message.content);
      const yes = String(parsed.answer).toLowerCase().startsWith("y");
      const conf = Math.min(100, Math.max(0, Number(parsed.confidence)));
      if (Number.isNaN(conf)) throw new Error("confidence not a number");
      const c = conf > 1 ? conf / 100 : conf; // accept 0-1 or 0-100
      return { p: +(yes ? c : 1 - c).toFixed(2), ok: true, inTok, outTok, evidence: String(parsed.evidence ?? "") };
    } catch {
      if (attempt === 1) return { p: 0.5, ok: false, inTok, outTok, evidence: "" }; // unusable answer: counted, treated as unsure
    }
  }
  return { p: 0.5, ok: false, inTok: 0, outTok: 0, evidence: "" };
}

/** True if a local Ollama server answers. */
export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Run every requirement question for every resume. Returns a Jev-shaped results object plus _meta. */
export async function runOllama(
  questions: Record<string, Question>,
  states: Record<string, { resume: string }>,
  onCandidate?: (id: string, ps: number[], ms: number) => void,
): Promise<Record<string, unknown>> {
  const reqKeys = Object.keys(questions).filter((k) => k.startsWith("req_"));
  const out: Record<string, unknown> = {};
  let failures = 0;
  const t0 = Date.now();

  for (const [id, state] of Object.entries(states)) {
    const answers: Record<string, unknown> = {};
    let inTok = 0;
    let outTok = 0;
    const tc = Date.now();
    for (const k of reqKeys) {
      const a = await ask(state.resume, requirementText(questions[k], k));
      answers[k] = { type: "noul", noul: a.p, evidence: a.evidence };
      inTok += a.inTok;
      outTok += a.outTok;
      if (!a.ok) failures++;
    }
    const ps = reqKeys.map((k) => (answers[k] as { noul: number }).noul);
    answers.coverage = {
      type: "score",
      score: +((ps.reduce((s, x) => s + x, 0) / ps.length) * 4).toFixed(2), // derived: mean evidence × 4
      legend: {},
      probabilities: {},
      confidence: 0,
    };
    out[id] = { model: `ollama/${OLLAMA_MODEL}`, answers, usage: { input_tokens: inTok, output_tokens: outTok }, ms: Date.now() - tc };
    onCandidate?.(id, ps, Date.now() - tc);
  }

  out._meta = {
    model: `ollama/${OLLAMA_MODEL}`,
    total_ms: Date.now() - t0,
    calls: Object.keys(states).length * reqKeys.length,
    parse_failures: failures,
    cost_usd: 0,
    created_at: new Date().toISOString(),
  };
  return out;
}
