import { loadBreachCases } from '@/lib/bluff';

export async function GET() {
  try {
    return Response.json({ cases: await loadBreachCases() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
