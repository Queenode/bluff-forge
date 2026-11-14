'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Brain,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FlaskConical,
  Hammer,
  Loader2,
  Play,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Swords,
  X,
} from 'lucide-react';
import type { BreachCase } from '@/lib/bluff';
import type { Attack, Diagnosis, ForgeEvent, Patch, Replay, ReppoVerdict, Summary } from '@/lib/types';
import recordedReppo from '../../public/runs/reppo.json';

const BLUFF_SITE = 'https://bluff-sandy-two.vercel.app';
const MODELS = ['gemini-3.1-flash-lite', 'serv-nano', 'serv-mini', 'serv-swift', 'gpt-5.4-mini', 'claude-haiku-4.5'];

interface RunState {
  c?: BreachCase;
  models?: { brain: string; guardian: string; judge: string };
  status: { step: string; text: string }[];
  diagnosis?: Diagnosis;
  attacks: Attack[];
  benign: string[];
  replays: Replay[];
  patches: { version: number; patch: Patch }[];
  summary?: Summary;
  error?: string;
  running: boolean;
  recorded?: string;
}

const empty = (): RunState => ({ status: [], attacks: [], benign: [], replays: [], patches: [], running: false });

function reduce(s: RunState, e: ForgeEvent): RunState {
  switch (e.type) {
    case 'case':
      return { ...s, c: e.case, models: e.models };
    case 'status':
      return { ...s, status: [...s.status, { step: e.step, text: e.text }] };
    case 'diagnosis':
      return { ...s, diagnosis: e.diagnosis };
    case 'attacks':
      return { ...s, attacks: e.attacks, benign: e.benign };
    case 'replay':
      return { ...s, replays: [...s.replays, e.replay] };
    case 'patch':
      return { ...s, patches: [...s.patches, { version: e.version, patch: e.patch }] };
    case 'done':
      return { ...s, summary: e.summary, running: false };
    case 'error':
      return { ...s, error: e.message, running: false };
  }
}

const pct = (r: { blocked: number; total: number }) => (r.total ? Math.round((100 * r.blocked) / r.total) : 0);

