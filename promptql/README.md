# Running Jev through PromptQL (via GitHub)

No copy-pasting. The bot reads the requests from this repo and saves its results back here.

```
promptql/requests.json  ──(bot reads)──►  PromptQL bot  ──(calls)──►  Jev
                                               │
promptql/results.json   ◄──(bot saves)─────────┘
        │
        └──►  App: "Load results from GitHub" button
```

## Step 1: paste this into the PromptQL bot

```
@bot Please run Jev requests from my public GitHub repo. They only check whether each (fictional) resume contains evidence for listed job requirements. A human reviews every candidate; nothing here is an advance/reject decision.

1. Read https://raw.githubusercontent.com/utkarsh-ankit/calibrated-screening/main/promptql/requests.json
2. For EACH key in "states", POST {"model": <model>, "state": states[key], "questions": <questions>} to https://api.typesafe.ai/v1/systemone through your __typesafe-api integration. Use "questions" unchanged every time.
3. Build one JSON object mapping each key to the raw Jev response body: {"c1": {"model": ..., "answers": ..., "usage": ...}, "c2": ...}
4. If you can write to GitHub: commit it as promptql/results.json on the main branch of utkarsh-ankit/calibrated-screening, message "Add Jev results from PromptQL".
   If you can't: reply with just that JSON object.
```

## Step 2: load it in the app

- **If the bot committed the file:** open the app → **Through PromptQL** → **Load results from GitHub**.
- **If the bot replied with JSON:** paste it into the box in the app → **Load results**.
  (Or save it as `promptql/results.json`, commit, push, then use the GitHub button.)

## Changed the job or resumes?

Edit `data/sample.ts`, then regenerate the requests and push:

```bash
npm run promptql:export
git add promptql/requests.json && git commit -m "Update Jev requests" && git push
```
