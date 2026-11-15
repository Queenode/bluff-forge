import 'server-only';

/**
 * Thin client for SERV Reasoning (OpenServ). SERV speaks the OpenAI Chat Completions
 * format, so this is a plain fetch. Every call is metered so a forge run can report
 * exactly how many SERV calls and tokens it used.
 */

const BASE = 'https://inference-api.openserv.ai/v1';

export const MODELS = {
  /** Strategist: diagnoses breaches, writes attacks, writes patches. */
  brain: () => process.env.SERV_BRAIN_MODEL || 'serv-mini',
  /** Default guardian under test: a small fast model, like most production chatbots. */
  guardian: () => process.env.SERV_GUARDIAN_MODEL || 'gemini-3.1-flash-lite',
  /** Leak judge for secret-mode replies. */
  judge: () => process.env.SERV_JUDGE_MODEL || 'serv-mini',
};

export interface Meter {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  byModel: Record<string, number>;
}

export const newMeter = (): Meter => ({ calls: 0, promptTokens: 0, completionTokens: 0, byModel: {} });

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatOut {
  id: string | null;
  model: string;
  content: string;
  toolCalls: ToolCall[];
}

interface ChatOpts {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  tools?: unknown[];
  meter?: Meter;
  /** JSON schema the reply must follow (sent as response_format json_schema). */
  schema?: { name: string; schema: Record<string, unknown> };
}

async function once(o: ChatOpts): Promise<ChatOut> {
  const key = process.env.SERV_API_KEY?.trim();
  if (!key) throw new Error('Missing SERV_API_KEY');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: o.model,
      messages: [
        { role: 'system', content: o.system },
        { role: 'user', content: o.user },
      ],
      max_completion_tokens: o.maxTokens ?? 1200,
      ...(o.tools ? { tools: o.tools, tool_choice: 'auto' } : {}),
      ...(o.schema
        ? { response_format: { type: 'json_schema', json_schema: { name: o.schema.name, strict: true, schema: o.schema.schema } } }
        : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`SERV ${res.status}: ${body.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const j = await res.json();
  const msg = j.choices?.[0]?.message ?? {};
  if (o.meter) {
    o.meter.calls++;
    o.meter.promptTokens += j.usage?.prompt_tokens ?? 0;
    o.meter.completionTokens += j.usage?.completion_tokens ?? 0;
    o.meter.byModel[o.model] = (o.meter.byModel[o.model] ?? 0) + 1;
  }
  const toolCalls: ToolCall[] = [];
  for (const tc of msg.tool_calls ?? []) {
    try {
      toolCalls.push({ name: tc.function?.name, args: JSON.parse(tc.function?.arguments || '{}') });
    } catch {
      toolCalls.push({ name: tc.function?.name, args: {} });
    }
  }
  return { id: j.id ?? null, model: o.model, content: String(msg.content ?? '').trim(), toolCalls };
}

export async function chat(o: ChatOpts): Promise<ChatOut> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await once(o);
    } catch (e) {
      last = e;
      const s = (e as { status?: number }).status;
      if (s === 400 || s === 401 || s === 402 || s === 403) break;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** Ask for JSON and parse it robustly (models sometimes wrap JSON in prose or fences). */
export async function chatJson<T>(o: ChatOpts): Promise<T> {
  const system = `${o.system}\n\nRespond with a single JSON object only. No prose, no code fences.`;
  try {
    return parseJson<T>((await chat({ ...o, system })).content);
  } catch (e) {
    if ((e as { status?: number }).status) throw e;
    // Truncated or malformed JSON: retry once with more room.
    return parseJson<T>((await chat({ ...o, system, maxTokens: (o.maxTokens ?? 1200) * 2 })).content);
  }
}

/** Build a strict JSON schema: every listed property is required, no extras. */
export function obj(name: string, props: Record<string, Record<string, unknown>>) {
  return {
    name,
    schema: { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false },
  };
}
export const str = { type: 'string' };
export const num = { type: 'number' };
export const bool = { type: 'boolean' };
export const strArr = { type: 'array', items: { type: 'string' } };

export function parseJson<T>(text: string): T {
  const t = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)) as T;
    throw new Error('SERV returned non-JSON output');
  }
}

/** Models a builder can test their guardian on (all served through SERV Reasoning). */
export const GUARDIAN_MODELS = ['gemini-3.1-flash-lite', 'serv-nano', 'serv-mini', 'serv-swift', 'gpt-5.4-mini', 'claude-haiku-4.5'];
