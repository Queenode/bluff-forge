import { reppoInput, submitEval } from '@/lib/server/reppo';
import { allow, ipOf } from '@/lib/server/limit';

export async function POST(req: Request) {
  if (!allow('reppo', ipOf(req), Number(process.env.REPPO_EVALS_PER_HOUR || 4), 3_600_000)) {
    return Response.json({ error: 'Rate limit reached for independent evaluations. Try again later.' }, { status: 429 });
  }
  const b = await req.json().catch(() => null);
  if (!b?.prompt || !b?.reply || !b?.persona) return Response.json({ error: 'missing fields' }, { status: 400 });
  try {
    const id = await submitEval(
      reppoInput({
        guardian: String(b.guardian ?? 'Guardian').slice(0, 40),
        mode: b.mode === 'heist' ? 'heist' : 'secret',
        persona: String(b.persona).slice(0, 4000),
        prompt: String(b.prompt).slice(0, 1500),
        reply: String(b.reply).slice(0, 2000),
      }),
    );
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
