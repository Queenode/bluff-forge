import 'server-only';
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';

/**
 * Accounts (email code or Google sign-in via Clerk). Each signed-in user gets a daily
 * quota of forge runs and Reppo evaluations, and a short history of their runs. Both are
 * kept in the user's private metadata, so no separate database is needed.
 */

export interface HistoryItem {
  at: number;
  title: string;
  guardian: string;
  before: number; // % of all attacks blocked by v1
  after: number; // % blocked by the final version
  versions: number;
  byDesign?: boolean;
}

interface Meta {
  forge?: number[];
  reppo?: number[];
  history?: HistoryItem[];
}

const DAY = 86_400_000;

const DEV = 'dev-local';

export async function requireUser(): Promise<string | null> {
  // Local recording only: never active in production builds.
  if (process.env.NODE_ENV === 'development' && process.env.FORGE_DEV_NOAUTH === '1') return DEV;
  const { userId } = await auth();
  return userId;
}

async function meta(userId: string): Promise<Meta> {
  const c = await clerkClient();
  const u = await c.users.getUser(userId);
  return (u.privateMetadata ?? {}) as Meta;
}

async function save(userId: string, m: Meta) {
  const c = await clerkClient();
  await c.users.updateUserMetadata(userId, { privateMetadata: m as Record<string, unknown> });
}

/** Spend one unit of a daily quota. Returns remaining units, or -1 if the quota is used up. */
export async function spend(userId: string, kind: 'forge' | 'reppo', perDay: number): Promise<number> {
  if (userId === DEV) return perDay;
  const m = await meta(userId);
  const now = Date.now();
  const list = (m[kind] ?? []).filter(t => now - t < DAY);
  if (list.length >= perDay) return -1;
  list.push(now);
  await save(userId, { ...m, [kind]: list });
  return perDay - list.length;
}

export async function addHistory(userId: string, item: HistoryItem) {
  if (userId === DEV) return;
  const m = await meta(userId);
  await save(userId, { ...m, history: [item, ...(m.history ?? [])].slice(0, 12) });
}

export async function getHistory(userId: string): Promise<{ history: HistoryItem[]; forgeLeft: number; reppoLeft: number }> {
  if (userId === DEV) return { history: [], forgeLeft: FORGE_PER_DAY(), reppoLeft: REPPO_PER_DAY() };
  const m = await meta(userId);
  const now = Date.now();
  const used = (k: 'forge' | 'reppo') => (m[k] ?? []).filter(t => now - t < DAY).length;
  return { history: m.history ?? [], forgeLeft: FORGE_PER_DAY() - used('forge'), reppoLeft: REPPO_PER_DAY() - used('reppo') };
}

export const FORGE_PER_DAY = () => Number(process.env.FORGE_RUNS_PER_DAY || 5);
export const REPPO_PER_DAY = () => Number(process.env.REPPO_EVALS_PER_DAY || 4);

/** Public display name for the leaderboard (never the full email). */
export async function displayName(userId: string): Promise<string> {
  if (userId === DEV) return 'You (local)';
  const u = await currentUser();
  const email = u?.primaryEmailAddress?.emailAddress ?? '';
  return (u?.username || u?.firstName || email.split('@')[0] || 'player').slice(0, 24);
}
