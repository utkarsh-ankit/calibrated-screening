"use client";

import { useEffect, useState } from "react";
import { sampleCandidates, sampleJob } from "@/data/sample";
import Compare from "./compare";
import { parsePromptQLResults } from "@/lib/promptql";
import type { Job, Lane, ScreeningResult, Source } from "@/lib/types";

const LANES: { lane: Lane; label: string; hint: string }[] = [
  { lane: "strong", label: "Strong evidence", hint: "Every must-have is backed by the resume" },
  { lane: "closer_look", label: "Needs a closer look", hint: "The model is unsure about a must-have" },
  { lane: "gaps", label: "Evidence gaps", hint: "No evidence found for a must-have — confirm before deciding" },
];

type Run = { results: ScreeningResult[]; errors: string[]; source: Source; totalMs: number | null };

export default function Home() {
  const [job, setJob] = useState<Job>(sampleJob);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<"compare" | "app" | "llm" | "promptql">("compare");
  const [status, setStatus] = useState("");

  // On open, show the latest real Jev results the PromptQL bot saved to GitHub.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/promptql-results", { cache: "no-store" });
        if (!res.ok) return;
        const { results, errors } = parsePromptQLResults(await res.text(), sampleJob, sampleCandidates);
        if (results.length) {
          setRun({ results, errors, source: "promptql", totalMs: null });
        }
      } catch {
        /* no saved results yet: page still works */
      }
    })();
  }, []);

  async function runInApp() {
    setLoading(true);
    setRun(null);
    const res = await fetch("/api/screen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job, candidates: sampleCandidates, ats: true }),
    });
    setRun(await res.json());
    setLoading(false);
  }

  async function runAutomatic() {
    setLoading(true);
    setStatus("Sending the run to the PromptQL bot…");
    const res = await fetch("/api/promptql-trigger", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setStatus(`❌ ${data.error}`);
      setLoading(false);
      return;
    }

    // Poll GitHub (via our server) until the bot commits results tagged with this run.
    const started = Date.now();
    for (let i = 1; i <= 30; i++) {
      setStatus(`PromptQL bot is running Jev on 8 resumes… ${Math.round((Date.now() - started) / 1000)}s`);
      await new Promise((r) => setTimeout(r, 10000));
      const poll = await fetch(`/api/promptql-results?run_id=${data.runId}`, { cache: "no-store" });
      if (poll.status === 200) {
        const { results, errors } = parsePromptQLResults(await poll.text(), job, sampleCandidates);
        setRun({ results, errors, source: "promptql", totalMs: Date.now() - started });
        setStatus(`✓ Done: run ${data.runId}, 8 Jev calls.`);
        setLoading(false);
        return;
      }
    }
    setStatus(
      `No results after 5 min. Check the bot thread in PromptQL.`,
    );
    setLoading(false);
  }

  async function runLlm() {
    setLoading(true);
    setStatus("Open-source LLM is reading 8 resumes on this machine (one call per requirement)… about a minute.");
    const res = await fetch("/api/llm-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job, candidates: sampleCandidates }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        msg = JSON.parse(text).error;
      } catch {
        /* keep raw text */
      }
      setStatus(`❌ ${msg}`);
    } else {
      const meta = JSON.parse(text)._meta as { total_ms: number; parse_failures: number; calls: number };
      const { results, errors } = parsePromptQLResults(text, job, sampleCandidates);
      setRun({ results, errors, source: "llm", totalMs: meta.total_ms });
      setStatus(`✓ Done: ${meta.calls} calls, ${meta.parse_failures} unusable answers.`);
    }
    setLoading(false);
  }

  async function loadLlm() {
    setLoading(true);
    setRun(null);
    const res = await fetch("/api/llm-results", { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      setRun({ results: [], errors: [JSON.parse(text).error], source: "llm", totalMs: null });
    } else {
      let totalMs: number | null = null;
      try {
        totalMs = JSON.parse(text)._meta?.total_ms ?? null;
      } catch {
        /* ignore */
      }
      const { results, errors } = parsePromptQLResults(text, job, sampleCandidates);
      setRun({ results, errors, source: "llm", totalMs });
    }
    setLoading(false);
  }

  async function loadFromGitHub() {
    setLoading(true);
    const res = await fetch("/api/promptql-results", { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      setRun({ results: [], errors: [JSON.parse(text).error], source: "promptql", totalMs: null });
    } else {
      const { results, errors } = parsePromptQLResults(text, job, sampleCandidates);
      setRun({ results, errors, source: "promptql", totalMs: null });
    }
    setLoading(false);
  }

  const updateReq = (i: number, patch: Partial<Job["requirements"][number]>) =>
    setJob((j) => ({ ...j, requirements: j.requirements.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));

  const tokens = run?.results.reduce((a, r) => a + r.inputTokens, 0) ?? 0;

  return (
    <main>
      <h1>Calibrated Screening</h1>
      <p className="muted">
        Jev checks each resume for evidence of every requirement and says how sure it is. Candidates are sorted into
        review queues. A person makes every decision.
      </p>

      <div className="panel">
        <h2>{job.title}</h2>
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

        <div className="row" style={{ marginTop: 16 }}>
          <button
            className={mode === "app" ? "" : "ghost"}
            onClick={() => {
              setMode("app");
              setStatus("");
              runInApp();
            }}
          >
            Keyword baseline (old-school ATS)
          </button>
          <button
            className={mode === "llm" ? "" : "ghost"}
            onClick={() => {
              setMode("llm");
              setStatus("");
              loadLlm();
            }}
          >
            Open-source LLM
          </button>
          <button
            className={mode === "promptql" ? "" : "ghost"}
            onClick={() => {
              setMode("promptql");
              setStatus("");
              loadFromGitHub();
            }}
          >
            Jev
          </button>
          <button className={mode === "compare" ? "" : "ghost"} onClick={() => setMode("compare")}>
            Compare all 3
          </button>
        </div>

        {mode === "compare" ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            The same evidence questions answered three ways: an ATS keyword filter, a free open-source LLM, and Jev
            through PromptQL. Change the must-haves above and every column updates.
          </p>
        ) : (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              {mode === "app"
                ? "No AI: scores each requirement by matching its words in the resume, like a traditional ATS keyword filter."
                : mode === "llm"
                  ? "A free open-source model (Qwen 2.5 3B via Ollama) reads each resume and writes yes/no plus a confidence number for each requirement."
                  : "Jev, run through a PromptQL bot, returns a probability that each resume shows evidence for each requirement."}
            </p>
            <button onClick={mode === "app" ? runInApp : mode === "llm" ? runLlm : runAutomatic} disabled={loading}>
              {loading
                ? "Running…"
                : mode === "app"
                  ? "Run keyword baseline"
                  : mode === "llm"
                    ? "Run open-source LLM"
                    : "Run Jev"}
            </button>
            {status && (
              <p className="muted" style={{ fontSize: 13 }}>
                {status}
              </p>
            )}
          </div>
        )}

        {run && mode !== "compare" && (
          <div className="stats muted" style={{ marginTop: 12 }}>
            <span>Source: {run.source === "mock" ? "Keyword baseline (no AI)" : run.source === "llm" ? "Open-source LLM" : run.source === "promptql" ? "PromptQL → Jev" : "Jev live"}</span>
            {run.results[0] && <span>{run.results[0].model}</span>}
            {run.totalMs !== null && <span>{run.totalMs} ms total</span>}
            <span>
              {tokens.toLocaleString()} input tokens
              {run.source === "promptql" || run.source === "live"
                ? ` ≈ $${((tokens / 1e6) * 0.042).toFixed(5)}`
                : " · $0"}
            </span>
          </div>
        )}
        {mode !== "compare" && run?.errors.map((e) => (
          <p key={e} className="not_found" style={{ fontSize: 13 }}>
            {e}
          </p>
        ))}
      </div>

      {mode === "compare" && <Compare job={job} />}

      {run && mode !== "compare" && (
        <div className="lanes">
          {LANES.map(({ lane, label, hint }) => {
            const items = run.results
              .filter((r) => r.lane === lane)
              .sort((a, b) => b.coverage.score - a.coverage.score);
            return (
              <div key={lane} className={`panel lane ${lane}`}>
                <h2>
                  {label} <span>{items.length}</span>
                </h2>
                <p className="muted" style={{ fontSize: 12, marginTop: -8 }}>
                  {hint}
                </p>
                {items.map((r) => (
                  <Card
                    key={r.candidate.id}
                    r={r}
                    open={open === r.candidate.id}
                    toggle={() => setOpen(open === r.candidate.id ? null : r.candidate.id)}
                  />
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
        <span className="pill">
          coverage {r.coverage.score.toFixed(1)}/{r.coverage.max}
        </span>
      </div>
      <div className="row" style={{ gap: 3, margin: "6px 0" }}>
        {r.requirements.map((q) => (
          <span
            key={q.requirement.id}
            title={`${q.requirement.text}: ${Math.round(q.pEvidence * 100)}%`}
            className={`dot ${q.band}`}
          />
        ))}
      </div>
      <ul style={{ fontSize: 13 }}>
        {r.reasons.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {open && (
        <div style={{ fontSize: 13, marginTop: 8 }}>
          {r.requirements.map((q) => (
            <div key={q.requirement.id} style={{ marginBottom: 6 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  {q.requirement.mustHave ? "★ " : ""}
                  {q.requirement.text}
                </span>
                <span className={q.band}>{Math.round(q.pEvidence * 100)}%</span>
              </div>
              <div className="bar">
                <span style={{ width: `${q.pEvidence * 100}%`, background: `var(--${q.band})` }} />
              </div>
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
