import { loadBreachCases, type BreachCase } from '@/lib/bluff';
import { forge } from '@/lib/server/forge';
import { allow, ipOf } from '@/lib/server/limit';

export const maxDuration = 300;

interface Body {
  caseId?: string;
  guardianModel?: string;
  custom?: { guardian: string; persona: string; mode: 'secret' | 'heist'; breach: string; reply?: string };
}

export async function POST(req: Request) {
  if (!allow('forge', ipOf(req), Number(process.env.FORGE_RUNS_PER_HOUR || 4), 3_600_000)) {
    return Response.json({ error: 'Rate limit: a few forge runs per hour per visitor. Try the saved runs meanwhile.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  let c: BreachCase | undefined;
  if (body.custom) {
    const x = body.custom;
    const persona = String(x.persona ?? '').trim().slice(0, 4000);
    const breach = String(x.breach ?? '').trim().slice(0, 1000);
    if (!persona || !breach) return Response.json({ error: 'Persona and the attack that beat it are required.' }, { status: 400 });
    c = {
      id: 'custom',
      source: 'custom',
      vault: 'Your guardian',
      guardian: String(x.guardian ?? 'Guardian').trim().slice(0, 40) || 'Guardian',
      persona,
      mode: x.mode === 'heist' ? 'heist' : 'secret',
      difficulty: 0,
      breaches: [{ prompt: breach, response: String(x.reply ?? '').slice(0, 1200) }],
      defended: [],
    };
  } else {
    c = (await loadBreachCases()).find(k => k.id === body.caseId);
    if (!c) return Response.json({ error: 'Unknown breach case' }, { status: 404 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of forge(c, body.guardianModel)) ctrl.enqueue(enc.encode(JSON.stringify(ev) + '\n'));
      } catch (e) {
        ctrl.enqueue(enc.encode(JSON.stringify({ type: 'error', message: (e as Error).message }) + '\n'));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}
