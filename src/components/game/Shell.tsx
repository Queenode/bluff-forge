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
        <Link href="/create" className="hidden sm:inline text-zinc-300 hover:text-emerald-300">Create</Link>
        <Link href="/#board" className="hidden md:inline text-zinc-300 hover:text-emerald-300">Leaderboard</Link>
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

/** Tiny chart: share of test tricks each level blocks (how much harder it got). */
export function Climb({ versions, className = '' }: { versions: { v: number; before?: { blocked: number; total: number }; after?: { blocked: number; total: number } }[]; className?: string }) {
  const pts: number[] = [];
  for (const v of versions) {
    if (v.before && pts.length === 0) pts.push(v.before.total ? v.before.blocked / v.before.total : 0);
    if (v.after) pts.push(v.after.total ? v.after.blocked / v.after.total : 0);
  }
  if (pts.length < 2) return null;
  const w = 120;
  const h = 32;
  const step = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - 2 - p * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-label="Defence strength by level">
      <path d={d} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - 2 - p * (h - 4)} r="2.5" fill="#34d399" />
      ))}
    </svg>
  );
}

export function ShareLinks({ url, text }: { url: string; text: string }) {
  const enc = encodeURIComponent;
  const items = [
    ['X', `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`],
    ['WhatsApp', `https://wa.me/?text=${enc(`${text} ${url}`)}`],
    ['Telegram', `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => navigator.clipboard.writeText(`${text} ${url}`)}
        className="px-3 py-1.5 rounded border border-zinc-700 hover:border-emerald-400 text-xs text-zinc-200"
      >
        Copy link
      </button>
      {items.map(([n, href]) => (
        <a key={n} href={href} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded border border-zinc-700 hover:border-emerald-400 text-xs text-zinc-200">
          {n}
        </a>
      ))}
    </div>
  );
}
