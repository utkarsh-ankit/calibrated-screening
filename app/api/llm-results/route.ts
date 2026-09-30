import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const RAW = "https://raw.githubusercontent.com/utkarsh-ankit/calibrated-screening/main/promptql/llm-results.json";

/** Latest open-source LLM run: the local file first (updated by a live run), then GitHub. */
export async function GET() {
  try {
    const text = await readFile(path.join(process.cwd(), "promptql", "llm-results.json"), "utf8");
    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    /* fall through to GitHub */
  }
  try {
    const res = await fetch(RAW, { cache: "no-store" });
    if (res.ok) return new NextResponse(await res.text(), { headers: { "Content-Type": "application/json" } });
  } catch {
    /* ignore */
  }
  return NextResponse.json({ error: "No open-source LLM results yet. Click Run open-source LLM." }, { status: 404 });
}
