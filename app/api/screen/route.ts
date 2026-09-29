import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/jev";
import { screenCandidate } from "@/lib/screening";
import type { Candidate, Job } from "@/lib/types";

export async function POST(req: Request) {
  const { job, candidates } = (await req.json()) as { job: Job; candidates: Candidate[] };
  if (!job?.requirements?.length || !candidates?.length) {
    return NextResponse.json({ error: "Need a job with requirements and at least one candidate." }, { status: 400 });
  }

  const t0 = Date.now();
  // One Jev call per candidate, all in parallel.
  const settled = await Promise.allSettled(candidates.map((c) => screenCandidate(job, c)));
  const results = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const errors = settled.flatMap((s, i) =>
    s.status === "rejected" ? [{ candidateId: candidates[i].id, error: String(s.reason) }] : [],
  );

  return NextResponse.json({ results, errors, mock: isMockMode(), totalMs: Date.now() - t0 });
}
