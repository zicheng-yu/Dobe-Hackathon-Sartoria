import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { matchDecision } from '../src/engine/decisionMatching';
import { buildLocalDecisionRequirement } from '../src/engine/requirementInterview';
import type { Constraint } from '../src/types/decisions';
import { cases } from './colorScopeCases.json';

const catalogColors = new Map([
  ['灰色', 'stone_gray'], ['黑色', 'obsidian'], ['酒红色', 'crimson'], ['藏青色', 'navy'], ['棕色', 'earth_brown'],
]);
const roles = ['hard', 'excluded', 'preferred', 'pending'] as const;

// Use the decisive wording when a color name alone does not establish the speaker's intent.
const sourcePhrases: Partial<Record<string, string[]>> = {
  '02a': ['颜色上我比较喜欢米色'], '02b': ['颜色上我比较喜欢米色'],
  '03b': ['颜色就用我发的那张照片里那种蓝色'], '04b': ['面料也就定红色'],
  '05b': ['我也想用这个黄色'],
  '06a': ['如果公司最后同意灰色，我就用灰色'], '06b': ['给我定灰色'],
  '07a': ['假如主办方让大家穿绿色，那我这件就做绿色'], '07b': ['假如主办方让大家穿绿色，那我这件就做绿色'],
  '08a': ['如果同事也定了白色制服，我再考虑白色'], '08b': ['如果同事也定了白色制服，我再考虑白色'],
  '09a': ['要是新娘确定让我穿咖啡色，我再做咖啡色'], '09b': ['要是新娘确定让我穿咖啡色，我再做咖啡色'],
  '10a': ['我先定蓝色面料'], '10b': ['这件就做蓝色', '白色明确排掉'],
  '11a': ['米色我只有看过实物、确认合适才会订'], '11b': ['米色我只有看过实物、确认合适才会订'],
  '12b': ['就红色'], '13a': ['我先要米色'], '13b': ['我先要米色'],
  '14a': ['橙色就别拿了'], '14b': ['颜色也定蓝色', '橙色就别拿了'],
  '15b': ['我也更喜欢酒红色'], '16a': ['要是爷爷答应穿紫色我才订紫色'], '16b': ['就给他订紫色'],
};

