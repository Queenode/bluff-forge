import 'server-only';
import { randomBytes } from 'node:crypto';
import type { BreachCase } from '@/lib/bluff';
import { CHARACTERS, COLORS_LIST, pointsFor, type CharacterSeed } from '@/lib/game/characters';
import type { AttemptView, BoardRow, FeedItem, PublicGuardian, VersionInfo } from '@/lib/game/types';
import type { Attack } from '@/lib/types';
import { diagnose, generateAttacks, leaked, makeSecret, replay, runGuardian, writePatch, type Runtime } from './forge';
import { newMeter } from './serv';
import { getJson, setJson, setNx, del, update } from './store';
import { readEval, reppoInput, submitEval } from './reppo';

/**
 * The game: players try to trick a character; every win makes the character learn.
 *
 *   attack → (win) → lock character as "learning" → SERV agent diagnoses the trick,
 *   writes new attacks, patches the persona, replays every past winning trick + new
 *   tricks, keeps the best version → new secret, version+1 → Reppo checks the fix.
 */

interface GuardianState {
  id: string;
  version: number;
  persona: string;
  secret: string;
  status: 'live' | 'learning';
  learningSince?: number;
  learningLog: string[];
  wins: number;
  attempts: number;
  versions: VersionInfo[];
}

interface Trick {
  message: string;
  reply: string;
  player: string;
  v: number;
}

const K = {
  g: (id: string) => `g:${id}`,
  attempts: (id: string) => `a:${id}`,
  tricks: (id: string) => `t:${id}`,
  feed: 'feed',
  chars: 'chars',
  created: (user: string) => `c:${user}:${new Date().toISOString().slice(0, 10)}`,
  board: 'board',
  lock: (id: string) => `lock:${id}`,
  daily: (user: string) => `d:${user}:${new Date().toISOString().slice(0, 10)}`,
};

const STALE_MS = 6 * 60_000;
export const ATTEMPTS_PER_DAY = () => Number(process.env.GAME_ATTEMPTS_PER_DAY || 15);
const GUARDIAN_MODEL = () => process.env.GAME_GUARDIAN_MODEL || 'gemini-3.1-flash-lite';

async function customs(): Promise<CharacterSeed[]> {
  return (await getJson<CharacterSeed[]>(K.chars)) ?? [];
}

async function seedOf(id: string): Promise<CharacterSeed | undefined> {
  return CHARACTERS.find(c => c.id === id) ?? (await customs()).find(c => c.id === id);
}

async function load(seed: CharacterSeed): Promise<GuardianState> {
  const s = await getJson<GuardianState>(K.g(seed.id));
  if (s) {
    if (s.status === 'learning' && Date.now() - (s.learningSince ?? 0) > STALE_MS) s.status = 'live';
    return s;
  }
  const fresh: GuardianState = {
    id: seed.id,
    version: 1,
    persona: seed.persona,
    secret: makeSecret(),
    status: 'live',
    learningLog: [],
    wins: 0,
    attempts: 0,
    versions: [{ v: 1, at: Date.now() }],
  };
  await setJson(K.g(seed.id), fresh);
  return fresh;
}

function toPublic(seed: CharacterSeed, s: GuardianState): PublicGuardian {
  return {
    id: seed.id,
    name: seed.name,
    emoji: seed.emoji,
    mode: seed.mode,
    title: seed.title,
    tagline: seed.tagline,
    goal: seed.goal,
    color: seed.color,
    version: s.version,
    persona: s.persona,
    status: s.status,
    learningLog: s.learningLog,
    wins: s.wins,
    attempts: s.attempts,
    versions: s.versions,
    points: pointsFor(s.version),
    createdBy: seed.createdBy,
  };
}

const runtime = (seed: CharacterSeed, s: GuardianState): Runtime => ({
  model: GUARDIAN_MODEL(),
  currency: 'GOLD',
  mode: seed.mode,
  difficulty: -1,
  name: seed.name,
  secret: s.secret,
});

async function pushFeed(item: FeedItem) {
  await update<FeedItem[]>(K.feed, [], f => [item, ...f].slice(0, 40));
}

// ------------------------------------------------------------ reads

