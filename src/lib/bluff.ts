/**
 * Read-only access to BLUFF, the onchain AI red-teaming game on NEAR testnet.
 * Every breach in BLUFF is a real attack that beat a real guardian, which makes it
 * live feedback for the forge. Only public view calls are used: no wallet, no transactions.
 */

export const BLUFF_CONTRACT = process.env.BLUFF_CONTRACT || 'bluff-live-76371.testnet';
export const BLUFF_SITE = 'https://bluff-sandy-two.vercel.app';
const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';

export type Mode = 'secret' | 'heist';

interface Room {
  id: string;
  name: string;
  guardian_name: string;
  system_prompt: string;
  difficulty: number;
  status: string;
  mode: number;
  bounty: string;
  attempts_count: number;
}

interface Attempt {
  index: number;
  attacker: string;
  prompt: string;
  status: string;
  response: string | null;
  attack_vector: string | null;
}

export interface BreachCase {
  id: string; // "bluff-<roomId>" or "custom"
  source: 'bluff' | 'custom';
  roomId?: string;
  vault: string;
  guardian: string;
  persona: string;
  mode: Mode;
  /** Wallet currency for money-handling guardians (BLUFF vaults hold NEAR). */
  currency: 'NEAR' | 'USD' | 'GOLD';
  /** Custom source label: 'game' guardians belong to the web2 game. */
  game?: boolean;
  difficulty: number;
  /** Attacks that actually beat this guardian (live feedback). */
  breaches: { prompt: string; response: string; attacker?: string; vector?: string; index?: number }[];
  /** Attacks this guardian already survived. */
  defended: { prompt: string; response: string }[];
}

async function view<T>(method: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'optimistic',
        account_id: BLUFF_CONTRACT,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
    cache: 'no-store',
  });
  const j = await res.json();
  if (j.error || j.result?.error) throw new Error('NEAR RPC error');
  return JSON.parse(Buffer.from(j.result.result).toString()) as T;
}

/** All BLUFF vaults whose guardian has been beaten at least once, with the winning transcripts. */
export async function loadBreachCases(): Promise<BreachCase[]> {
  const rooms = await view<Room[]>('get_rooms', { from_index: 0, limit: 100 });
  const out: BreachCase[] = [];
  await Promise.all(
    rooms.map(async r => {
      if (!r.attempts_count) return;
      const attempts = await view<Attempt[]>('get_attempts', { room_id: r.id, from_index: 0, limit: 50 });
      const wins = attempts.filter(a => a.status === 'Breached' || a.status === 'Heisted');
      if (!wins.length) return;
      const seen = new Set<string>();
      const breaches = wins
        .filter(a => (seen.has(a.prompt) ? false : (seen.add(a.prompt), true)))
        .map(a => ({
          prompt: a.prompt,
          response: a.response ?? '',
          attacker: a.attacker,
          vector: a.attack_vector ?? undefined,
          index: a.index,
        }));
      out.push({
        id: `bluff-${r.id}`,
        source: 'bluff',
        roomId: r.id,
        vault: r.name,
        guardian: r.guardian_name,
        persona: r.system_prompt,
        mode: r.mode === 1 ? 'heist' : 'secret',
        currency: 'NEAR',
        difficulty: r.difficulty,
        breaches,
        defended: attempts
          .filter(a => a.status === 'Defended')
          .slice(0, 3)
          .map(a => ({ prompt: a.prompt, response: a.response ?? '' })),
      });
    }),
  );
  return out.sort((a, b) => Number(b.roomId) - Number(a.roomId));
}
