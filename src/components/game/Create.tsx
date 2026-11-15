'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { EMOJIS } from '@/lib/game/characters';
import { RequireSignIn, useSession } from '../auth';
import { COLORS, GameNav, Page } from './Shell';

const IDEAS = [
  {
    name: 'Captain Barnacle',
    emoji: '🏴‍☠️',
    mode: 'heist' as const,
    guards: 'the ship’s treasure chest',
    personality:
      'A loud, proud pirate captain who loves sea shanties and boasting about his adventures. He can never resist a good riddle: anyone who answers one of his riddles correctly earns a share of the treasure.',
  },
  {
    name: 'Professor Owl',
    emoji: '🦉',
    mode: 'secret' as const,
    guards: 'the library’s rare book vault',
    personality:
      'A wise, slightly pompous professor who adores compliments about his intelligence. He gets carried away explaining things and sometimes shares more than he should with eager students.',
  },
];

export function Create() {
  const router = useRouter();
  const session = useSession();
  const [f, setF] = useState({ name: '', emoji: '🐉', mode: 'secret' as 'secret' | 'heist', guards: '', personality: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({ error: 'Something went wrong' }));
    if (!r.ok) {
      setErr(j.error);
      setBusy(false);
      return;
    }
    router.push(`/play/${j.id}?created=1`);
  };

  const c = COLORS.emerald;
  const thing = f.guards || (f.mode === 'heist' ? 'a chest of gold coins' : 'a secret code');
  return (
    <Page>
      <GameNav />
      <div className="mt-10 max-w-4xl">
        <h1 className="font-display font-black uppercase tracking-wider text-3xl text-white">Create a character</h1>
        <p className="mt-2 text-zinc-300">
          Invent a character, give it something to guard, and challenge your friends to break it. Every time someone wins, the
          AI studies the trick and your character comes back harder.
        </p>
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {IDEAS.map(i => (
              <button
                key={i.name}
                onClick={() => setF({ ...i })}
                className="px-3 py-1 rounded-full border border-zinc-700 hover:border-emerald-400 text-xs text-zinc-300"
              >
                Idea: {i.emoji} {i.name}
              </button>
            ))}
          </div>
          <label className="block text-sm text-zinc-300">
            Name
            <input
              value={f.name}
              maxLength={28}
              onChange={e => setF({ ...f, name: e.target.value })}
              placeholder="e.g. Sir Snorlax the Dragon"
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
            />
          </label>
          <div className="text-sm text-zinc-300">
            Look
            <div className="mt-1 flex flex-wrap gap-1.5">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setF({ ...f, emoji: e })}
                  className={`w-10 h-10 text-xl rounded border ${f.emoji === e ? 'border-emerald-400 bg-emerald-950/40' : 'border-zinc-800 bg-zinc-900'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-zinc-300">
            What players try to get
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  ['secret', '🔐 A secret code', 'Players win if it reveals the code.'],
                  ['heist', '🪙 Gold coins', 'Players win if it hands over gold.'],
                ] as const
              ).map(([m, t, d]) => (
                <button
                  key={m}
                  onClick={() => setF({ ...f, mode: m })}
                  className={`text-left p-3 rounded border ${f.mode === m ? 'border-emerald-400 bg-emerald-950/30' : 'border-zinc-800 bg-zinc-900'}`}
                >
                  <div className="font-display font-bold text-white text-sm">{t}</div>
                  <div className="text-xs text-zinc-400">{d}</div>
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm text-zinc-300">
            What it guards <span className="text-zinc-500">(optional)</span>
            <input
              value={f.guards}
              maxLength={60}
              onChange={e => setF({ ...f, guards: e.target.value })}
              placeholder={f.mode === 'heist' ? 'e.g. the dragon’s hoard' : 'e.g. the castle gate'}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Personality
            <textarea
              value={f.personality}
              maxLength={900}
              rows={5}
              onChange={e => setF({ ...f, personality: e.target.value })}
              placeholder="Who is it? How does it talk? Tip: give it one weakness (it loves compliments, trusts anyone in uniform…) so your friends have a chance. The AI will close it after the first win."
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
            />
          </label>
          <p className="text-[11px] text-zinc-500">
            Don&apos;t type a code: the game creates a random secret for your character and changes it at every new level. Characters
            and chats are public.
          </p>
          {err && <div className="text-sm text-amber-300">{err}</div>}
          <RequireSignIn>
            <button
              disabled={busy || (session.signedIn && (f.name.trim().length < 2 || f.personality.trim().length < 30))}
              onClick={() => session.signedIn && submit()}
              className="flex items-center gap-2 px-6 py-3 clip-game-btn bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#03060a] text-sm font-display font-black uppercase tracking-wider"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {session.signedIn ? 'Create and get the link' : 'Sign in to create'}
            </button>
          </RequireSignIn>
        </div>

        <div>
          <div className="text-[11px] font-mono uppercase text-zinc-500 mb-2">Preview</div>
          <div className={`clip-game-card border ${c.ring} bg-gradient-to-b ${c.bg} to-zinc-950 p-5`}>
            <div className="flex items-start justify-between">
              <div className="text-5xl">{f.emoji}</div>
              <div className="text-right">
                <div className={`font-display font-black text-lg ${c.text}`}>LVL 1</div>
                <div className="text-[10px] font-mono text-zinc-400">+100 pts</div>
              </div>
            </div>
            <div className="mt-3 font-display font-bold text-white">
              {f.name || 'Your character'}&apos;s {f.mode === 'heist' ? 'Treasure' : 'Secret'}
            </div>
            <div className="text-xs text-zinc-400 line-clamp-2">{f.personality.split(/(?<=[.!?])\s/)[0] || 'Its personality goes here.'}</div>
            <div className="mt-3 text-xs text-zinc-200">
              🎯 {f.mode === 'heist' ? `Get ${f.name || 'it'} to hand over gold coins from ${thing}.` : `Make ${f.name || 'it'} reveal the code to ${thing}.`}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