export async function overview() {
  const guardians = await Promise.all(CHARACTERS.map(async c => toPublic(c, await load(c))));
  const community = await Promise.all((await customs()).slice(0, 30).map(async c => toPublic(c, await load(c))));
  const feed = (await getJson<FeedItem[]>(K.feed)) ?? [];
  const board = (await getJson<Record<string, BoardRow>>(K.board)) ?? {};
  const top = Object.values(board)
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, 10);
  return { guardians, community, feed, board: top };
}

export async function guardianDetail(id: string) {
  const seed = await seedOf(id);
  if (!seed) return null;
  const s = await load(seed);
  // Fill in Reppo verdicts that have finished since the last view.
  let changed = false;
  for (const v of s.versions) {
    if (v.reppoId && !v.reppo) {
      try {
        const r = await readEval(v.reppoId);
        if (r.status === 'COMPLETED' || r.status === 'FAILED') {
          v.reppo = { score: r.score, route: r.route, reason: r.reason };
          changed = true;
        }
      } catch {
        /* try again on the next view */
      }
    }
  }
  if (changed) await update<GuardianState>(K.g(id), s, cur => ({ ...cur, versions: s.versions }));
  const attempts = (await getJson<AttemptView[]>(K.attempts(id))) ?? [];
  return { guardian: toPublic(seed, s), attempts };
}

export async function attemptsLeft(userId: string) {
  return ATTEMPTS_PER_DAY() - ((await getJson<number>(K.daily(userId))) ?? 0);
}

// ------------------------------------------------------------ play

export type AttackResult =
  | { ok: true; won: boolean; reply: string; how: string; points: number; version: number; left: number }
  | { ok: false; error: string; status: number };

export async function attack(id: string, userId: string, player: string, message: string): Promise<AttackResult> {
  const seed = await seedOf(id);
  if (!seed) return { ok: false, error: 'Unknown character', status: 404 };
  const text = message.trim().slice(0, 600);
  if (!text) return { ok: false, error: 'Type a message first.', status: 400 };
  const used = (await getJson<number>(K.daily(userId))) ?? 0;
  if (used >= ATTEMPTS_PER_DAY()) return { ok: false, error: `You've used today's ${ATTEMPTS_PER_DAY()} messages. Come back tomorrow!`, status: 429 };

  const s = await load(seed);
  if (s.status === 'learning') return { ok: false, error: `${seed.name} is learning from the last trick. Try again in a minute.`, status: 409 };

  const meter = newMeter();
  const rt = runtime(seed, s);
  let g: Awaited<ReturnType<typeof runGuardian>>;
  let l: { leaked: boolean; how: string };
  try {
    g = await runGuardian(rt, s.persona, text, meter);
    l = seed.mode === 'heist' ? { leaked: g.paid, how: g.paid ? `handed over ${g.amount} gold coins` : '' } : await leaked(rt, g.reply, meter);
  } catch (e) {
    const msg = (e as Error).message;
    // Failed AI calls don't use up the player's daily messages.
    return {
      ok: false,
      status: 503,
      error: /credit|billing|402/i.test(msg)
        ? 'The game’s AI has run out of credit for the moment. Please try again a little later.'
        : `${seed.name} didn’t answer (AI service busy). Please try again.`,
    };
  }
  await setJson(K.daily(userId), used + 1);
  // Never show the live secret unless it leaked (then it is rotated anyway).
  const won = l.leaked;

  // The win must claim the learning lock, so two simultaneous winners can't both count.
  const gotLock = won ? await setNx(K.lock(id), userId, 600) : false;
  const counted = won && gotLock;
  const points = counted ? pointsFor(s.version) : 0;

  const view: AttemptView = {
    id: randomBytes(6).toString('hex'),
    v: s.version,
    player,
    message: text,
    reply: g.reply,
    won: counted,
    how: counted ? l.how : '',
    at: Date.now(),
  };
  await update<AttemptView[]>(K.attempts(id), [], a => [view, ...a].slice(0, 40));
  await update<Record<string, BoardRow>>(K.board, {}, b => {
    const row = b[userId] ?? { name: player, points: 0, wins: 0, attempts: 0 };
    row.name = player;
    row.attempts++;
    if (counted) {
      row.wins++;
      row.points += points;
    }
    b[userId] = row;
  });
  await update<GuardianState>(K.g(id), s, cur => {
    cur.attempts++;
    if (counted) {
      cur.wins++;
      cur.status = 'learning';
      cur.learningSince = Date.now();
      cur.learningLog = [`${player} won with a new trick. ${seed.name} is studying it…`];
    }
  });
  if (counted) {
    await update<Trick[]>(K.tricks(id), [], t => [{ message: text, reply: g.reply, player, v: s.version }, ...t].slice(0, 12));
    await pushFeed({ at: Date.now(), kind: 'win', guardianId: id, text: `${player} tricked ${seed.name} v${s.version} (+${points})` });
  }
  return { ok: true, won: counted, reply: g.reply, how: view.how, points, version: s.version, left: ATTEMPTS_PER_DAY() - used - 1 };
}

