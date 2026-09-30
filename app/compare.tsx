"use client";

// Side-by-side: the same evidence questions answered three ways.
//   ATS keywords  - word matching, no AI (runs live)
//   Open-source LLM - local Ollama model; its "confidence" is a number it writes (saved run)
//   Jev           - typed decision model; returns a probability (saved run via PromptQL)
import { Fragment, useEffect, useMemo, useState } from "react";
import { sampleCandidates } from "@/data/sample";
import { parsePromptQLResults } from "@/lib/promptql";
import type { Job, Lane, ScreeningResult } from "@/lib/types";

const JEV_PRICE_PER_TOKEN = 0.042 / 1e6;

const LANE_LABEL: Record<Lane, string> = { strong: "🟢 Strong", closer_look: "🟡 Closer look", gaps: "🔴 Gaps" };

type Method = {
  key: "ats" | "llm" | "jev";
  name: string;
  what: string;
  byId: Map<string, ScreeningResult> | null;
  time: string;
  cost: string;
  unusable: string;
  tokens: string;
  note?: string;
};

type LlmMeta = { model: string; total_ms: number; calls: number; parse_failures: number; created_at: string };

function sumTokens(text: string | null): { input: number; output: number } | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Record<string, { usage?: { input_tokens?: number; output_tokens?: number } }>;
    let input = 0;
    let output = 0;
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_") || !v?.usage) continue;
      input += v.usage.input_tokens ?? 0;
      output += v.usage.output_tokens ?? 0;
    }
    return { input, output };
  } catch {
    return null;
  }
}

const fmtTokens = (t: { input: number; output: number } | null) =>
  t ? `${t.input.toLocaleString()} input · ${t.output.toLocaleString()} output` : "—";

export default function Compare({ job }: { job: Job }) {
  const [atsRaw, setAtsRaw] = useState<{ results: ScreeningResult[]; totalMs: number } | null>(null);
  const [llmText, setLlmText] = useState<string | null>(null);
  const [jevText, setJevText] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // ATS runs live and re-runs when the requirements / must-haves change.
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, candidates: sampleCandidates, ats: true }),
      });
      if (res.ok) setAtsRaw(await res.json());
    }, 200);
    return () => clearTimeout(t);
  }, [job]);

  // LLM and Jev: saved runs.
  useEffect(() => {
    fetch("/api/llm-results", { cache: "no-store" }).then(async (r) => r.ok && setLlmText(await r.text()));
    fetch("/api/promptql-results", { cache: "no-store" }).then(async (r) => r.ok && setJevText(await r.text()));
  }, []);

  const methods = useMemo<Method[]>(() => {
    const toMap = (rs: ScreeningResult[]) => new Map(rs.map((r) => [r.candidate.id, r]));

    const llm = llmText ? parsePromptQLResults(llmText, job, sampleCandidates).results : null;
    let meta: LlmMeta | null = null;
    try {
      meta = llmText ? JSON.parse(llmText)._meta : null;
    } catch {
      /* ignore */
    }

    const jev = jevText ? parsePromptQLResults(jevText, job, sampleCandidates).results : null;
    const jevTokens = jev?.reduce((a, r) => a + r.inputTokens, 0) ?? 0;

    return [
      {
        key: "ats",
        name: "ATS keywords",
        what: "Word matching. No AI.",
        byId: atsRaw ? toMap(atsRaw.results) : null,
        time: atsRaw ? `${atsRaw.totalMs} ms` : "…",
        cost: "$0",
        unusable: "0",
        tokens: "0 (no model)",
      },
      {
        key: "llm",
        name: meta ? `Open-source LLM (${meta.model.replace("ollama/", "")})` : "Open-source LLM",
        what: "Writes yes/no + a confidence number as text.",
        byId: llm ? toMap(llm) : null,
        time: meta ? `${(meta.total_ms / 1000).toFixed(1)} s (${meta.calls} calls, laptop)` : "—",
        cost: "$0 (local)",
        unusable: meta ? `${meta.parse_failures} of ${meta.calls}` : "—",
        tokens: fmtTokens(sumTokens(llmText)),
        note: llm ? undefined : "Not run yet: npm run llm:run",
      },
      {
        key: "jev",
        name: "Jev (via PromptQL)",
        what: "Returns a probability per question. Typed, no text to parse.",
        byId: jev ? toMap(jev) : null,
        time: jev ? `${jev.length} calls (1 per resume), ~100 ms each per TypeSafe` : "—",
        cost: jev ? `$${(jevTokens * JEV_PRICE_PER_TOKEN).toFixed(5)}` : "—",
        unusable: jev ? "0 (typed output)" : "—",
        tokens: fmtTokens(sumTokens(jevText)),
      },
    ];
  }, [atsRaw, llmText, jevText, job]);

  const pct = (r: ScreeningResult | undefined, reqId: string) => {
    const q = r?.requirements.find((x) => x.requirement.id === reqId);
    return q ? Math.round(q.pEvidence * 100) : null;
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div className="lanes">
        {methods.map((m) => (
          <div key={m.key} className="panel">
            <h2 style={{ marginBottom: 4 }}>{m.name}</h2>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
              {m.what}
            </p>
            <div style={{ fontSize: 13 }}>
              <div>Time: {m.time}</div>
              <div>Cost: {m.cost}</div>
              <div>Tokens: {m.tokens}</div>
              <div>Unusable answers: {m.unusable}</div>
              {m.note && <div className="unclear">{m.note}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 12, overflowX: "auto" }}>
        <h2>Where each method puts each candidate</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Same resumes, same questions, same must-haves. Click a row for the per-requirement numbers.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr className="muted" style={{ textAlign: "left" }}>
              <th style={{ padding: 6 }}>Candidate</th>
              {methods.map((m) => (
                <th key={m.key} style={{ padding: 6 }}>
                  {m.name.split(" (")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleCandidates.map((c) => {
              const lanes = methods.map((m) => m.byId?.get(c.id)?.lane);
              const known = lanes.filter(Boolean);
              const disagree = new Set(known).size > 1;
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    style={{ cursor: "pointer", borderTop: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: 6 }}>
                      <strong>{c.name}</strong>
                      {disagree && (
                        <span className="pill" style={{ marginLeft: 8 }}>
                          methods disagree
                        </span>
                      )}
                    </td>
                    {lanes.map((l, i) => (
                      <td key={i} style={{ padding: 6 }}>
                        {l ? LANE_LABEL[l] : <span className="muted">—</span>}
                      </td>
                    ))}
                  </tr>
                  {openId === c.id && (
                    <tr>
                      <td colSpan={4} style={{ padding: "4px 6px 12px" }}>
                        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                          <thead>
                            <tr className="muted" style={{ textAlign: "left" }}>
                              <th style={{ padding: 4 }}>Requirement (P evidence)</th>
                              {methods.map((m) => (
                                <th key={m.key} style={{ padding: 4 }}>
                                  {m.name.split(" (")[0]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {job.requirements.map((r) => (
                              <tr key={r.id}>
                                <td style={{ padding: 4 }}>
                                  {r.mustHave ? "★ " : ""}
                                  {r.text}
                                </td>
                                {methods.map((m) => {
                                  const v = pct(m.byId?.get(c.id), r.id);
                                  const cls = v === null ? "muted" : v >= 70 ? "evidenced" : v <= 30 ? "not_found" : "unclear";
                                  return (
                                    <td key={m.key} style={{ padding: 4 }} className={cls}>
                                      {v === null ? "—" : `${v}%`}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }} className="muted">
                          {c.resume}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
