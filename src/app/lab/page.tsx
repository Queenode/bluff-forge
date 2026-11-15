import type { Metadata } from 'next';
import { ForgeApp } from '@/components/ForgeApp';

export const metadata: Metadata = {
  title: 'BLUFF Lab • Fix your own AI assistant',
  description: 'The same learning agent behind the BLUFF game, for your own chatbot: paste its instructions and the message that tricked it.',
};

export default function LabPage() {
  return <ForgeApp />;
}
