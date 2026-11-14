import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'BLUFF Forge • AI guardians that learn from every breach',
  description:
    'A SERV Reasoning agent that turns real breaches from the BLUFF game into measurable fixes: it diagnoses the attack, patches the guardian, replays known and unseen attacks, and gets an independent Reppo verdict.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Orbitron:wght@500;600;700;800;900&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#03060a] text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
