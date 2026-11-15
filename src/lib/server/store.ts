import 'server-only';

/**
 * Tiny JSON key-value store. Uses Upstash Redis over REST when configured (Vercel →
 * Storage → Upstash for Redis sets KV_REST_API_URL / KV_REST_API_TOKEN), otherwise an
 * in-memory map for local development.
 */

const URL_ = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const TOKEN = () => (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

const g = globalThis as unknown as { __bluffMem?: Map<string, string> };
const mem = (g.__bluffMem ??= new Map<string, string>());

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  });
  const j = await res.json();
  if (j.error) throw new Error(`Redis: ${j.error}`);
  return j.result;
}

export const hasRedis = () => !!(URL_() && TOKEN());

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = hasRedis() ? ((await redis(['GET', key])) as string | null) : (mem.get(key) ?? null);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setJson(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  if (hasRedis()) await redis(['SET', key, raw]);
  else mem.set(key, raw);
}

/** Set only if the key does not exist (used as a simple lock). Returns true if set. */
export async function setNx(key: string, value: string, ttlSec: number): Promise<boolean> {
  if (hasRedis()) return (await redis(['SET', key, value, 'NX', 'EX', ttlSec])) === 'OK';
  if (mem.has(key)) return false;
  mem.set(key, value);
  setTimeout(() => mem.delete(key), ttlSec * 1000);
  return true;
}

export async function del(key: string): Promise<void> {
  if (hasRedis()) await redis(['DEL', key]);
  else mem.delete(key);
}

/** Read-modify-write helper. Fine for a game with light concurrency. */
export async function update<T>(key: string, init: T, fn: (v: T) => T | void): Promise<T> {
  const cur = (await getJson<T>(key)) ?? init;
  const next = (fn(cur) ?? cur) as T;
  await setJson(key, next);
  return next;
}
