// Open-source LLM baseline: asks a local Ollama model the SAME evidence questions Jev gets,
// and saves the answers in the same shape as Jev's results so the app can compare them.
//
//   1. Install Ollama (ollama.com), then:  ollama pull llama3.2:3b
//   2. npm run llm:run          (optional: OLLAMA_MODEL=qwen2.5:3b npm run llm:run)
//   3. git add promptql/llm-results.json && git commit -m "LLM baseline results" && git push
//
// The LLM's "confidence" is a number it writes in its answer, not a model probability.
// That difference is exactly what the comparison is meant to show.
import { readFileSync, writeFileSync } from "node:fs";

const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

type Question = { type: string; instructions: string };
const req = JSON.parse(readFileSync("promptql/requests.json", "utf8")) as {
  questions: Record<string, Question>;
  states: Record<string, { resume: string }>;
};

const reqKeys = Object.keys(req.questions).filter((k) => k.startsWith("req_"));
const requirementText = (k: string) => req.questions[k].instructions.match(/"([^"]+)"/)?.[1] ?? k;

type Answer = { p: number; ok: boolean; inTok: number; outTok: number };

async function ask(resume: string, requirement: string): Promise<Answer> {
  const body = {
    model: MODEL,
    stream: false,
    format: {
      type: "object",
      properties: { answer: { type: "string", enum: ["yes", "no"] }, confidence: { type: "number" } },
      required: ["answer", "confidence"],
    },
    options: { temperature: 0 },
    messages: [
      {
        role: "system",
        content:
          "You check resumes for evidence. Use only what the resume states. Reply with JSON: " +
          '{"answer": "yes" or "no", "confidence": 0-100}.',
      },
      {
        role: "user",
        content: `Requirement: ${requirement}\n\nResume:\n${resume}\n\nDoes the resume contain concrete evidence for this requirement?`,
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${OLLAMA}/api/chat`, {
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
      return { p: +(yes ? c : 1 - c).toFixed(2), ok: true, inTok, outTok };
    } catch {
      if (attempt === 1) return { p: 0.5, ok: false, inTok, outTok }; // unusable answer: count it, treat as unsure
    }
  }
  return { p: 0.5, ok: false, inTok: 0, outTok: 0 };
}

async function main() {
  try {
    await fetch(`${OLLAMA}/api/tags`);
  } catch {
    console.error(`Can't reach Ollama at ${OLLAMA}. Install it from ollama.com, then run: ollama pull ${MODEL}`);
    process.exit(1);
  }

  const out: Record<string, unknown> = {};
  let failures = 0;
  const t0 = Date.now();

  for (const [id, state] of Object.entries(req.states)) {
    const answers: Record<string, unknown> = {};
    let inTok = 0;
    let outTok = 0;
    const tc = Date.now();
    for (const k of reqKeys) {
      const a = await ask(state.resume, requirementText(k));
      answers[k] = { type: "noul", noul: a.p };
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
    out[id] = { model: `ollama/${MODEL}`, answers, usage: { input_tokens: inTok, output_tokens: outTok }, ms: Date.now() - tc };
    console.log(`${id}: ${ps.map((p) => Math.round(p * 100)).join(" ")}  (${Date.now() - tc} ms)`);
  }

  out._meta = {
    model: `ollama/${MODEL}`,
    total_ms: Date.now() - t0,
    calls: Object.keys(req.states).length * reqKeys.length,
    parse_failures: failures,
    cost_usd: 0,
    created_at: new Date().toISOString(),
  };
  writeFileSync("promptql/llm-results.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote promptql/llm-results.json in ${Math.round((Date.now() - t0) / 1000)}s, ${failures} unusable answers.`);
  console.log('Now: git add promptql/llm-results.json && git commit -m "LLM baseline results" && git push');
}

main();
