import type { JevAnswer, JevQuestion, JevResponse } from "./types";

const BASE_URL = process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai";
const MODEL = process.env.JEV_MODEL ?? "jev-1.13.0";

export const isMockMode = () => !process.env.TYPESAFE_API_KEY;

/** One Jev call: state in, typed answers out. Server-side only (uses the API key). */
export async function systemOne(
  state: Record<string, unknown>,
  questions: Record<string, JevQuestion>,
): Promise<JevResponse> {
  if (isMockMode()) return mockSystemOne(state, questions);

  const res = await fetch(`${BASE_URL}/v1/systemone`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, state, questions }),
  });
  if (!res.ok) {
    throw new Error(`Jev request failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as JevResponse;
}

// ---------------------------------------------------------------------------
// MOCK MODE: deterministic fake answers so the UI works before you have a key.
// Uses crude keyword overlap between the question and the resume.
// ---------------------------------------------------------------------------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function overlap(question: string, text: string) {
  question = question.match(/"([^"]+)"/)?.[1] ?? question; // score only the quoted requirement
  const words = question
    .toLowerCase()
    .match(/[a-z0-9+#.]{3,}/g)
    ?.filter((w) => !["does", "the", "and", "with", "candidate", "resume", "have", "for"].includes(w)) ?? [];
  if (!words.length) return 0.5;
  const t = text.toLowerCase();
  return words.filter((w) => t.includes(w.slice(0, 4))).length / words.length; // crude stem match
}

/** Keyword baseline (ATS-style word matching). No AI. Also used as the mock when no Jev key is set. */
export async function mockSystemOne(
  state: Record<string, unknown>,
  questions: Record<string, JevQuestion>,
): Promise<JevResponse> {
  const text = typeof state.resume === "string" ? state.resume : JSON.stringify(state);
  const answers: Record<string, JevAnswer> = {};
  let avg = 0;
  const entries = Object.entries(questions);

  for (const [key, q] of entries) {
    if (q.type === "noul") {
      const p = Math.min(0.97, Math.max(0.03, overlap(q.instructions, text) * 1.8 - 0.1 + hash(key + text) * 0.1));
      answers[key] = { type: "noul", noul: +p.toFixed(2) };
      avg += p;
    }
  }
  avg = avg / Math.max(1, entries.filter(([, q]) => q.type === "noul").length);

  for (const [key, q] of entries) {
    if (q.type === "score") {
      const n = q.criteria.length;
      const center = avg * (n - 1);
      const raw = q.criteria.map((_, i) => Math.exp(-((i - center) ** 2)));
      const z = raw.reduce((a, b) => a + b, 0);
      const probs = Object.fromEntries(raw.map((r, i) => [String(i), +(r / z).toFixed(2)]));
      answers[key] = {
        type: "score",
        score: +center.toFixed(2),
        legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])),
        probabilities: probs,
        confidence: +Math.max(...Object.values(probs)).toFixed(2),
      };
    } else if (q.type === "choice") {
      const opts = Object.keys(q.criteria);
      const pFirst = avg; // assumes first option is the "positive" one
      const probs: Record<string, number> = { [opts[0]]: +pFirst.toFixed(2) };
      opts.slice(1).forEach((o) => (probs[o] = +((1 - pFirst) / (opts.length - 1)).toFixed(2)));
      const choice = opts.reduce((a, b) => (probs[a] >= probs[b] ? a : b));
      answers[key] = { type: "choice", choice, probabilities: probs, confidence: +Math.abs(2 * pFirst - 1).toFixed(2) };
    }
  }

  return { model: "mock-jev", answers, usage: { input_tokens: Math.round(text.length / 4), output_tokens: 0 } };
}
