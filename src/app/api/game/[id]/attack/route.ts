import { after } from 'next/server';
import { attack, learn } from '@/lib/server/game';
import { displayName, requireUser } from '@/lib/server/account';
import { allow, ipOf } from '@/lib/server/limit';

export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await requireUser();
  if (!userId) return Response.json({ error: 'Sign in to play.' }, { status: 401 });
  if (!allow('attack', ipOf(req), 60, 3_600_000)) return Response.json({ error: 'Slow down a little!' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  let r: Awaited<ReturnType<typeof attack>>;
  try {
    r = await attack(id, userId, await displayName(userId), String(body.message ?? ''));
  } catch {
    return Response.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
  }
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  // The character learns from the winning trick in the background, after the reply is sent.
  if (r.won) after(() => learn(id));
  return Response.json(r);
}
