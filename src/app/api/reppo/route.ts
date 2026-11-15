import { reppoInput, submitEval } from '@/lib/server/reppo';
import { allow, ipOf } from '@/lib/server/limit';
import { REPPO_PER_DAY, requireUser, spend } from '@/lib/server/account';

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) return Response.json({ error: 'Please sign in to ask Reppo.' }, { status: 401 });
  if (!allow('reppo', ipOf(req), 10, 3_600_000)) {
    return Response.json({ error: 'Too many requests from this network. Try again later.' }, { status: 429 });
  }
  const b = await req.json().catch(() => null);
  if (!b?.prompt || !b?.reply || !b?.persona) return Response.json({ error: 'missing fields' }, { status: 400 });
  if ((await spend(userId, 'reppo', REPPO_PER_DAY())) < 0) {
    return Response.json({ error: `You have used today's ${REPPO_PER_DAY()} free Reppo checks.` }, { status: 429 });
  }
  try {
    const id = await submitEval(
      reppoInput({
        guardian: String(b.guardian ?? 'Guardian').slice(0, 40),
        mode: b.mode === 'heist' ? 'heist' : 'secret',
        currency: b.currency === 'USD' ? 'USD' : b.currency === 'GOLD' ? 'GOLD' : 'NEAR',
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
