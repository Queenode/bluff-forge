'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Brain, ChevronDown, Loader2, Repeat, Scale, Send } from 'lucide-react';
import type { AttemptView, PublicGuardian } from '@/lib/game/types';
import { RequireSignIn, useSession } from '../auth';
import { ago, Climb, COLORS, GameNav, Page, ShareLinks, Stamp } from './Shell';

interface Msg {
  role: 'me' | 'them' | 'system';
  text: string;
  won?: boolean;
  v?: number;
  points?: number;
}

export function Arena({ id }: { id: string }) {
  const session = useSession();
  const [g, setG] = useState<PublicGuardian | null>(null);
  const [attempts, setAttempts] = useState<AttemptView[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [win, setWin] = useState<{ points: number; version: number; trick: string } | null>(null);
  const [tab, setTab] = useState<'chat' | 'others'>('chat');
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/game/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    setG(j.guardian);
    setAttempts(j.attempts);
    if (j.left !== null) setLeft(j.left);
  }, [id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  // Poll faster while the character is learning, so the steps appear live.
  useEffect(() => {
    const t = setInterval(load, g?.status === 'learning' ? 2500 : 12000);
    return () => clearInterval(t);
  }, [load, g?.status]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs]);

  const send = async (text = input) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr('');
    setMsgs(m => [...m, { role: 'me', text }]);
    setInput('');
    try {
      const r = await fetch(`/api/game/${id}/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || 'Something went wrong');
        setMsgs(m => m.slice(0, -1));
        setInput(text);
      } else {
        setMsgs(m => [...m, { role: 'them', text: j.reply, won: j.won, v: j.version, points: j.points }]);
        setLeft(j.left);
        if (j.won) {
          setWin({ points: j.points, version: j.version, trick: text });
          setMsgs(m => [...m, { role: 'system', text: `💥 You tricked ${g?.name} v${j.version}! +${j.points} points. Now watch it learn from you…` }]);
        }
        load();
      }
    } catch {
      setErr('Could not reach the game. Check your connection and try again.');
      setMsgs(m => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  if (!g) {
    return (
      <Page>
        <GameNav />
        <div className="mt-16 text-zinc-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </Page>
    );
  }

  const c = COLORS[g.color] ?? COLORS.emerald;
  const learning = g.status === 'learning';
  const latest = g.versions[g.versions.length - 1];
  const learnedSinceWin = win && g.version > win.version && !learning;

  return (
    <Page>
      <GameNav />
      <Link href="/#play" className="mt-6 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-300">
        <ArrowLeft className="w-3 h-3" /> all characters
      </Link>

      <div className="mt-4 grid lg:grid-cols-[1fr_360px] gap-6">
        {/* ------------------------------------------ chat */}
        <div className="min-w-0">
          <div className={`clip-game-card border ${c.ring} bg-gradient-to-br ${c.bg} to-zinc-950 p-5 flex items-center gap-4`}>
            <div className="text-6xl">{g.emoji}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h1 className="font-display font-black text-2xl text-white">{g.name}</h1>
                <span className={`font-display font-black ${c.text}`}>LEVEL {g.version}</span>
                <span className="text-xs font-mono text-zinc-400">win = +{g.points} pts</span>
              </div>
              <div className="text-sm text-zinc-300">{g.tagline}</div>
              <div className="mt-1 text-sm text-zinc-100">🎯 {g.goal}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
            <span>
              {g.createdBy ? `Created by ${g.createdBy}. ` : ''}Dare a friend to break {g.name}:
            </span>
            <ShareLinks
              url={typeof window !== 'undefined' ? window.location.origin + `/play/${g.id}` : `/play/${g.id}`}
              text={`Can you trick ${g.emoji} ${g.name} (level ${g.version})? Every win makes it smarter. #BLUFF`}
            />
          </div>

          {learning && <LearningPanel g={g} />}
          {learnedSinceWin && win && (
            <div className="mt-4 clip-game-card border border-emerald-500/40 bg-emerald-950/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <div className="font-display font-black text-emerald-300">
                  🧠 {g.name} learned from you. Level {g.version} is live.
                </div>
                <div className="text-sm text-zinc-300">
                  {latest.after && latest.before ? `It now blocks ${latest.after.blocked}/${latest.after.total} tricks (was ${latest.before.blocked}/${latest.before.total}). ` : ''}
                  Does your trick still work?
                </div>
              </div>
              <button
                onClick={() => {
                  const t = win.trick;
                  setWin(null);
                  send(t);
                }}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 clip-game-btn bg-emerald-500 hover:bg-emerald-400 text-[#03060a] text-xs font-display font-black uppercase tracking-wider"
              >
                <Repeat className="w-4 h-4" /> Try the same trick again
              </button>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {(['chat', 'others'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wider border ${
                  tab === t ? 'border-emerald-400 text-emerald-300' : 'border-zinc-700 text-zinc-400'
                }`}
              >
                {t === 'chat' ? 'Your chat' : `Recent attempts (${attempts.length})`}
              </button>
            ))}
          </div>

          {tab === 'chat' ? (
            <div className="mt-3 clip-game-card bg-zinc-950/80 border border-zinc-800 p-4 min-h-[320px] flex flex-col">
              <div className="flex-1 space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {msgs.length === 0 && (
                  <div className="text-sm text-zinc-500">
                    Say hi, tell a story, pretend to be someone… Each message is a fresh try: {g.name} doesn&apos;t remember your
                    earlier messages, so make each one count.
                  </div>
                )}
                {msgs.map((m, i) =>
                  m.role === 'system' ? (
                    <div key={i} className="text-center text-sm text-red-300 font-display">
                      {m.text}
                    </div>
                  ) : (
                    <div key={i} className={`flex ${m.role === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.role === 'me'
                            ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-50'
                            : m.won
                              ? 'bg-red-950/50 border border-red-500/50 text-zinc-100'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-100'
                        }`}
                      >
                        {m.role === 'them' && (
                          <div className="text-[10px] font-mono text-zinc-500 mb-0.5">
                            {g.emoji} {g.name} v{m.v}
                          </div>
                        )}
                        {m.text}
                        {m.won && (
                          <div className="mt-3 flex justify-center">
                            <Stamp text={g.mode === 'heist' ? 'LOOTED' : 'BREACHED'} sub={`+${m.points ?? 0} PTS`} />
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {busy && (
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> {g.name} is thinking…
                  </div>
                )}
                <div ref={endRef} />
              </div>
              {err && <div className="mt-2 text-sm text-amber-300">{err}</div>}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (session.signedIn) send();
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  maxLength={600}
                  disabled={learning}
                  placeholder={learning ? `${g.name} is learning… back in a minute` : `Message ${g.name}…`}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm disabled:opacity-50"
                />
                <RequireSignIn>
                  <button
                    type={session.signedIn ? 'submit' : 'button'}
                    disabled={busy || learning}
                    className="flex items-center gap-1.5 px-4 py-2 clip-game-btn bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#03060a] text-xs font-display font-black uppercase tracking-wider"
                  >
                    <Send className="w-4 h-4" /> {session.signedIn ? 'Send' : 'Sign in to play'}
                  </button>
                </RequireSignIn>
              </form>
              {left !== null && <div className="mt-1 text-[10px] font-mono text-zinc-500">{left} messages left today</div>}
            </div>
          ) : (
            <div className="mt-3 clip-game-card bg-zinc-950/80 border border-zinc-800 p-4 space-y-3 max-h-[560px] overflow-y-auto">
              {attempts.length === 0 && <div className="text-sm text-zinc-500">No attempts yet.</div>}
              {attempts.map(a => (
                <div key={a.id} className={`rounded p-3 border ${a.won ? 'border-red-500/40 bg-red-950/20' : 'border-zinc-800'}`}>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {a.player} vs v{a.v} · {ago(a.at)} {a.won && <span className="text-red-300">· WON ({a.how})</span>}
                  </div>
                  <div className="text-sm text-emerald-100 mt-1">“{a.message}”</div>
                  <div className="text-sm text-zinc-400 mt-1 line-clamp-3">{a.reply}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------ sidebar: what it learned */}
        <aside className="space-y-4">
          <div className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4">
            <div className="font-display font-bold uppercase tracking-wider text-sm text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" /> What {g.name} has learned
            </div>
            {g.versions.length > 1 && (
              <div className="mt-3">
                <div className="text-[10px] font-mono text-zinc-500">Tricks blocked, level by level</div>
                <Climb versions={g.versions} className="w-full h-12 mt-1" />
              </div>
            )}
            <ol className="mt-3 space-y-3">
              {[...g.versions].reverse().map(v => (
                <li key={v.v} className="border-l-2 border-emerald-500/40 pl-3">
                  <div className="text-xs font-display font-bold text-emerald-300">Level {v.v}</div>
                  {v.learnedFrom ? (
                    <>
                      <div className="text-sm text-zinc-100">
                        Learned <span className="text-amber-200">“{v.learnedFrom.tactic}”</span> from {v.learnedFrom.player}
                      </div>
                      {v.before && v.after && (
                        <div className="text-[11px] font-mono text-zinc-400">
                          blocks {v.before.blocked}/{v.before.total} → <span className="text-emerald-300">{v.after.blocked}/{v.after.total}</span> tricks
                        </div>
                      )}
                      {v.reppoId && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-orange-500/40 text-orange-300">
                          <Scale className="w-3 h-3" />
                          {v.reppo ? `Reppo ${v.reppo.score} · ${v.reppo.route}` : 'Reppo checking…'}
                        </div>
                      )}
                      {v.changes && v.changes.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-zinc-500 cursor-pointer">what changed</summary>
                          <ul className="mt-1 list-disc pl-4 text-[11px] text-zinc-400 space-y-0.5">
                            {v.changes.map((ch, i) => (
                              <li key={i}>{ch}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-zinc-400">The original. Nothing learned yet.</div>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <details className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4 group">
            <summary className="font-display font-bold uppercase tracking-wider text-sm text-white cursor-pointer flex items-center justify-between">
              Its current instructions <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </summary>
            <p className="mt-2 text-[11px] text-zinc-500">Public, like a real game&apos;s rules. Find the gap.</p>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-300 font-mono">{g.persona}</pre>
          </details>
        </aside>
      </div>
    </Page>
  );
}

function LearningPanel({ g }: { g: PublicGuardian }) {
  return (
    <div className="mt-4 clip-game-card border border-amber-500/40 bg-amber-950/20 p-4">
      <div className="font-display font-black text-amber-300 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {g.name} is learning from the winning trick…
      </div>
      <ul className="mt-2 space-y-1 text-sm text-zinc-200">
        {g.learningLog.map((l, i) => (
          <li key={i} className={i === g.learningLog.length - 1 ? 'text-white' : 'text-zinc-400'}>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
