import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/jev";
import { screenCandidate } from "@/lib/screen-server";
import type { Candidate, Job } from "@/lib/types";

export async function POST(req: Request) {
  const { job, candidates, ats } = (await req.json()) as { job: Job; candidates: Candidate[]; ats?: boolean };
  if (!job?.requirements?.length || !candidates?.length) {
    return NextResponse.json({ error: "Need a job with requirements and at least one candidate." }, { status: 400 });
  }

  const t0 = Date.now();
  // One Jev call per candidate, all in parallel.
  const settled = await Promise.allSettled(candidates.map((c) => screenCandidate(job, c, ats)));
  const results = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const errors = settled.flatMap((s, i) =>
    s.status === "rejected" ? [`${candidates[i].name}: ${String(s.reason)}`] : [],
  );

  return NextResponse.json({
    results,
    errors,
    source: ats || isMockMode() ? "mock" : "live",
    totalMs: Date.now() - t0,
  });
}
