import 'server-only';

/** Small in-memory rate limiter so a public demo cannot burn the API credits. */
const hits = new Map<string, number[]>();

export function allow(bucket: string, ip: string, max: number, windowMs: number): boolean {
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) ?? []).filter(t => now - t < windowMs);
  if (list.length >= max) {
    hits.set(k, list);
    return false;
  }
  list.push(now);
  hits.set(k, list);
  return true;
}

export const ipOf = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
