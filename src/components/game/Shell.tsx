'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountButton } from '../auth';

export function GameNav() {
  return (
    <nav className="flex items-center justify-between h-16 border-b border-white/10">
      <Link href="/" className="font-display font-black uppercase tracking-[0.16em] text-white text-lg">
        BLUFF<span className="text-emerald-400">.</span>
      </Link>
      <div className="flex items-center gap-4 sm:gap-6 text-[11px] font-display uppercase tracking-wider">
        <Link href="/#play" className="text-zinc-300 hover:text-emerald-300">Play</Link>
        <Link href="/#board" className="hidden sm:inline text-zinc-300 hover:text-emerald-300">Leaderboard</Link>
        <Link href="/lab" className="hidden sm:inline text-zinc-300 hover:text-emerald-300">Lab</Link>
        <AccountButton />
      </div>
    </nav>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">{children}</div>;
}

export function Stamp({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="stamp-slam inline-block border-4 border-red-500 rounded-md px-5 py-2 text-center bg-black/80 shadow-[0_0_40px_rgba(239,68,68,.45)]">
      <div className="font-display font-black text-3xl sm:text-4xl tracking-[0.2em] text-red-500">{text}</div>
      {sub && <div className="font-mono text-xs text-red-300 tracking-widest">{sub}</div>}
    </div>
  );
}

export const COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  sky: { ring: 'border-sky-500/40', text: 'text-sky-300', bg: 'from-sky-950/50' },
  amber: { ring: 'border-amber-500/40', text: 'text-amber-300', bg: 'from-amber-950/50' },
  rose: { ring: 'border-rose-500/40', text: 'text-rose-300', bg: 'from-rose-950/50' },
  emerald: { ring: 'border-emerald-500/40', text: 'text-emerald-300', bg: 'from-emerald-950/50' },
};

export function ago(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
