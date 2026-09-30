// Open-source LLM baseline from the command line (same logic as the app's "Run open-source LLM" button).
//
//   1. Install Ollama (ollama.com), then:  ollama pull qwen2.5:3b
//   2. npm run llm:run          (optional: OLLAMA_MODEL=<other model> npm run llm:run)
//   3. git add promptql/llm-results.json && git commit -m "LLM baseline results" && git push
import { readFileSync, writeFileSync } from "node:fs";
import { OLLAMA_MODEL, OLLAMA_URL, ollamaAvailable, runOllama } from "../lib/ollama";

const req = JSON.parse(readFileSync("promptql/requests.json", "utf8"));

async function main() {
  if (!(await ollamaAvailable())) {
    console.error(`Can't reach Ollama at ${OLLAMA_URL}. Install it from ollama.com, then run: ollama pull ${OLLAMA_MODEL}`);
    process.exit(1);
  }
  const out = await runOllama(req.questions, req.states, (id, ps, ms) =>
    console.log(`${id}: ${ps.map((p) => Math.round(p * 100)).join(" ")}  (${ms} ms)`),
  );
  writeFileSync("promptql/llm-results.json", JSON.stringify(out, null, 2) + "\n");
  const meta = out._meta as { total_ms: number; parse_failures: number };
  console.log(`\nWrote promptql/llm-results.json in ${Math.round(meta.total_ms / 1000)}s, ${meta.parse_failures} unusable answers.`);
  console.log('Now: git add promptql/llm-results.json && git commit -m "LLM baseline results" && git push');
}

main();
