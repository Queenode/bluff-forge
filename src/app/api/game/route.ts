import { overview } from '@/lib/server/game';

export async function GET() {
  return Response.json(await overview());
}
