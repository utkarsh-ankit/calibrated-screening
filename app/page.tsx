"use client";

import { useEffect, useState } from "react";
import { sampleCandidates, sampleJob } from "@/data/sample";
import Compare from "./compare";
import { buildPromptQLPrompt, GITHUB_BOT_PROMPT, parsePromptQLResults } from "@/lib/promptql";
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
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
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
          setStatus("Showing the latest real Jev results, run through PromptQL and saved to GitHub.");
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
    setRun(null);
    setStatus("Sending resumes to PromptQL…");
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
      setStatus(`Bot is running Jev (run ${data.runId})… waiting for results on GitHub, ${Math.round((Date.now() - started) / 1000)}s`);
      await new Promise((r) => setTimeout(r, 10000));
      const poll = await fetch(`/api/promptql-results?run_id=${data.runId}`, { cache: "no-store" });
      if (poll.status === 200) {
        const { results, errors } = parsePromptQLResults(await poll.text(), job, sampleCandidates);
        setRun({ results, errors, source: "promptql", totalMs: Date.now() - started });
        setStatus(`✓ Results loaded from run ${data.runId}`);
        setLoading(false);
        return;
      }
    }
    setStatus(
      `No results on GitHub after 5 min. Check the bot thread: it may have saved them as an artifact instead. Paste its JSON in the manual fallback below.`,
    );
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

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function loadPasted() {
    const { results, errors } = parsePromptQLResults(pasted, job, sampleCandidates);
    setRun({ results, errors, source: "promptql", totalMs: null });
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
              runInApp();
            }}
          >
            Keyword baseline (old-school ATS)
          </button>
          <button
            className={mode === "llm" ? "" : "ghost"}
            onClick={() => {
              setMode("llm");
              loadLlm();
            }}
          >
            Open-source LLM
          </button>
          <button
            className={mode === "promptql" ? "" : "ghost"}
            onClick={() => {
              setMode("promptql");
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
            The same evidence questions answered three ways: an ATS keyword filter (live), a free open-source LLM
            running locally (saved run), and Jev through PromptQL (saved run). Change the must-haves above and every
            column updates.
          </p>
        ) : mode === "llm" ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              A free open-source model (via Ollama, on a laptop) answers the same evidence questions and writes yes/no
              plus a confidence number. Saved run from <code>promptql/llm-results.json</code>. To refresh it:{" "}
              <code>npm run llm:run</code>, then push.
            </p>
            <button onClick={loadLlm} disabled={loading}>
              {loading ? "Loading…" : "Load saved LLM results"}
            </button>
          </div>
        ) : mode === "app" ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              No AI: scores each requirement by matching its words in the resume, like a traditional ATS keyword filter. Compare with the Jev tab.
            </p>
            <button onClick={runInApp} disabled={loading}>
              {loading ? "Checking…" : `Check ${sampleCandidates.length} resumes`}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13 }}>
              <strong>Automatic:</strong> tells your PromptQL bot to run Jev on the resumes in the repo
              (<code>promptql/requests.json</code>) and save results to GitHub. This page waits and loads them.
            </p>
            <button onClick={runAutomatic} disabled={loading}>
              {loading ? "Running…" : "Run with PromptQL"}
            </button>
            {status && (
              <p className="muted" style={{ fontSize: 13 }}>
                {status}
              </p>
            )}

            <details style={{ marginTop: 14, fontSize: 13 }}>
              <summary className="muted">Manual fallback (if the automatic run doesn&apos;t come back)</summary>
            <p style={{ fontSize: 13 }}>
              <strong>1.</strong> Copy this and paste it into your PromptQL bot. It reads the resumes from GitHub, runs
              Jev, and saves the results back to the repo.
            </p>
            <button onClick={() => copy(GITHUB_BOT_PROMPT)}>{copied ? "Copied ✓" : "Copy bot prompt"}</button>

            <p style={{ fontSize: 13, marginTop: 14 }}>
              <strong>2a.</strong> Bot saved <code>promptql/results.json</code> to GitHub?
            </p>
            <button onClick={loadFromGitHub} disabled={loading}>
              {loading ? "Loading…" : "Load results from GitHub"}
            </button>

            <p style={{ fontSize: 13, marginTop: 14 }}>
              <strong>2b.</strong> Bot replied with JSON instead? Paste it here.
            </p>
            <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"c1": {...}, "c2": {...}}' />
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={loadPasted} disabled={!pasted.trim()}>
                Load pasted results
              </button>
              <button className="ghost" onClick={() => copy(buildPromptQLPrompt(job, sampleCandidates))}>
                Copy full prompt (if you edited requirements above)
              </button>
            </div>
            </details>
          </div>
        )}

        {run && mode !== "compare" && (
          <div className="stats muted" style={{ marginTop: 12 }}>
            <span>Source: {run.source === "mock" ? "Keyword baseline (no AI)" : run.source === "llm" ? "Open-source LLM (saved run)" : run.source === "promptql" ? "PromptQL → Jev" : "Jev live"}</span>
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