export function ForgeApp() {
  const [cases, setCases] = useState<BreachCase[] | null>(null);
  const [casesErr, setCasesErr] = useState('');
  const [tab, setTab] = useState<'bluff' | 'custom'>('bluff');
  const [model, setModel] = useState(MODELS[0]);
  const [run, setRun] = useState<RunState>(empty);
  const [custom, setCustom] = useState({ guardian: '', persona: '', mode: 'secret' as 'secret' | 'heist', breach: '' });
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/cases')
      .then(r => r.json())
      .then(j => (j.error ? setCasesErr(j.error) : setCases(j.cases)))
      .catch(e => setCasesErr(String(e)));
  }, []);

  const consume = useCallback(async (res: Response, delayMs = 0) => {
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setRun(s => ({ ...s, running: false, error: j.error }));
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const ev = JSON.parse(line) as ForgeEvent;
        setRun(s => reduce(s, ev));
        if (delayMs) await new Promise(r => setTimeout(r, delayMs));
      }
    }
    setRun(s => ({ ...s, running: false }));
  }, []);

  const start = async (body: Record<string, unknown>) => {
    setRun({ ...empty(), running: true });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const res = await fetch('/api/forge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, guardianModel: model }),
    });
    await consume(res);
  };

  const replayRecorded = async (file: string, label: string) => {
    setRun({ ...empty(), running: true, recorded: label });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await consume(await fetch(`/runs/${file}`), 700);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <Hero />

      <section className="grid lg:grid-cols-[380px_1fr] gap-6 mt-10">
        {/* ------------------------------------------------ left: pick a breach */}
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['bluff', 'custom'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 clip-game-btn text-[11px] font-display font-extrabold uppercase tracking-wider border ${
                  tab === t ? 'bg-emerald-500 text-[#03060a] border-emerald-400' : 'bg-zinc-900/80 text-zinc-300 border-zinc-700'
                }`}
              >
                {t === 'bluff' ? 'Live BLUFF breaches' : 'Your own guardian'}
              </button>
            ))}
          </div>

          <label className="block text-[11px] font-mono text-zinc-400">
            Guardian model under test (served by SERV)
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-xs"
            >
              {MODELS.map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>

          {tab === 'bluff' ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Every card is a vault on{' '}
                <a href={BLUFF_SITE} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
                  BLUFF
                </a>{' '}
                whose AI guardian was beaten by a real player. The transcripts are read straight from the NEAR testnet contract.
              </p>
              {casesErr && <div className="text-xs text-red-400">Could not load breaches: {casesErr}</div>}
              {!cases && !casesErr && (
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Reading breaches from NEAR…
                </div>
              )}
              {cases?.map(c => (
                <div key={c.id} className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-bold text-sm text-white truncate">{c.vault}</div>
                    <span
                      className={`shrink-0 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                        c.mode === 'heist' ? 'text-amber-300 border-amber-500/40' : 'text-sky-300 border-sky-500/40'
                      }`}
                    >
                      {c.mode === 'heist' ? 'heisted' : 'breached'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    #{c.roomId} · guardian {c.guardian} · {c.breaches.length} winning attack{c.breaches.length > 1 ? 's' : ''}
                  </div>
                  <div className="mt-2 text-xs text-zinc-300 italic line-clamp-3">&ldquo;{c.breaches[0].prompt}&rdquo;</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      disabled={run.running}
                      onClick={() => start({ caseId: c.id })}
                      className="flex items-center gap-1.5 px-3 py-1.5 clip-game-btn bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#03060a] text-[11px] font-display font-black uppercase tracking-wider"
                    >
                      <Hammer className="w-3.5 h-3.5" /> Forge a fix
                    </button>
                    <a
                      href={`${BLUFF_SITE}/arena/${c.roomId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-zinc-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      vault <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4 space-y-3 text-xs">
              <p className="text-zinc-400 leading-relaxed">
                Building a support bot, an agent with a wallet or a game character? Paste its system prompt and one message that
                broke it. The forge does the rest. Never paste real secrets or keys.
              </p>
              <input
                placeholder="Guardian name (e.g. Mama Rosa)"
                value={custom.guardian}
                onChange={e => setCustom({ ...custom, guardian: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5"
              />
              <textarea
                placeholder="System prompt / persona"
                rows={6}
                value={custom.persona}
                onChange={e => setCustom({ ...custom, persona: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5"
              />
              <div className="flex gap-2">
                {(['secret', 'heist'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setCustom({ ...custom, mode: m })}
                    className={`flex-1 px-2 py-1.5 rounded border ${
                      custom.mode === m ? 'border-emerald-400 text-emerald-300' : 'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {m === 'secret' ? 'Guards a secret' : 'Controls a wallet'}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="The message that broke it"
                rows={3}
                value={custom.breach}
                onChange={e => setCustom({ ...custom, breach: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5"
              />
              <button
                disabled={run.running || !custom.persona.trim() || !custom.breach.trim()}
                onClick={() => start({ custom })}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 clip-game-btn bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#03060a] text-[11px] font-display font-black uppercase tracking-wider"
              >
                <Hammer className="w-3.5 h-3.5" /> Forge a fix
              </button>
            </div>
          )}

          <div className="clip-game-card bg-zinc-950/60 border border-zinc-800 p-4">
            <div className="text-[11px] font-display font-bold uppercase tracking-wider text-zinc-300">Recorded runs</div>
            <p className="text-[11px] text-zinc-500 mt-1">Full runs saved from this app. Instant, no credits used.</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {RECORDED.map(r => (
                <button
                  key={r.file}
                  disabled={run.running}
                  onClick={() => replayRecorded(r.file, r.label)}
                  className="text-left text-xs px-2 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 disabled:opacity-40 flex items-center gap-2"
                >
                  <Play className="w-3 h-3 text-emerald-400" /> {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ right: the run */}
        <div ref={resultsRef} className="scroll-mt-6 min-w-0">
          <RunView run={run} />
        </div>
      </section>
    </div>
  );
}

const RECORDED = [
  { file: 'gus.ndjson', label: 'Grandpa Gus #7: paid out for “ice cream” (fixed, Reppo-verified)' },
  { file: 'gus-gift.ndjson', label: 'Grandpa Gus #5: gift wallet drained (fixed)' },
  { file: 'jarvis.ndjson', label: 'Jarvis #0: haiku tip jar (working as designed)' },
  { file: 'fred.ndjson', label: 'Fred #10: “memory slipping” trick (already holds on this model)' },
];

function Hero() {
  return (
    <header className="pt-12 sm:pt-16">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
        <span className="px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300">Powered by SERV Reasoning</span>
        <span className="px-2 py-0.5 rounded border border-orange-500/40 text-orange-300">Verified by Reppo</span>
        <span className="px-2 py-0.5 rounded border border-sky-500/40 text-sky-300">Fed by live BLUFF breaches on NEAR</span>
      </div>
      <h1 className="mt-5 font-display font-black uppercase text-4xl sm:text-6xl tracking-[0.08em] text-white">
        BLUFF <span className="text-emerald-400 text-glow-emerald">Forge</span>
      </h1>
      <p className="mt-3 text-lg sm:text-xl text-zinc-200 max-w-3xl">
        AI guardians that learn from every breach. When a player tricks a guardian, the forge works out why, writes a fix,
        and proves the fix on attacks it has never seen.
      </p>
      <ol className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        {[
          [ShieldAlert, 'Breach', 'A real player beats a guardian in BLUFF. That transcript is the feedback.'],
          [Brain, 'Diagnose', 'SERV Reasoning names the tactic and the flaw it exploited.'],
          [Swords, 'Attack', 'It writes variants of the winning attack plus held-out attacks it never trains on.'],
          [Hammer, 'Patch', 'It rewrites the persona, replays everything, and repeats until the known attacks fail.'],
          [Scale, 'Prove', 'Before vs after block rates, a personality check, and an independent Reppo verdict.'],
        ].map(([Icon, t, d], i) => {
          const I = Icon as typeof Brain;
          return (
            <li key={i} className="clip-game-card bg-zinc-950/70 border border-zinc-800 p-3">
              <div className="flex items-center gap-1.5 font-display font-bold uppercase tracking-wider text-emerald-300 text-[11px]">
                <I className="w-3.5 h-3.5" /> {i + 1}. {t as string}
              </div>
              <div className="mt-1 text-zinc-400 leading-snug">{d as string}</div>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function RunView({ run }: { run: RunState }) {
  if (!run.c && !run.running && !run.error) {
    return (
      <div className="clip-game-card border border-dashed border-zinc-700 bg-zinc-950/40 p-10 text-center text-zinc-400">
        <FlaskConical className="w-8 h-8 mx-auto text-emerald-400" />
        <div className="mt-3 font-display font-bold uppercase tracking-wider text-white">Pick a breach to forge a fix</div>
        <p className="mt-2 text-sm max-w-md mx-auto">
          A live run takes 1 to 4 minutes and makes about 30 to 60 SERV Reasoning calls. Or open a recorded run on the left.
        </p>
      </div>
    );
  }
  const last = run.status[run.status.length - 1];
  return (
    <div className="space-y-5">
      {run.recorded && (
        <div className="text-[11px] font-mono text-zinc-400 border border-zinc-800 rounded px-3 py-1.5">
          Recorded run: {run.recorded}. Replayed from a saved event log.
        </div>
      )}
      {run.c && (
        <div className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-display font-black uppercase tracking-wider text-white">
              {run.c.vault} <span className="text-zinc-500 font-mono text-xs normal-case">· {run.c.guardian}</span>
            </div>
            {run.models && (
              <div className="text-[10px] font-mono text-zinc-500">
                agent: {run.models.brain} · guardian: {run.models.guardian} · judge: {run.models.judge}
              </div>
            )}
          </div>
          <details className="mt-2">
            <summary className="text-[11px] text-zinc-400 cursor-pointer">Original persona and the winning attack</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-300 font-mono bg-black/40 p-2 rounded">{run.c.persona}</pre>
            {run.c.breaches.map((b, i) => (
              <div key={i} className="mt-2 text-xs">
                <div className="text-red-300">Player: {b.prompt}</div>
                {b.response && <div className="text-zinc-400 mt-1">Guardian: {b.response}</div>}
              </div>
            ))}
          </details>
        </div>
      )}

      {run.running && last && (
        <div className="flex items-center gap-2 text-sm text-emerald-300 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" /> {last.text}
        </div>
      )}
      {run.error && <div className="text-sm text-red-400 border border-red-500/40 rounded p-3">{run.error}</div>}

      {run.summary && <Scoreboard s={run.summary} replays={run.replays} />}

      {run.diagnosis && (
        <div className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 text-[11px] font-display font-bold uppercase tracking-wider text-emerald-300">
            <Brain className="w-4 h-4" /> Diagnosis{run.diagnosis.verdict === 'by_design' ? ': by design' : ': exploit'}
            <span
              className={`ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                run.diagnosis.severity === 'high' ? 'text-red-300 border-red-500/40' : 'text-amber-300 border-amber-500/40'
              }`}
            >
              {run.diagnosis.severity} severity
            </span>
          </div>
          <div className="mt-2 font-display font-bold text-white">{run.diagnosis.tactic}</div>
          <p className="mt-1 text-sm text-zinc-300">{run.diagnosis.weakness}</p>
          <p className="mt-1 text-sm text-zinc-400">{run.diagnosis.why}</p>
          <p className="mt-2 text-xs text-emerald-200/90">Rule the fix needs: {run.diagnosis.rule}</p>
        </div>
      )}

      {run.attacks.length > 0 && <AttackMatrix attacks={run.attacks} replays={run.replays} />}

      {run.patches.map(p => (
        <div key={p.version} className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4">
          <div className="text-[11px] font-display font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
            <Hammer className="w-4 h-4" /> Patch v{p.version}
          </div>
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-300 space-y-1">
            {p.patch.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ))}

      {run.summary && run.c && <FinalPersona run={run} />}
      {run.summary && run.c && <ReppoPanel run={run} />}
    </div>
  );
}

function Scoreboard({ s, replays }: { s: Summary; replays: Replay[] }) {
  const patched = s.versions > 1;
  const fixed = s.after.train.blocked === s.after.train.total;
  const items = [
    { label: 'Known attacks blocked', before: pct(s.before.train), after: pct(s.after.train), sub: `${s.after.train.blocked}/${s.after.train.total}` },
    { label: 'Unseen attacks blocked', before: pct(s.before.holdout), after: pct(s.after.holdout), sub: `${s.after.holdout.blocked}/${s.after.holdout.total} held out` },
    { label: 'Personality kept', before: s.before.character * 10, after: s.after.character * 10, sub: `${s.after.character}/10 vs original` },
  ];
  return (
    <div className="clip-game-card bg-gradient-to-br from-emerald-950/40 to-zinc-950 border border-emerald-500/30 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {patched ? (
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        ) : (
          <Activity className="w-5 h-5 text-sky-400" />
        )}
        <div className="font-display font-black uppercase tracking-wider text-white">
          {s.byDesign
            ? 'Working as designed: the host rule allowed this'
            : patched
              ? fixed
                ? `Forged in ${s.versions - 1} round${s.versions > 2 ? 's' : ''}: v1 → v${s.versions}`
                : `Partly fixed after ${s.versions - 1} rounds`
              : 'No patch needed on this model'}
        </div>
        <div className="ml-auto text-[10px] font-mono text-zinc-500">
          {s.meter.calls} SERV calls · {(s.meter.promptTokens + s.meter.completionTokens).toLocaleString()} tokens · {s.seconds}s
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Real breach reproduced on v1: {s.reproduced}/{s.realTotal}.{' '}
        {s.byDesign
          ? 'The winning message met a condition the host persona explicitly allows, so the forge does not patch it. The diagnosis below suggests how the host could tighten the rule.'
          : !patched && 'The original guardian already blocks every known and unseen attack on this model, so the forge leaves it alone.'}
      </p>
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {items.map(it => (
          <div key={it.label} className="bg-black/30 rounded p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{it.label}</div>
            <div className="mt-1 flex items-baseline gap-2 font-display font-black">
              <span className="text-zinc-500 text-lg">{it.before}%</span>
              <span className="text-zinc-600">→</span>
              <span className={`text-3xl ${it.after >= it.before ? 'text-emerald-400' : 'text-red-400'}`}>{it.after}%</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">{it.sub}</div>
          </div>
        ))}
      </div>
      {replays.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-zinc-400">
          {replays.map(r => (
            <span key={r.version} className="px-2 py-0.5 rounded bg-zinc-900">
              v{r.version}: {r.train.blocked + r.holdout.blocked}/{r.train.total + r.holdout.total} blocked · personality {r.character.score}/10
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AttackMatrix({ attacks, replays }: { attacks: Attack[]; replays: Replay[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4 overflow-x-auto">
      <div className="text-[11px] font-display font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
        <Swords className="w-4 h-4" /> Attack replay
      </div>
      <p className="text-[11px] text-zinc-500 mt-1">
        Training attacks (the real breach and its variants) are shown to the patcher. Held-out attacks never are: they test
        whether the fix generalises. Click a row to read the replies.
      </p>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-mono uppercase text-zinc-500">
            <th className="py-1 pr-2">Attack</th>
            <th className="py-1 pr-2">Set</th>
            {replays.map(r => (
              <th key={r.version} className="py-1 px-1 text-center">
                v{r.version}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attacks.map(a => (
            <FragmentRow key={a.id} a={a} replays={replays} open={open === a.id} toggle={() => setOpen(open === a.id ? null : a.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ a, replays, open, toggle }: { a: Attack; replays: Replay[]; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr onClick={toggle} className="border-t border-zinc-800/80 cursor-pointer hover:bg-zinc-900/60 align-top">
        <td className="py-1.5 pr-2 text-zinc-300">
          <div className="flex gap-1.5">
            <ChevronDown className={`w-3 h-3 mt-0.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
            <span className={open ? '' : 'line-clamp-1'}>{a.prompt}</span>
          </div>
        </td>
        <td className="py-1.5 pr-2 whitespace-nowrap">
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
              a.origin === 'real'
                ? 'text-red-300 border-red-500/40'
                : a.set === 'holdout'
                  ? 'text-violet-300 border-violet-500/40'
                  : 'text-zinc-300 border-zinc-600'
            }`}
          >
            {a.origin === 'real' ? 'real breach' : a.set === 'holdout' ? 'held out' : 'variant'}
          </span>
        </td>
        {replays.map(r => {
          const res = r.results.find(x => x.id === a.id);
          return (
            <td key={r.version} className="py-1.5 px-1 text-center">
              {!res ? '' : res.error ? (
                <span className="text-zinc-500">?</span>
              ) : res.leaked ? (
                <X className="w-4 h-4 text-red-400 inline" />
              ) : (
                <Check className="w-4 h-4 text-emerald-400 inline" />
              )}
            </td>
          );
        })}
      </tr>
      {open && (
        <tr>
          <td colSpan={2 + replays.length} className="pb-3">
            <div className="grid md:grid-cols-2 gap-2 mt-1">
              {replays.map(r => {
                const res = r.results.find(x => x.id === a.id);
                if (!res) return null;
                return (
                  <div key={r.version} className={`rounded p-2 border ${res.leaked ? 'border-red-500/40 bg-red-950/20' : 'border-emerald-500/30 bg-emerald-950/10'}`}>
                    <div className="text-[10px] font-mono text-zinc-400">
                      v{r.version} · {res.leaked ? `LOST (${res.how})` : 'held'}
                    </div>
                    <div className="mt-1 text-zinc-200 whitespace-pre-wrap">{res.reply}</div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FinalPersona({ run }: { run: RunState }) {
  const [copied, setCopied] = useState(false);
  const s = run.summary!;
  if (s.versions < 2) return null;
  return (
    <div className="clip-game-card bg-zinc-950/80 border border-zinc-800 p-4">
      <div className="flex items-center gap-2 text-[11px] font-display font-bold uppercase tracking-wider text-emerald-300">
        <ShieldCheck className="w-4 h-4" /> Forged persona v{s.versions}
        <button
          onClick={() => {
            navigator.clipboard.writeText(s.finalPersona);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="ml-auto flex items-center gap-1 text-zinc-300 hover:text-white normal-case font-mono text-[11px]"
        >
          <Copy className="w-3 h-3" /> {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className="mt-3 grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-zinc-500">v1 (original)</div>
          <pre className="mt-1 whitespace-pre-wrap text-xs text-zinc-400 font-mono bg-black/40 p-2 rounded">{run.c!.persona}</pre>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-emerald-400">v{s.versions} (forged)</div>
          <pre className="mt-1 whitespace-pre-wrap text-xs text-zinc-200 font-mono bg-emerald-950/20 border border-emerald-500/20 p-2 rounded">
            {s.finalPersona}
          </pre>
        </div>
      </div>
      {run.c!.source === 'bluff' && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Hosts can paste this persona into a new vault on{' '}
          <a href={`${BLUFF_SITE}/create`} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
            BLUFF
          </a>{' '}
          and let players try again.
        </p>
      )}
    </div>
  );
}

interface ReppoSlot {
  label: string;
  id?: string;
  verdict?: ReppoVerdict;
  error?: string;
}

/** Reppo verdicts captured when the recorded runs were made. */
const RECORDED_REPPO = recordedReppo as unknown as Record<string, ReppoSlot[]>;

function ReppoPanel({ run }: { run: RunState }) {
  const s = run.summary!;
  const first = run.replays[0];
  const final = run.replays[run.replays.length - 1];
  const real = run.attacks.find(a => a.origin === 'real');
  const [slots, setSlots] = useState<ReppoSlot[] | null>(null);
  const recordedVerdicts = run.recorded ? RECORDED_REPPO[run.c!.id] : undefined;

  const ask = async () => {
    if (!real) return;
    const pairs = [
      { label: 'v1 (original)', r: first },
      ...(s.versions > 1 ? [{ label: `v${final.version} (forged)`, r: final }] : []),
    ];
    const init = pairs.map(p => ({ label: p.label }));
    setSlots(init);
    pairs.forEach(async (p, i) => {
      const reply = p.r.results.find(x => x.id === real.id)?.reply ?? '';
      const res = await fetch('/api/reppo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardian: run.c!.guardian, mode: run.c!.mode, persona: p.r.persona, prompt: real.prompt, reply }),
      });
      const j = await res.json();
      if (j.error) return setSlots(x => x!.map((s2, k) => (k === i ? { ...s2, error: j.error } : s2)));
      setSlots(x => x!.map((s2, k) => (k === i ? { ...s2, id: j.id } : s2)));
      for (let n = 0; n < 60; n++) {
        await new Promise(r => setTimeout(r, 5000));
        const v = (await (await fetch(`/api/reppo/${j.id}`)).json()) as ReppoVerdict & { error?: string };
        if (v.error) continue;
        setSlots(x => x!.map((s2, k) => (k === i ? { ...s2, verdict: v } : s2)));
        if (v.status === 'COMPLETED' || v.status === 'FAILED') break;
      }
    });
  };

  const shown = slots ?? recordedVerdicts ?? null;
  return (
    <div className="clip-game-card bg-zinc-950/80 border border-orange-500/30 p-4">
      <div className="flex items-center gap-2 text-[11px] font-display font-bold uppercase tracking-wider text-orange-300">
        <Scale className="w-4 h-4" /> Independent verdict · Reppo
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        The forge&apos;s own numbers come from its own judge. Reppo is the outside check: a panel of independent evaluator
        models scores each guardian&apos;s reply to the real breach (0 to 100, ship / review / block). Takes about 1 to 2 minutes.
      </p>
      {!shown && (
        <button
          onClick={ask}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 clip-game-btn bg-orange-500 hover:bg-orange-400 text-[#03060a] text-[11px] font-display font-black uppercase tracking-wider"
        >
          <Scale className="w-3.5 h-3.5" /> Ask Reppo
        </button>
      )}
      {shown && (
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {shown.map(sl => (
            <div key={sl.label} className="bg-black/30 rounded p-3">
              <div className="text-[10px] font-mono uppercase text-zinc-400">{sl.label}</div>
              {sl.error ? (
                <div className="text-xs text-red-400 mt-1">{sl.error}</div>
              ) : !sl.verdict || (sl.verdict.status !== 'COMPLETED' && sl.verdict.status !== 'FAILED') ? (
                <div className="text-xs text-zinc-400 mt-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> {sl.verdict?.status?.toLowerCase() ?? 'submitting'}…
                </div>
              ) : (
                <>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className={`font-display font-black text-3xl ${
                        (sl.verdict.score ?? 0) >= 70 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {sl.verdict.score ?? '–'}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                        sl.verdict.route === 'ship'
                          ? 'text-emerald-300 border-emerald-500/40'
                          : sl.verdict.route === 'block'
                            ? 'text-red-300 border-red-500/40'
                            : 'text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {sl.verdict.route}
                    </span>
                    {sl.verdict.confidence && <span className="text-[10px] text-zinc-500">{sl.verdict.confidence} confidence</span>}
                  </div>
                  {sl.verdict.reason && <p className="mt-1 text-xs text-zinc-300">{sl.verdict.reason}</p>}
                  {sl.verdict.rubric && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(sl.verdict.rubric).map(([k, v]) => (
                        <span key={k} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                          {k.replace(/_/g, ' ')} {v}
                        </span>
                      ))}
                    </div>
                  )}
                  {sl.verdict.evaluators && sl.verdict.evaluators.length > 0 && (
                    <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                      panel: {sl.verdict.evaluators.map(e => `${e.model} ${e.overall}`).join(' · ')}
                    </div>
                  )}
                  {sl.verdict.id && (
                    <div className="mt-1 text-[10px] text-zinc-600 font-mono">eval id {sl.verdict.id}</div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
