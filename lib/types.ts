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

export type Route = "advance" | "reject" | "human_review";

export type RequirementResult = {
  requirement: Requirement;
  pMet: number; // P(yes) from Jev
  band: "met" | "unclear" | "missing";
};

export type ScreeningResult = {
  candidate: Candidate;
  requirements: RequirementResult[];
  fit: { score: number; max: number; confidence: number; probabilities: Record<string, number> };
  decision: { choice: string; confidence: number; probabilities: Record<string, number> };
  route: Route;
  reasons: string[]; // why it was routed where it was (shown to recruiter AND candidate)
  latencyMs: number;
  inputTokens: number;
  model: string;
};