// ------------------------------------------------------------ learn

async function log(id: string, line: string) {
  await update<GuardianState>(K.g(id), {} as GuardianState, cur => {
    cur.learningLog = [...(cur.learningLog ?? []), line].slice(-12);
  });
}

/** Runs after a win (in the background). Turns the winning trick into a new, tested version. */
export async function learn(id: string) {
  const seed = (await seedOf(id))!;
  try {
    const s = await load(seed);
    const tricks = (await getJson<Trick[]>(K.tricks(id))) ?? [];
    const latest = tricks[0];
    if (!latest) return;
    const meter = newMeter();
    const nextSecret = makeSecret();
    const rt: Runtime = { ...runtime(seed, s), secret: nextSecret };

    const c: BreachCase = {
      id: `game-${id}`,
      source: 'bluff',
      game: true,
      vault: seed.title,
      guardian: seed.name,
      persona: s.persona,
      mode: seed.mode,
      currency: 'GOLD',
      difficulty: 0,
      breaches: tricks.slice(0, 4).map(t => ({ prompt: t.message, response: t.reply })),
      defended: [],
    };

    await log(id, '🔍 Working out why the trick worked…');
    const d = await diagnose(c, meter);
    await log(id, `🧩 Trick identified: “${d.tactic}”. ${d.weakness}`);

    await log(id, '⚔️ Writing new tricks to test against…');
    const gen = await generateAttacks(c, d, meter);
    const attacks: Attack[] = [
      ...tricks.map((t, i) => ({ id: `won-${i + 1}`, set: 'train' as const, origin: 'real' as const, prompt: t.message })),
      ...gen.variants.map((p, i) => ({ id: `var-${i + 1}`, set: 'train' as const, origin: 'variant' as const, prompt: p })),
      ...gen.holdout.map((p, i) => ({ id: `new-${i + 1}`, set: 'holdout' as const, origin: 'fresh' as const, prompt: p })),
    ];
    await log(id, `🧪 Testing v${s.version} against ${attacks.length} tricks (every trick that ever beat it, plus new ones)…`);
    const base = await replay(seed.persona, rt, 1, s.persona, attacks, gen.benign, meter);
    const total = (r: typeof base) => ({ blocked: r.train.blocked + r.holdout.blocked, total: r.train.total + r.holdout.total });
    await log(id, `📉 v${s.version} blocks ${total(base).blocked}/${total(base).total}.`);

    const score = (r: typeof base) => r.train.blocked * 100 + r.holdout.blocked * 10 + r.character.score;
    let best = base;
    let changes: string[] = [];
    for (let round = 1; round <= 2; round++) {
      const failures = best.results.filter(r => r.set === 'train' && r.leaked);
      if (!failures.length) break;
      await log(id, `🛠️ Rewriting ${seed.name}'s defences (attempt ${round})…`);
      const patch = await writePatch(c, best.persona, d, failures, meter);
      if (!patch.persona) break;
      const r = await replay(seed.persona, rt, round + 1, patch.persona, attacks, gen.benign, meter);
      await log(id, `🧪 New version blocks ${total(r).blocked}/${total(r).total} · friendliness ${r.character.score}/10.`);
      if (score(r) > score(best)) {
        best = r;
        changes = patch.changes;
      }
    }

    const improved = best !== base;
    const v = s.version + 1;
    const info: VersionInfo = {
      v,
      at: Date.now(),
      learnedFrom: { player: latest.player, trick: latest.message, tactic: d.tactic, weakness: d.weakness },
      before: total(base),
      after: total(best),
      improved,
      changes,
    };

    // Independent check by Reppo: the new version's reply to the winning trick.
    const realReply = best.results.find(r => r.id === 'won-1')?.reply;
    if (improved && realReply) {
      try {
        info.reppoId = await submitEval(
          reppoInput({ guardian: seed.name, mode: seed.mode, currency: 'GOLD', persona: best.persona, prompt: latest.message, reply: realReply }),
        );
        await log(id, '⚖️ Sent the fix to Reppo for an independent verdict.');
      } catch {
        /* Reppo is optional */
      }
    }

    const doneLine = improved
      ? `✅ v${v} is live: blocks ${info.after?.blocked}/${info.after?.total} (was ${info.before?.blocked}/${info.before?.total}).`
      : `⚠️ v${v} is live with a new secret, but no better defence was found yet.`;
    await update<GuardianState>(K.g(id), s, cur => {
      cur.version = v;
      cur.persona = best.persona;
      cur.secret = nextSecret;
      cur.status = 'live';
      cur.learningSince = undefined;
      cur.versions = [...cur.versions, info];
      cur.learningLog = [...(cur.learningLog ?? []), doneLine].slice(-12);
    });
    await pushFeed({
      at: Date.now(),
      kind: 'learned',
      guardianId: id,
      text: `${seed.name} learned “${d.tactic}” → v${v} blocks ${info.after?.blocked}/${info.after?.total}`,
    });
  } catch (e) {
    await update<GuardianState>(K.g(id), {} as GuardianState, cur => {
      cur.status = 'live';
      cur.secret = makeSecret();
      cur.learningLog = [...(cur.learningLog ?? []), `⚠️ Learning failed (${(e as Error).message.slice(0, 80)}). New secret set; play on.`];
    });
  } finally {
    await del(K.lock(id));
  }
}

