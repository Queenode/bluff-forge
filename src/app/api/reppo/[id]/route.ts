import { readEval } from '@/lib/server/reppo';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return Response.json(await readEval(id));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
