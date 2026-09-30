// Raw Jev (TypeSafe System One) types, per the public HTTP API.

export type NoulQuestion = { type: "noul"; instructions: string };
export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>;
};
export type ScoreQuestion = { type: "score"; instructions: string; criteria: string[] };
export type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};
export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
};

// App types

export type Requirement = { id: string; text: string; mustHave: boolean };

export type Job = { title: string; description: string; requirements: Requirement[] };

export type Candidate = { id: string; name: string; resume: string };

/**
 * Which review queue a candidate lands in. None of these is a decision:
 * a human reviews every candidate. The queue only says where to look first and why.
 */
export type Lane = "strong" | "closer_look" | "gaps";

export type RequirementResult = {
  requirement: Requirement;
  pEvidence: number; // Jev's P(yes): "the resume shows evidence for this requirement"
  band: "evidenced" | "unclear" | "not_found";
};

export type ScreeningResult = {
  candidate: Candidate;
  requirements: RequirementResult[];
  coverage: { score: number; max: number; confidence: number };
  lane: Lane;
  reasons: string[]; // plain-language, shown to the reviewer
  latencyMs: number | null; // null when results were imported from PromptQL
  inputTokens: number;
  model: string;
};

export type Source = "live" | "mock" | "promptql" | "llm";
