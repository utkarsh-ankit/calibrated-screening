import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Saved open-source LLM baseline (written by `npm run llm:run` on a laptop with Ollama, then pushed).
const RAW = "https://raw.githubusercontent.com/utkarsh-ankit/calibrated-screening/main/promptql/llm-results.json";

export async function GET() {
  try {
    const res = await fetch(RAW, { cache: "no-store" });
    if (res.ok) return new NextResponse(await res.text(), { headers: { "Content-Type": "application/json" } });
  } catch {
    /* fall through to the bundled file */
  }
  try {
    const text = await readFile(path.join(process.cwd(), "promptql", "llm-results.json"), "utf8");
    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "No LLM baseline yet. Run `npm run llm:run` with Ollama, then push." }, { status: 404 });
  }
}
