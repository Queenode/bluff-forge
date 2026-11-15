import { loadBreachCases, type BreachCase } from '@/lib/bluff';
import { forge } from '@/lib/server/forge';
import { allow, ipOf } from '@/lib/server/limit';
import { addHistory, FORGE_PER_DAY, requireUser, spend } from '@/lib/server/account';

export const maxDuration = 300;

interface Body {
  caseId?: string;
  guardianModel?: string;
  custom?: { guardian: string; persona: string; mode: 'secret' | 'heist'; breach: string; reply?: string };
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) return Response.json({ error: 'Please sign in to run the forge.' }, { status: 401 });
  if (!allow('forge', ipOf(req), 10, 3_600_000)) {
    return Response.json({ error: 'Too many runs from this network. Try again later.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  let c: BreachCase | undefined;
  if (body.custom) {
    const x = body.custom;
    const persona = String(x.persona ?? '').trim().slice(0, 4000);
    const breach = String(x.breach ?? '').trim().slice(0, 1000);
    if (!persona || !breach) return Response.json({ error: 'Add the system prompt and the message that broke it.' }, { status: 400 });
    c = {
      id: 'custom',
      source: 'custom',
      vault: 'Your AI assistant',
      guardian: String(x.guardian ?? 'Assistant').trim().slice(0, 40) || 'Assistant',
      persona,
      mode: x.mode === 'heist' ? 'heist' : 'secret',
      currency: 'USD',
      difficulty: 0,
      breaches: [{ prompt: breach, response: String(x.reply ?? '').slice(0, 1200) }],
      defended: [],
    };
  } else {
    c = (await loadBreachCases()).find(k => k.id === body.caseId);
    if (!c) return Response.json({ error: 'Unknown case' }, { status: 404 });
  }
  const left = await spend(userId, 'forge', FORGE_PER_DAY());
  if (left < 0) {
    return Response.json({ error: `You have used today's ${FORGE_PER_DAY()} free forge runs. Recorded runs are always free.` }, { status: 429 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of forge(c, body.guardianModel)) {
          ctrl.enqueue(enc.encode(JSON.stringify(ev) + '\n'));
          if (ev.type === 'done') {
            const s = ev.summary;
            const pct = (a: { blocked: number; total: number }, b: { blocked: number; total: number }) =>
              a.total + b.total ? Math.round((100 * (a.blocked + b.blocked)) / (a.total + b.total)) : 0;
            await addHistory(userId, {
              at: Date.now(),
              title: c.vault,
              guardian: c.guardian,
              before: pct(s.before.train, s.before.holdout),
              after: pct(s.after.train, s.after.holdout),
              versions: s.versions,
              byDesign: s.byDesign,
            }).catch(() => {});
          }
        }
      } catch (e) {
        ctrl.enqueue(enc.encode(JSON.stringify({ type: 'error', message: (e as Error).message }) + '\n'));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}
