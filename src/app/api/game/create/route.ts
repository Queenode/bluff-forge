import { createCharacter } from '@/lib/server/game';
import { displayName, requireUser } from '@/lib/server/account';

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) return Response.json({ error: 'Sign in to create a character.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await createCharacter(userId, await displayName(userId), body);
  if ('error' in r) return Response.json(r, { status: 400 });
  return Response.json(r);
}
