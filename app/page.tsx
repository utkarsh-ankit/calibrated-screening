"use client";

import { useState } from "react";
import { sampleCandidates, sampleJob } from "@/data/sample";
import type { Job, Route, ScreeningResult } from "@/lib/types";

const LANES: { route: Route; label: string }[] = [
  { route: "advance", label: "Advance" },
  { route: "human_review", label: "Human review" },
  { route: "reject", label: "Reject" },
];

type ApiResponse = {
  results: ScreeningResult[];
  errors: { candidateId: string; error: string }[];
  mock: boolean;
  totalMs: number;
};

export default function Home() {
  const [job, setJob] = useState<Job>(sampleJob);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setData(null);
    const res = await fetch("/api/screen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job, candidates: sampleCandidates }),
    });
    setData(await res.json());
    setLoading(false);
  }

  const updateReq = (i: number, patch: Partial<Job["requirements"][number]>) =>
    setJob((j) => ({ ...j, requirements: j.requirements.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));

  const tokens = data?.results.reduce((a, r) => a + r.inputTokens, 0) ?? 0;

  return (
    <main>
      <h1>Calibrated Screening</h1>
      <p className="muted">
        Screens candidates with Jev. Clear cases get decided; uncertain ones go to a human, with the reason shown.
      </p>

      <div className="panel">
        <h2>{job.title}</h2>
        <textarea rows={4} value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} />
        <h2 style={{ marginTop: 14 }}>Requirements</h2>
        {job.requirements.map((r, i) => (
          <div className="req" key={r.id}>
            <input type="text" value={r.text} onChange={(e) => updateReq(i, { text: e.target.value })} />
            <label className="row" style={{ gap: 4, whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={r.mustHave} onChange={(e) => updateReq(i, { mustHave: e.target.checked })} />
              must-have
            </label>
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={run} disabled={loading}>
            {loading ? "Screening…" : `Screen ${sampleCandidates.length} candidates`}
          </button>
          {data && (
            <div className="stats muted">
              <span>{data.mock ? "MOCK MODE" : data.results[0]?.model}</span>
              <span>{data.totalMs} ms total</span>
              <span>{tokens.toLocaleString()} input tokens</span>
              <span>≈ ${((tokens / 1e6) * 0.042).toFixed(5)}</span>
            </div>
          )}
        </div>
        {data?.errors.map((e) => (
          <p key={e.candidateId} className="missing">
            {e.candidateId}: {e.error}
          </p>
        ))}
      </div>

      {data && (
        <div className="lanes">
          {LANES.map(({ route, label }) => {
            const items = data.results.filter((r) => r.route === route);
            return (
              <div key={route} className={`panel lane ${route}`}>
                <h2>
                  {label} <span>{items.length}</span>
                </h2>
                {items.map((r) => (
                  <Card key={r.candidate.id} r={r} open={open === r.candidate.id} toggle={() => setOpen(open === r.candidate.id ? null : r.candidate.id)} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Card({ r, open, toggle }: { r: ScreeningResult; open: boolean; toggle: () => void }) {
  return (
    <div className="card" onClick={toggle}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{r.candidate.name}</strong>
        <span className="pill">fit {r.fit.score.toFixed(1)}/{r.fit.max}</span>
      </div>
      <div className="bar" style={{ margin: "6px 0" }}>
        <span style={{ width: `${r.decision.confidence * 100}%`, background: "var(--accent)" }} />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {r.decision.choice} · confidence {Math.round(r.decision.confidence * 100)}% · {r.latencyMs} ms
      </div>
      <ul style={{ fontSize: 13 }}>
        {r.reasons.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {open && (
        <div style={{ fontSize: 13, marginTop: 8 }}>
          {r.requirements.map((q) => (
            <div key={q.requirement.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                {q.requirement.mustHave ? "★ " : ""}
                {q.requirement.text}
              </span>
              <span className={q.band}>
                {q.band} ({Math.round(q.pMet * 100)}%)
              </span>
            </div>
          ))}
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }} className="muted">
            {r.candidate.resume}
          </pre>
        </div>
      )}
    </div>
  );
}
