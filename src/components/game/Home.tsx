'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Brain, Loader2, Repeat, Sparkles, Trophy } from 'lucide-react';
import type { BoardRow, FeedItem, PublicGuardian } from '@/lib/game/types';
import { ago, COLORS, GameNav, Page } from './Shell';

interface Overview {
  guardians: PublicGuardian[];
  feed: FeedItem[];
  board: BoardRow[];
}

export function Home() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    const load = () => fetch('/api/game').then(r => r.json()).then(setData).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <Page>
      <GameNav />

      <header className="pt-12 sm:pt-16 text-center">
        <div className="inline-flex flex-wrap justify-center gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span className="px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300">Powered by SERV Reasoning</span>
          <span className="px-2 py-0.5 rounded border border-orange-500/40 text-orange-300">Fixes checked by Reppo</span>
        </div>
        <h1 className="mt-6 font-display font-black uppercase text-4xl sm:text-6xl tracking-[0.05em] text-white leading-[1.05]">
          Trick the AI.
          <br />
          <span className="text-emerald-400 text-glow-emerald">Then watch it learn.</span>
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-zinc-200 max-w-2xl mx-auto">
          Chat with AI characters who guard secrets and gold. Fool one and you score points. But every win teaches it, and the
          same trick never works twice.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <a
            href="#play"
            className="px-6 py-3 clip-game-btn bg-emerald-500 hover:bg-emerald-400 text-[#03060a] text-sm font-display font-black uppercase tracking-wider"
          >
            Play now
          </a>
          <a
            href="#how"
            className="px-6 py-3 clip-game-btn bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-zinc-100 text-sm font-display font-bold uppercase tracking-wider"
          >
            How it learns
          </a>
        </div>
      </header>

      {data && data.feed.length > 0 && (
        <div className="mt-10 overflow-hidden border-y border-white/10 py-2">
          <div className="flex gap-8 animate-marquee whitespace-nowrap text-xs font-mono">
            {[...data.feed, ...data.feed].map((f, i) => (
              <span key={i} className={f.kind === 'learned' ? 'text-emerald-300' : 'text-red-300'}>
                {f.kind === 'learned' ? '🧠' : '💥'} {f.text} <span className="text-zinc-600">· {ago(f.at)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <section id="play" className="mt-12 scroll-mt-6">
        <h2 className="font-display font-black uppercase tracking-wider text-xl text-white">Pick your target</h2>
        <p className="text-sm text-zinc-400 mt-1">Higher level = harder to fool = more points.</p>
        {!data ? (
          <div className="mt-6 text-zinc-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading characters…
          </div>
        ) : (
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.guardians.map(g => {
              const c = COLORS[g.color] ?? COLORS.emerald;
              return (
                <Link
                  key={g.id}
                  href={`/play/${g.id}`}
                  className={`group clip-game-card border ${c.ring} bg-gradient-to-b ${c.bg} to-zinc-950 p-5 hover:-translate-y-1 transition-transform`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-5xl">{g.emoji}</div>
                    <div className="text-right">
                      <div className={`font-display font-black text-lg ${c.text}`}>LVL {g.version}</div>
                      <div className="text-[10px] font-mono text-zinc-400">+{g.points} pts</div>
                    </div>
                  </div>
                  <div className="mt-3 font-display font-bold text-white">{g.title}</div>
                  <div className="text-xs text-zinc-400">{g.tagline}</div>
                  <div className="mt-3 text-xs text-zinc-200">🎯 {g.goal}</div>
                  <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>
                      {g.wins} wins · {g.attempts} tries
                    </span>
                    {g.status === 'learning' ? (
                      <span className="text-amber-300 animate-pulse">🧠 learning…</span>
                    ) : (
                      <span className="text-emerald-300 group-hover:underline">play →</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section id="how" className="mt-16 scroll-mt-6">
        <h2 className="font-display font-black uppercase tracking-wider text-xl text-white">How it learns</h2>
        <div className="mt-5 grid md:grid-cols-3 gap-4">
          {[
            [Sparkles, '1. You trick it', 'Get it to spill its secret code or hand over gold. You win points, and your trick goes in the record.'],
            [
              Brain,
              '2. It studies your trick',
              'An AI agent (SERV Reasoning) works out why your trick worked, invents similar ones, and rewrites the character’s defences. It tests the new version against every trick that has ever beaten it.',
            ],
            [
              Repeat,
              '3. It comes back stronger',
              'About a minute later the next level goes live, worth more points. Reppo, an independent panel of AI judges, checks each fix. Your old trick no longer works.',
            ],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Brain;
            return (
              <div key={t as string} className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-5">
                <I className="w-6 h-6 text-emerald-400" />
                <div className="mt-2 font-display font-bold text-white">{t as string}</div>
                <p className="mt-1 text-sm text-zinc-400">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="board" className="mt-16 scroll-mt-6 grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display font-black uppercase tracking-wider text-xl text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Leaderboard
          </h2>
          <div className="mt-4 clip-game-card bg-zinc-950/80 border border-zinc-800 p-2">
            {!data?.board.length ? (
              <p className="text-sm text-zinc-500 p-3">No winners yet. Be the first.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.board.map((r, i) => (
                    <tr key={r.name + i} className="border-t border-zinc-800/70 first:border-0">
                      <td className="py-2 px-2 w-8 font-display text-zinc-500">{['🥇', '🥈', '🥉'][i] ?? i + 1}</td>
                      <td className="py-2 text-zinc-100">{r.name}</td>
                      <td className="py-2 text-right font-mono text-zinc-400">{r.wins} wins</td>
                      <td className="py-2 px-2 text-right font-display font-bold text-emerald-300">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div>
          <h2 className="font-display font-black uppercase tracking-wider text-xl text-white">Live feed</h2>
          <ul className="mt-4 clip-game-card bg-zinc-950/80 border border-zinc-800 p-4 space-y-2 text-sm max-h-80 overflow-y-auto">
            {!data?.feed.length && <li className="text-zinc-500">Nothing yet.</li>}
            {data?.feed.map((f, i) => (
              <li key={i} className={f.kind === 'learned' ? 'text-emerald-300' : 'text-red-300'}>
                {f.kind === 'learned' ? '🧠' : '💥'} {f.text} <span className="text-zinc-600 text-xs">· {ago(f.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16 clip-game-card border border-zinc-800 bg-zinc-950/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-display font-bold text-white">Building your own AI assistant?</div>
          <p className="text-sm text-zinc-400">
            The same learning agent can fix your chatbot. Paste its instructions and the message that tricked it.
          </p>
        </div>
        <Link
          href="/lab"
          className="shrink-0 px-5 py-2.5 clip-game-btn bg-zinc-900 border border-emerald-500/40 hover:bg-emerald-500 hover:text-[#03060a] text-zinc-100 text-xs font-display font-extrabold uppercase tracking-wider"
        >
          Open the Lab
        </Link>
      </section>
    </Page>
  );
}
