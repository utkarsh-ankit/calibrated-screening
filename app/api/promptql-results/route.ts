import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const REPO_RAW = "https://raw.githubusercontent.com/utkarsh-ankit/calibrated-screening/main/promptql/results.json";

/**
 * Returns the PromptQL bot's saved Jev results.
 * Tries GitHub first (so the deployed app picks up new results without a redeploy),
 * then falls back to the local file (after `git pull`).
 */
export async function GET() {
  try {
    const res = await fetch(REPO_RAW, { cache: "no-store" });
    if (res.ok) return new NextResponse(await res.text(), { headers: { "x-source": "github" } });
  } catch {
    // offline or GitHub unreachable: fall through to local file
  }
  try {
    const text = await readFile(path.join(process.cwd(), "promptql", "results.json"), "utf8");
    return new NextResponse(text, { headers: { "x-source": "local" } });
  } catch {
    return NextResponse.json(
      { error: "No promptql/results.json yet. Ask the PromptQL bot to run promptql/requests.json first." },
      { status: 404 },
    );
  }
}
