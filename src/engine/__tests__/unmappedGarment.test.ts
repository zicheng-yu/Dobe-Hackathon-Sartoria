import { expect, it } from 'vitest';
import { matchDecision } from '../decisionMatching';
import { buildLocalDecisionRequirement, extractRevisionConstraints } from '../requirementInterview';

function read(rawNarrative: string) {
  return buildLocalDecisionRequirement({ rawNarrative, projectName: '', clientName: '', businessType: 'private_couture',
    season: 'all_season', targetSceneId: '', groupSize: '' });
}

it('keeps a specifically requested but unlisted collar as a blocking question with its source', () => {
  const requirement = read('我想订一件外套，必须选用折扇领。');
  expect(requirement.constraints).toContainEqual(expect.objectContaining({
    field: 'collar', value: null, state: 'unknown', blocking: true, quote: '必须选用折扇领',
  }));
  expect(requirement.questions.map(({ field }) => field)).toContain('collar');
  expect(matchDecision(requirement).status).toBe('no_match');
  const reference = read('我想订一件外套。方领只是参考。');
  expect(reference.constraints.some((item) => item.field === 'collar' && item.blocking)).toBe(false);
});

it('does not combine an earlier stage order with an explicitly introduced new order', () => {
  const requirement = read('演出必须在露天舞台。换个话题，做一套通勤套装，面料用纯羊毛。');
  const hard = requirement.constraints.filter((item) => item.level === 'hard');
  expect(hard.some((item) => item.field === 'scene')).toBe(false);
  expect(hard).toContainEqual(expect.objectContaining({ field: 'fabric', value: 'wool' }));
  expect(requirement.turns[0].text).toContain('演出必须在露天舞台');
});

it('keeps an unsupported hem length for review and withdraws an old color only when the customer retracts the requirement', () => {
  expect(read('订一条连衣裙，裙长一定要过膝。').constraints).toContainEqual(expect.objectContaining({
    field: 'lengthRatio', value: null, blocking: true, quote: '裙长一定要过膝',
  }));
  expect(extractRevisionConstraints({ id: 'change', text: '收回黑色的要求，裙长仍保留。' })).toContainEqual(expect.objectContaining({
    field: 'color', withdraws: { op: 'eq', value: 'obsidian' },
  }));
  expect(extractRevisionConstraints({ id: 'change', text: '先别收回黑色的要求。' })).toEqual([]);
});