test('the frozen color-scope fixture keeps its original text and labels', () => {
  const fixture = readFileSync(new URL('./colorScopeCases.json', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  expect(createHash('sha256').update(fixture).digest('hex')).toBe(
    '3e8f8d6d349f5950f8923a06a44cfc4c9f60695c8e5e6bc68f4b13062a9d4d34',
  );
});

function interview(rawNarrative: string) {
  return buildLocalDecisionRequirement({
    rawNarrative, projectName: '', clientName: '', businessType: 'private_couture',
    season: 'all_season', groupSize: '', targetSceneId: '',
  });
}

test.each(cases)('color scope $id', (row) => {
  const requirement = interview(row.text);
  const claims = roles.flatMap((role) => row[role].map((color) => ({
    role, color, value: role === 'pending' ? undefined : catalogColors.get(color),
    phrase: sourcePhrases[row.id]?.find((phrase) => phrase.includes(color)) ?? color,
  })));
  const colors = requirement.constraints.filter((item) => item.field === 'color' && (
    item.level !== 'pending' || item.state !== 'unknown' || item.value !== null ||
    item.blocking || item.sourceTurnId !== null || item.quote !== null || item.withdraws
  ));
  const quoteIsSourced = ({ quote, sourceTurnId }: Constraint) => Boolean(quote?.trim() &&
    requirement.turns.some((turn) => turn.id === sourceTurnId && turn.text === row.text && turn.text.includes(quote)));
  expect.soft(colors.filter((item) => !quoteIsSourced(item)), 'untraceable color quotes').toEqual([]);

  const resolved = colors.filter(({ value }) => value !== null);
  const exact = claims.filter(({ value }) => value !== undefined);
  const review = claims.filter(({ value }) => value === undefined);
  const matchesExact = (item: Constraint, { role, value, phrase }: typeof claims[number]) =>
    item.value === value && item.op === (role === 'excluded' ? 'neq' : 'eq') &&
    item.level === (role === 'preferred' ? 'preference' : 'hard') && !item.blocking && !item.withdraws &&
    (item.state === 'explicit' || item.state === 'confirmed') && item.quote?.includes(phrase);
  expect.soft(exact.filter((claim) => !resolved.some((item) => matchesExact(item, claim))), 'missing exact catalog predicates').toEqual([]);
  expect.soft(resolved.filter((item) => !exact.some((claim) => matchesExact(item, claim))), 'unexpected exact color predicates').toEqual([]);

  const unresolved = colors.filter(({ value }) => value === null);
  const requiresBlock = ({ role }: typeof claims[number]) => role === 'hard' || role === 'excluded';
  const matchesReview = (item: Constraint, claim: typeof claims[number]) =>
    item.level === 'pending' && item.state === 'unknown' && !item.withdraws &&
    Boolean(item.blocking) === requiresBlock(claim) && item.quote?.includes(claim.phrase) &&
    !/只将该项列为参考|只供参考|互相冲突/u.test(item.reason ?? '');
  const isContext = (item: Constraint) => !item.blocking && !item.withdraws && item.level === 'pending' && item.state === 'unknown' && (
    /只将该项列为参考|只供参考/u.test(item.reason ?? '') && row.referenceOnly.some((color) => item.quote?.includes(color)) ||
    item.quote === '颜色我们到店再聊' || item.quote === '颜色我暂时没想'
  );
  // A single verbatim span can cover both a requested color and an exclusion.
  expect.soft(review.filter((claim) => !unresolved.some((item) => matchesReview(item, claim))), 'missing safe color review').toEqual([]);
  expect.soft(unresolved.filter((item) => !review.some((claim) => matchesReview(item, claim)) && !isContext(item)),
    'unexpected color review or blocker').toEqual([]);

  if (review.some(requiresBlock)) {
    const match = matchDecision(requirement);
    expect.soft(match).toMatchObject({ status: 'no_match', recommended: null, alternative: null });
    const inspected = [...match.review, ...match.rejected].flatMap(({ evidence }) => evidence);
    for (const blocker of unresolved.filter(({ blocking }) => blocking)) {
      expect.soft(inspected).toContainEqual(expect.objectContaining({
        field: 'color', constraintId: blocker.id, outcome: 'unknown',
      }));
    }
  }
});

// The eleven controls from the original replay also exercise neighboring non-color instructions.
const controls = [
  ['positive-image', '想做外套。颜色就按照片里的酒红色做，领子再商量。', ['eq:crimson']],
  ['negative-image', '想做外套。不要照片里的酒红色，颜色要藏青。', ['neq:crimson', 'eq:navy']],
  ['reapproval', '若场地够暗就用深绿。如果换不了灯也没关系，现在颜色正式定藏青。', ['eq:navy']],
  ['condition-next-field', '如果场地太暗，我再考虑深绿。必须机洗，领子一定要驳领。', []],
  ['conditional-exclusion', '如果灯太红，再排除酒红色。别的没有硬性要求。', []],
  ['current-exclusion', '照片里是酒红色。这次我只借它的肩线，深绿绝对不能用。', ['neq:pine_green']],
  ['current-later', '照片里是酒红色。这次我只借它的肩线。我们自己的颜色最后也定酒红色。', ['eq:crimson']],
  ['only-neg', '我这单酒红色随便商量，但千万别用深绿。', ['neq:pine_green']],
  ['scoped-material', '机洗一定要，照片只参考领口，面料排除羊毛。', []],
  ['conflict', '这一批所有衣服都必须是酒红色。所有衣服同时必须是藏青色。', ['eq:crimson', 'eq:navy']],
  ['component', '照片上模特穿着酒红色的上衣。我做自己的西装就照它的驳领，别用黑色。', ['neq:obsidian']],
] as const;

test.each(controls)('current order · %s', (id, text, expectedColors) => {
  const requirement = interview(text);
  const hard = requirement.constraints.filter(({ level }) => level === 'hard');
  const colors = hard.filter(({ field }) => field === 'color').map(({ op, value }) => `${op}:${value}`);
  expect(colors.toSorted()).toEqual(expectedColors.toSorted());
  if (id === 'condition-next-field' || id === 'scoped-material') {
    expect(hard).toContainEqual(expect.objectContaining({ field: 'care', op: 'eq', value: 'machine_wash' }));
    expect(hard).toContainEqual(expect.objectContaining(id === 'scoped-material'
      ? { field: 'fabric', op: 'neq', value: 'wool' } : { field: 'collar', op: 'eq', value: 'lapel' }));
  }
  if (id === 'conflict') {
    expect(requirement.constraints).toContainEqual(expect.objectContaining({ field: 'color', blocking: true }));
    expect(matchDecision(requirement).status).toBe('no_match');
  }
});
