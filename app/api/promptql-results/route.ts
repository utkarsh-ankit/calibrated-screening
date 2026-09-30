import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// raw.githubusercontent.com: no rate limit but cached for a few minutes (fine for the page's initial load).
const RAW = "https://raw.githubusercontent.com/utkarsh-ankit/calibrated-screening/main/promptql/results.json";
// GitHub contents API: fresh, but 60 requests/hour without a token. Used while waiting for a specific run.
const API = "https://api.github.com/repos/utkarsh-ankit/calibrated-screening/contents/promptql/results.json?ref=main";

async function fromGitHub(): Promise<string | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json" };
    // Optional: unauthenticated GitHub API allows 60 requests/hour; a token raises that.
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(API, { headers, cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function fromRaw(): Promise<string | null> {
  try {
    const res = await fetch(RAW, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function fromLocal(): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), "promptql", "results.json"), "utf8");
  } catch {
    return null;
  }
}

/**
 * GET /api/promptql-results            -> latest results (GitHub, then local file)
 * GET /api/promptql-results?run_id=abc -> 200 only once results tagged with that run exist; 202 = not yet
 */
export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("run_id");
  const text = runId ? await fromGitHub() : ((await fromRaw()) ?? (await fromGitHub()) ?? (await fromLocal()));

  if (!text) {
    return NextResponse.json(
      { error: runId ? "Waiting for the bot…" : "No promptql/results.json yet. Run the bot first." },
      { status: runId ? 202 : 404 },
    );
  }
  if (runId) {
    let tagged: string | undefined;
    try {
      tagged = JSON.parse(text)._run_id;
    } catch {
      /* not valid JSON yet */
    }
    if (tagged !== runId) return NextResponse.json({ error: "Waiting for the bot…" }, { status: 202 });
  }
  return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
}
