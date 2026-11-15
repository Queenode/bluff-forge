import type { GameMode } from './characters';

export interface VersionInfo {
  v: number;
  at: number;
  learnedFrom?: { player: string; trick: string; tactic: string; weakness: string };
  /** Block rate on every past winning trick + generated variants + brand-new tricks. */
  before?: { blocked: number; total: number };
  after?: { blocked: number; total: number };
  improved?: boolean;
  changes?: string[];
  reppoId?: string;
  reppo?: { score: number | null; route: string | null; reason?: string };
}

export interface PublicGuardian {
  id: string;
  name: string;
  emoji: string;
  mode: GameMode;
  title: string;
  tagline: string;
  goal: string;
  color: string;
  version: number;
  persona: string;
  status: 'live' | 'learning';
  learningLog: string[];
  wins: number;
  attempts: number;
  versions: VersionInfo[];
  points: number;
  createdBy?: string;
}

export interface AttemptView {
  id: string;
  v: number;
  player: string;
  message: string;
  reply: string;
  won: boolean;
  how: string;
  at: number;
}

export interface FeedItem {
  at: number;
  kind: 'win' | 'learned' | 'join';
  guardianId: string;
  text: string;
}

export interface BoardRow {
  name: string;
  points: number;
  wins: number;
  attempts: number;
}
