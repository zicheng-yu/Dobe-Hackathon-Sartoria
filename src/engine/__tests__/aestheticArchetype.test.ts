import { describe, expect, it } from 'vitest';
import type { DecisionRequirement } from '../../types/decisions';
import { decisionPresentation } from '../decisionVersion';
import { buildLocalDecisionRequirement } from '../requirementInterview';

function requirementFor(rawNarrative: string) {
  return buildLocalDecisionRequirement({
    businessType: 'private_couture', rawNarrative, season: 'autumn', targetSceneId: 'scene-studio-minimal',
    projectName: '', clientName: '', groupSize: '',
  });
}

function onlineTitle(requirement: DecisionRequirement, aestheticArchetype: string) {
  return decisionPresentation(requirement, {
    ...decisionPresentation(requirement), engineUsed: 'llm_api', aestheticArchetype,
  }).aestheticArchetype;
}

describe('online aesthetic archetype with a sheen exclusion', () => {
  const brief = '给自己做一件羊毛外套。面料用羊毛。别用反光特别强的面料。';
  const requirement = requirementFor(brief);

  it.each(['低光泽羊毛外套', '「温润哑光 · 羊毛外套」'])(
    'grounds the unsupported finish in %s in the actual exclusion',
    (title) => {
      expect(requirement.constraints.filter(({ field }) => field === 'luster')).toMatchObject([
        { op: 'neq', value: 'high', state: 'explicit', level: 'hard' },
      ]);
      expect(onlineTitle(requirement, title)).toBe('羊毛外套 · 避开高光泽');
    },
  );

  it.each(['羊毛外套', '羊毛外套 · 避开强反光', '羊毛外套 · 中低光泽均可', '羊毛外套 · 低光泽或中等光泽均可'])
    ('keeps a neutral or bounded headline: %s', (title) => {
      expect(onlineTitle(requirement, title)).toBe(title);
    });

  it.each(['explicit', 'confirmed'] as const)('keeps a low-sheen title for a %s choice', (state) => {
    const low = requirementFor(`${brief}这件外套必须用哑光。`);
    expect(low.constraints).toContainEqual(expect.objectContaining({ field: 'luster', op: 'eq', value: 'low' }));
    const constraints = low.constraints.map((item) => item.field === 'luster' && item.op === 'eq' && item.value === 'low'
      ? { ...item, state } : item);
    expect(onlineTitle({ ...low, constraints }, '哑光羊毛外套')).toBe('哑光羊毛外套');
  });

  it('keeps an explicit matte exclusion in the title', () => {
    const excludesMatte = requirementFor(`${brief}也别选哑光。`);
    expect(excludesMatte.constraints).toContainEqual(expect.objectContaining({ field: 'luster', op: 'neq', value: 'low' }));
    const title = '羊毛外套 · 排除哑光及强反光';
    expect(onlineTitle(excludesMatte, title)).toBe(title);
  });
});