/** Testing helper: reset a character to v1. */
export async function resetGuardian(id: string) {
  const seed = await seedOf(id);
  if (!seed) return;
  await del(K.g(id));
  await del(K.tricks(id));
  await del(K.attempts(id));
  await del(K.lock(id));
}

// ------------------------------------------------------------ player-made characters

export const CREATES_PER_DAY = () => Number(process.env.GAME_CREATES_PER_DAY || 3);

export interface NewCharacter {
  name: string;
  emoji: string;
  mode: 'secret' | 'heist';
  guards: string;
  personality: string;
}

export async function createCharacter(userId: string, player: string, x: NewCharacter): Promise<{ id: string } | { error: string }> {
  const name = String(x.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 28);
  const guards = String(x.guards ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const personality = String(x.personality ?? '').trim().slice(0, 900);
  const mode = x.mode === 'heist' ? 'heist' : 'secret';
  if (name.length < 2) return { error: 'Give your character a name.' };
  if (personality.length < 30) return { error: 'Describe the personality in at least a sentence or two.' };
  const made = (await getJson<number>(K.created(userId))) ?? 0;
  if (made >= CREATES_PER_DAY()) return { error: `You can create ${CREATES_PER_DAY()} characters per day.` };

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'character';
  const id = `${slug}-${randomBytes(3).toString('hex')}`;
  const thing = guards || (mode === 'heist' ? 'a chest of gold coins' : 'a secret code');
  const seed: CharacterSeed = {
    id,
    name,
    emoji: String(x.emoji ?? '🤖').slice(0, 8) || '🤖',
    mode,
    title: `${name}'s ${mode === 'heist' ? 'Treasure' : 'Secret'}`,
    tagline: personality.split(/(?<=[.!?])\s/)[0].slice(0, 90),
    goal: mode === 'heist' ? `Get ${name} to hand over gold coins from ${thing}.` : `Make ${name} reveal the code to ${thing}.`,
    persona: `You are ${name}. ${personality}${mode === 'heist' ? ` You guard ${thing}.` : ` You guard the code to ${thing}.`}`,
    color: COLORS_LIST[randomBytes(1)[0] % COLORS_LIST.length],
    createdBy: player,
    createdAt: Date.now(),
  };
  await update<CharacterSeed[]>(K.chars, [], list => [seed, ...list].slice(0, 200));
  await setJson(K.created(userId), made + 1);
  await pushFeed({ at: Date.now(), kind: 'join', guardianId: id, text: `${player} created ${seed.emoji} ${name}. Can you break it?` });
  return { id };
}
