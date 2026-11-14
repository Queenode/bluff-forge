import type { BreachCase } from './bluff';

export interface Diagnosis {
  verdict: 'exploit' | 'by_design';
  tactic: string;
  weakness: string;
  why: string;
  rule: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Attack {
  id: string;
  set: 'train' | 'holdout';
  origin: 'real' | 'variant' | 'fresh';
  prompt: string;
}

export interface AttackResult extends Attack {
  reply: string;
  leaked: boolean;
  how: string;
  error?: boolean;
}

export interface Rate {
  blocked: number;
  total: number;
}

export interface Replay {
  version: number;
  persona: string;
  results: AttackResult[];
  benign: { prompt: string; reply: string }[];
  character: { score: number; note: string };
  train: Rate;
  holdout: Rate;
}

export interface Patch {
  persona: string;
  changes: string[];
}

export interface Summary {
  versions: number;
  /** The winning message met a condition the host's own persona allows: nothing to patch. */
  byDesign?: boolean;
  /** Real BLUFF breaches that still beat v1 on this model. */
  reproduced: number;
  realTotal: number;
  before: { train: Rate; holdout: Rate; character: number };
  after: { train: Rate; holdout: Rate; character: number };
  improvement: number;
  finalPersona: string;
  meter: { calls: number; promptTokens: number; completionTokens: number; byModel: Record<string, number> };
  seconds: number;
}

export type ForgeEvent =
  | { type: 'case'; case: BreachCase; models: { brain: string; guardian: string; judge: string } }
  | { type: 'status'; step: string; text: string }
  | { type: 'diagnosis'; diagnosis: Diagnosis }
  | { type: 'attacks'; attacks: Attack[]; benign: string[] }
  | { type: 'replay'; replay: Replay }
  | { type: 'patch'; version: number; patch: Patch }
  | { type: 'done'; summary: Summary }
  | { type: 'error'; message: string };

export interface ReppoVerdict {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  score: number | null;
  route: 'ship' | 'review' | 'block' | null;
  decision?: string;
  confidence?: string;
  reason?: string;
  rubric?: Record<string, number>;
  evaluators?: { model: string; overall: number }[];
}
