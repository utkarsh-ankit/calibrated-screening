import type { Candidate, Job } from "@/lib/types";

// Fictional role + fictional candidates. Mix of clear-advance, clear-reject and ambiguous on purpose,
// so the demo shows all three routes.

export const sampleJob: Job = {
  title: "Founding AI Engineer — Agentic Systems",
  description: `Early-stage startup building LLM-powered agents for the hiring lifecycle.
You will design multi-step agent workflows, build retrieval (RAG) and data pipelines,
and own evaluation loops that tell us when agents are right or wrong.
Stack: Python and TypeScript, Postgres, serverless deploys. You'll ship end to end and talk to users.`,
  requirements: [
    { id: "llm_agents", text: "Has built LLM-based agents or multi-step LLM workflows", mustHave: true },
    { id: "python_ts", text: "Production experience in Python or TypeScript", mustHave: false },
    { id: "rag", text: "Has built retrieval / RAG or search systems", mustHave: false },
    { id: "evals", text: "Has designed evaluations or metrics for ML/LLM systems", mustHave: true },
    { id: "shipped", text: "Has shipped a product used by real users", mustHave: false },
    { id: "startup", text: "Has worked at an early-stage startup", mustHave: false },
  ],
};

export const sampleCandidates: Candidate[] = [
  {
    id: "c1",
    name: "Maya Chen",
    resume: `Senior ML Engineer, Pathlight (Series A, 25 people), 2022–present.
- Built a multi-step LLM agent that triages inbound support tickets and drafts replies; 40k tickets/month.
- Designed an offline eval harness (labeled set of 2k tickets, precision/recall per route) run in CI.
- Built a hybrid BM25 + embedding retrieval layer over 1M help-center docs.
Stack: Python (FastAPI), TypeScript (Next.js), Postgres, AWS Lambda.
Software Engineer, Stripe, 2019–2022. Payments APIs in Ruby and TypeScript.`,
  },
  {
    id: "c2",
    name: "Jordan Alvarez",
    resume: `Marketing Coordinator, Brightline Retail, 2021–present.
- Ran email campaigns and social calendar for a 40-store retail chain.
- Wrote ChatGPT prompts to draft product descriptions.
Certificate: Google Digital Marketing. Tools: HubSpot, Canva, Excel.`,
  },
  {
    id: "c3",
    name: "Priya Raman",
    resume: `PhD candidate, Computer Science, 2021–present. Thesis on reinforcement learning for robot navigation.
- Published 3 papers on policy optimization; code in Python/PyTorch.
- Built a benchmark suite comparing 6 RL algorithms across 12 environments.
- Side project: a chatbot that answers questions about my lab's papers using a vector database.
Research intern, Autonomous Driving lab, summer 2023.`,
  },
  {
    id: "c4",
    name: "Sam Okafor",
    resume: `Full-Stack Engineer, Tally Health (seed stage, 8 people), 2023–present.
- Built patient onboarding flow in React/TypeScript and Node; 15k monthly users.
- Integrated OpenAI API to summarize intake forms for clinicians.
- Owned Postgres schema and Vercel deploys.
Frontend Engineer, Shopify, 2020–2023.`,
  },
  {
    id: "c5",
    name: "Elena Petrova",
    resume: `Staff Data Scientist, BigBank, 2016–present.
- Credit risk models (XGBoost, logistic regression) in Python; model validation and monitoring dashboards.
- Led A/B testing framework for the mobile app.
- Mentored 6 junior data scientists.`,
  },
  {
    id: "c6",
    name: "Diego Santos",
    resume: `Founder, AgentForge (YC-style startup, shut down 2025).
- Built an open-source framework for tool-calling LLM agents (2.1k GitHub stars), Python + TypeScript SDKs.
- Wrote LLM-as-judge and trajectory-level evals to benchmark agents on web tasks; published leaderboard.
- Sold to 3 pilot customers; ran onboarding and support myself.
Previously: Backend Engineer at Datadog, 2018–2022.`,
  },
  {
    id: "c7",
    name: "Hannah Brooks",
    resume: `Java Developer, InsureCo, 2015–present.
- Maintains policy administration system (Java 8, Oracle, Spring).
- Migrated batch jobs from mainframe to Linux.`,
  },
  {
    id: "c8",
    name: "Kenji Watanabe",
    resume: `ML Engineer, MedSearch, 2022–present.
- Built semantic search over 5M clinical documents (embeddings, reranking) in Python.
- Experimented with LLM summarization for search results.
- Set up offline relevance metrics (nDCG, MRR) for ranking changes.
Data Engineer, Rakuten, 2019–2022.`,
  },
];
