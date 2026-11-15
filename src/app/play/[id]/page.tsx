import { Arena } from '@/components/game/Arena';

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Arena id={id} />;
}
