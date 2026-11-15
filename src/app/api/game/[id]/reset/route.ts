import { resetGuardian } from '@/lib/server/game';

/** Local development only: reset a character to v1. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'not available' }, { status: 404 });
  const { id } = await ctx.params;
  await resetGuardian(id);
  return Response.json({ ok: true });
}
