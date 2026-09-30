import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const REPO = "utkarsh-ankit/calibrated-screening";

const REQUESTS_URL = `https://raw.githubusercontent.com/${REPO}/main/promptql/requests.json`;

// Everything goes in the `prompt` query param. We send NO body: PromptQL stores a webhook body as a
// thread artifact named "hook_payload", and a second run in the same thread fails on that name.
function botPrompt(runId: string) {
  return [
    `Run ${runId}. These are evidence checks on fictional resumes; a human reviews every candidate; no hiring recommendations.`,
    `1. Read ${REQUESTS_URL}.`,
    `2. For EACH key in "states", POST {"model": <model>, "state": states[key], "questions": <questions>} to https://api.typesafe.ai/v1/systemone via the Jev/TypeSafe integration.`,
    `3. Build one JSON object mapping each key to the raw Jev response body, plus "_run_id": "${runId}".`,
    `4. Commit it as promptql/results.json on the main branch of ${REPO} with message "Jev results ${runId}".`,
    `If you cannot commit, say why in the thread.`,
  ].join(" ");
}

/** Server-side only: the PromptQL token never reaches the browser. */
export async function POST() {
  const { PROMPTQL_WEBHOOK_URL, PROMPTQL_PAT } = process.env;
  if (!PROMPTQL_WEBHOOK_URL || !PROMPTQL_PAT) {
    return NextResponse.json(
      { error: "Set PROMPTQL_WEBHOOK_URL and PROMPTQL_PAT in .env.local, then restart npm run dev." },
      { status: 500 },
    );
  }

  const runId = randomUUID().slice(0, 8);

  const url = new URL(PROMPTQL_WEBHOOK_URL);
  if (url.protocol !== "https:") {
    return NextResponse.json({ error: "PROMPTQL_WEBHOOK_URL must use https." }, { status: 500 });
  }
  url.searchParams.set("prompt", botPrompt(runId));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `pat ${PROMPTQL_PAT}` },
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Webhook returned HTTP ${res.status}. Check the URL, token and scope. ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ runId, ack: text.slice(0, 300) });
  } catch (e) {
    // Don't auto-retry: the message may have been delivered. Check the bot thread first.
    return NextResponse.json(
      { error: `Webhook call failed (${(e as Error).message}). Check the bot thread before retrying.` },
      { status: 502 },
    );
  }
}
