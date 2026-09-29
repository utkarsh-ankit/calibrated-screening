# Calibrated Screening

A hiring screen that knows when it doesn't know. Built on **Jev** (TypeSafe AI's System One model).

Most AI screeners give a yes/no and hide how sure they are. This one asks Jev typed questions about each
resume and uses the **calibrated probabilities** to route candidates:

- **Advance:** meets every must-have and the model is confident
- **Reject:** clear evidence a must-have is missing
- **Human review:** the model is unsure, or the resume is ambiguous on a must-have

Every decision comes with a plain-language reason that can be shown to the recruiter *and* the candidate.

## How it works

One Jev call per candidate, all questions answered in parallel against the same state:

| Question | Jev type | Used for |
|---|---|---|
| `req_<id>` per requirement | `noul` | P(requirement met) → met / unclear / missing |
| `fit` | `score` (0–4) | overall match |
| `decision` | `choice` (advance / reject) | recommendation + confidence |

Routing lives in `lib/screening.ts` (`POLICY` thresholds + `routeCandidate`).

## Run

```bash
npm install
cp .env.example .env.local   # add TYPESAFE_API_KEY; leave blank for mock mode
npm run dev
```

Without a key the app runs in **mock mode** (deterministic fake answers) so the UI can be built first.

## Layout

```
app/page.tsx            UI: job + requirements editor, three routing lanes
app/api/screen/route.ts POST {job, candidates} → screened results
lib/jev.ts              Jev HTTP client + mock
lib/screening.ts        question schema + routing policy
lib/types.ts            Jev + app types
data/sample.ts          fictional JD and 8 fictional resumes
```

## Roadmap (hackathon day)

- [ ] Swap mock → real Jev key, sanity-check probabilities on the 8 samples
- [ ] Tune `POLICY` thresholds so each lane gets sensible candidates
- [ ] Paste/upload your own resumes (PDF → text)
- [ ] Extract requirements from a JD with an LLM (Jev can't generate text)
- [ ] Candidate view: "what you were missing" with confidence
- [ ] Eval tab: same questions on a chat LLM vs Jev — latency, cost, agreement on a hand-labeled set
- [ ] Deploy to Vercel + record a 2-min demo
