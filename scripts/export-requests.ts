// Writes promptql/requests.json: every Jev request for the sample job + resumes.
// The PromptQL bot reads this file from GitHub, runs it, and saves promptql/results.json.
// Run after changing data/sample.ts:  npm run promptql:export
import { writeFileSync } from "node:fs";
import { sampleCandidates, sampleJob } from "../data/sample";
import { buildQuestions, buildState } from "../lib/screening";

const out = {
  endpoint: "https://api.typesafe.ai/v1/systemone",
  model: "jev-1.13.0",
  note: "For each key in states, POST {model, state: states[key], questions}. Save the raw responses to promptql/results.json keyed the same way.",
  questions: buildQuestions(sampleJob),
  states: Object.fromEntries(sampleCandidates.map((c) => [c.id, buildState(sampleJob, c)])),
};

writeFileSync("promptql/requests.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote promptql/requests.json (${sampleCandidates.length} candidates)`);
