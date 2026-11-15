import { attemptsLeft, guardianDetail } from '@/lib/server/game';
import { requireUser } from '@/lib/server/account';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await guardianDetail(id);
  if (!d) return Response.json({ error: 'Unknown character' }, { status: 404 });
  const userId = await requireUser();
  return Response.json({ ...d, left: userId ? await attemptsLeft(userId) : null });
}
