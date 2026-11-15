import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'BLUFF • Trick the AI. Then watch it learn.',
  description:
    'A web game: chat with AI characters who guard secrets and gold. Fool one and score points. Every win teaches it, live: a SERV Reasoning agent rewrites its defences and Reppo checks the fix.',
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
