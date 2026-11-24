import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import worker, { type WorkerEnv } from '../worker/index';
import { SARTORIA_SYSTEM_PROMPT } from '../worker/schema';
import { deconstructRequirement } from '../src/engine/deconstructEngine';
import { matchDecision } from '../src/engine/decisionMatching';
import { refreshDecisionRequirement } from '../src/engine/decisionRevisions';
import { decisionPresentation } from '../src/engine/decisionVersion';
import type { Constraint, ConstraintField } from '../src/types/decisions';
import type { RequirementInput } from '../src/types/sartoria';
import replay from './astraReplay.json';

vi.mock('../worker/quotaLedger.ts', () => ({ QuotaBudgetLedger: class {} }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Fact = [ConstraintField, Constraint['op'], NonNullable<Constraint['value']>];
const cases: { id: string; hard: Fact[]; blocked?: ConstraintField; alternative?: boolean }[] = [
  { id: '01', hard: [['scene', 'eq', 'outdoor_stage'], ['scene', 'eq', 'indoor_performance'], ['category', 'eq', 'two_piece']], blocked: 'scene' },
  { id: '02', hard: [['quantity', 'eq', 30], ['care', 'eq', 'machine_wash'], ['care', 'neq', 'dry_clean'], ['luster', 'neq', 'high']] },
  { id: '03', hard: [['collar', 'neq', 'stand'], ['collar', 'neq', 'lapel'], ['fabric', 'eq', 'silk'], ['luster', 'neq', 'high']] },
  { id: '04', hard: [['category', 'eq', 'jacket']], blocked: 'collar' },
  { id: '05', hard: [['quantity', 'eq', 18], ['color', 'eq', 'navy'], ['care', 'eq', 'machine_wash']] },
  { id: '06', hard: [['category', 'eq', 'dress']], blocked: 'lengthRatio' },
  { id: '07', hard: [['quantity', 'eq', 28], ['collar', 'eq', 'lapel'], ['category', 'eq', 'suit']], alternative: true },
];

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

it('preserves the seven original responses and the recorded historical prompt hashes', () => {
  expect(digest(JSON.stringify(replay))).toBe('525c4bd4683360a19426bf861e6c1e0e6619c8eadd650a928c4d9f4141bd44c8');
});

it.each(cases)('replays frozen Astra brief $id through the Worker, client and catalog', async ({ id, hard, blocked, alternative }) => {
  const sample = replay.cases.find((entry) => entry.id === id)!;
  const input = sample.input as RequirementInput;
  const ledger = {
    reserve: () => ({ allowed: true, reservationId: 'replay', reservedMicros: 0 }),
    settle: () => ({ dateShanghai: '2026-11-24' }),
  };
  const env = { OPENAI_API_KEY: 'offline-replay', QUOTA_LEDGER: { getByName: () => ledger } } as unknown as WorkerEnv;
  vi.spyOn(console, 'log').mockImplementation(() => {});

  const transport = vi.fn(async (url: string, init: RequestInit) => {
    if (url === '/api/deconstruct') {
      return worker.fetch(new Request('https://replay.invalid/api/deconstruct', init), env);
    }
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(sample.output) }] }] });
  });
  vi.stubGlobal('fetch', transport);
  const outcome = await deconstructRequirement(input, 'online_worker');
  expect(transport.mock.calls.map(([url]) => url)).toEqual(['/api/deconstruct', 'https://api.openai.com/v1/responses']);
  const request = JSON.parse(String(transport.mock.calls[1][1].body));
  expect(request).toMatchObject({
    model: replay.model, reasoning: { effort: replay.effort },
    text: { format: { type: 'json_schema', name: 'sartoria_requirement_v1', strict: true } },
  });
  expect(request.input.map(({ role }: { role: string }) => role)).toEqual(['system', 'user']);
  expect(request.input[0].content).toBe(SARTORIA_SYSTEM_PROMPT);
  expect(digest(request.input[1].content)).toBe(sample.userPromptSha256);
  if (!outcome.ok) throw new Error(outcome.error.message);
  expect(outcome.data).toMatchObject({ engineUsed: 'llm_api', validationWarnings: [] });
  for (const spec of sample.output.officialSpecs.filter((item) => item.infoStatus === 'explicit')) {
    expect(spec.sourceQuote).toBeTruthy();
    expect(input.rawNarrative).toContain(spec.sourceQuote);
  }

  const requirement = refreshDecisionRequirement(input);
  const facts = requirement.constraints.filter((constraint) => constraint.level === 'hard');
  for (const [field, op, value] of hard) {
    expect(facts).toContainEqual(expect.objectContaining({ field, op, value }));
  }
  const selectedColor = id === '05';
  expect(facts.filter(({ field }) => field === 'color').map(({ op, value }) => [op, value]))
    .toEqual(selectedColor ? [['eq', 'navy']] : []);
  if (selectedColor) {
    expect(facts.some(({ field, value }) => field === 'luster' || value === 'dry_clean')).toBe(false);
  }
  expect(decisionPresentation(requirement, outcome.data).colorSpecifiedByUser).toBe(selectedColor);
  const match = matchDecision(requirement);
  if (blocked) {
    const blocker = requirement.constraints.find((item) => item.field === blocked && item.blocking);
    expect(blocker?.quote).toBeTruthy();
    expect(input.rawNarrative).toContain(blocker?.quote);
    expect(match).toMatchObject({ status: 'no_match', recommended: null, alternative: null });
  } else {
    expect(match.recommended?.status).toBe('eligible');
    if (alternative) {
      expect(match.alternative?.status).toBe('eligible');
      expect(match.alternative?.id).not.toBe(match.recommended?.id);
    }
  }
});
