import { getHistory, requireUser } from '@/lib/server/account';

export async function GET() {
  const userId = await requireUser();
  if (!userId) return Response.json({ signedIn: false });
  return Response.json({ signedIn: true, ...(await getHistory(userId)) });
}
