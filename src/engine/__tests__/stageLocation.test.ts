import { describe, expect, it } from 'vitest';
import { matchDecision } from '../decisionMatching';
import { buildLocalDecisionRequirement } from '../requirementInterview';

function read(rawNarrative: string) {
  return buildLocalDecisionRequirement({ rawNarrative, projectName: '', clientName: '', businessType: 'private_couture',
    season: 'all_season', targetSceneId: '', groupSize: '' });
}

describe('stage location predicates', () => {
  it.each(['，', ' ', '\n'])('blocks mutually exclusive venues when the subject is shared (%j)', (separator) => {
    const text = '这场演奏会的地点一定要在室外' + separator + '也必须是室内的';
    const requirement = read(text);
    expect(requirement.constraints.filter((c) => c.field === 'scene' && c.level === 'hard'))
      .toMatchObject([{ value: 'outdoor_stage', op: 'eq' }, { value: 'indoor_performance', op: 'eq', quote: text }]);
    expect(matchDecision(requirement).status).toBe('no_match');
  });

  it('preserves an inherited exclusion and uses the source to choose an outdoor venue', () => {
    const text = '这场演出的场地只能在户外，肯定不是室内的。';
    const requirement = read(text);
    expect(requirement.constraints.filter((c) => c.field === 'scene' && c.level === 'hard'))
      .toMatchObject([{ value: 'outdoor_stage', op: 'eq' }, { value: 'indoor_performance', op: 'neq' }]);
    expect(matchDecision(requirement).recommended?.config.sceneId).toBe('scene-outdoor-stage');
    expect(read('舞台不能安排在室内。').constraints).toContainEqual(expect.objectContaining({
      field: 'scene', value: 'indoor_performance', op: 'neq', level: 'hard',
    }));
  });

  it('does not transfer a stage subject to a photo, a fitting or clothing care', () => {
    for (const text of ['舞台在室外的照片供参考，室内取样。', '周六演出，试衣间必须是室内的。', '买户外的外套，在室内取衣服。']) {
      expect(read(text).constraints.filter((c) => c.field === 'scene' && c.level === 'hard')).toEqual([]);
    }
  });

  it('locates a play in an auditorium and recognizes a subject stated before its location', () => {
    for (const text of ['傍晚的话剧在学校礼堂演。', '这场演出。场地必须在室内。']) {
      expect(read(text).constraints).toContainEqual(expect.objectContaining({ field: 'scene', value: 'indoor_performance', level: 'hard' }));
    }
    const r = read('衣服用于周末的舞台演出，必须在露天广场穿。同一场演出又说必须在室内礼堂穿。');
    expect(r.constraints).toContainEqual(expect.objectContaining({ field: 'scene', blocking: true }));
    expect(matchDecision(r).status).toBe('no_match');
  });
});
