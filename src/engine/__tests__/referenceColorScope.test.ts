import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CandidateComparison } from '../../components/DecisionPanels';
import { RequirementStudio } from '../../pages/RequirementStudio';
import type { DecisionRequirement } from '../../types/decisions';
import type { DeconstructedRequirement, OfficialSpecItem, RequirementInput } from '../../types/sartoria';
import { deconstructLocally } from '../deconstructEngine';
import { matchDecision } from '../decisionMatching';
import { previewDecisionRevision, recordDecisionRevision, refreshDecisionRequirement } from '../decisionRevisions';
import { buildDecisionVersion, decisionPresentation } from '../decisionVersion';

function brief(businessType: RequirementInput['businessType'], rawNarrative: string): RequirementInput {
  return { businessType, rawNarrative, season: 'autumn', targetSceneId: 'scene-studio-minimal',
    projectName: '', clientName: '', groupSize: '' };
}

const referenceCoat = brief('private_couture',
  '我去听室内音乐会，想给自己做件外套。图片里酒红色很好看，我只借它的领子，照图做方领。衣服颜色先空着，等周五带鞋来配。');
const showroomSuits = brief('corporate_uniform',
  '展厅给讲解员做西装，十四个人每人要两套。为了藏住领夹麦克风，驳领一定得有。若现场灯光太白，可能再看深绿；负责人还没给颜色签字。');

const noop = () => {};

function presentedColor(requirement: DecisionRequirement, deconstructed: DeconstructedRequirement) {
  const markup = renderToStaticMarkup(createElement(RequirementStudio, {
    input: requirement.input, deconstructed, decisionRequirement: requirement,
    status: 'ready', analysisStage: 0, runId: 1,
    engineMode: deconstructed.engineUsed === 'llm_api' ? 'online_worker' : 'local_rules',
    workerStatus: null, deconstructError: null,
    onChangeInput: noop, onSelectPresetDemo: noop, onRunDeconstruct: noop,
    onOpenLlmModal: noop, onProceedToConfigurator: noop,
  }));
  return markup.match(/class="spec-label">色彩<\/span>.*?class="spec-value">([^<]*)<\/div>/u)?.[1];
}

describe('color references in the requirement and catalog flow', () => {
  it('keeps an unlisted chosen color and exclusion together for review', () => {
    const input = brief('private_couture', '做一件外套。颜色定紫色。橙色就别拿了。');
    const requirement = refreshDecisionRequirement(input);
    const blockers = requirement.constraints.filter(({ field, blocking }) => field === 'color' && blocking);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].quote).toBe('颜色定紫色。橙色就别拿了');
    expect(matchDecision(requirement).recommended).toBeNull();
  });

  it.each([
    {
      id: '04', input: referenceCoat, pendingQuote: '衣服颜色先空着', mentionedColor: /绯红|酒红/u,
      colorSpecifiedByUser: false,
      workerColor: {
        key: 'color', label: '色彩', provenance: 'needs_human_verification', constraintKind: 'pending',
        value: '无特殊需求（客户未指定颜色，系统不代客决定，须由顾问携实物色卡线下核定）',
        sourceQuote: null, sourceNote: '酒红仅为参考图片色，周五须结合客户带来的鞋子配色。',
      } satisfies OfficialSpecItem,
    },
    {
      id: '07', input: showroomSuits, pendingQuote: '负责人还没给颜色签字', mentionedColor: /松绿|深绿/u,
      colorSpecifiedByUser: true,
      workerColor: {
        key: 'color', label: '色彩', provenance: 'user_explicit', constraintKind: 'soft',
        value: '仅当现场灯光太白时可能考虑深绿，未签字定色',
        sourceQuote: '若现场灯光太白，可能再看深绿；负责人还没给颜色签字', sourceNote: '深绿是受灯光条件限制的候选。',
      } satisfies OfficialSpecItem,
    },
  ])('interview $id leaves color pending in the requirement and on the page', ({
    input, pendingQuote, mentionedColor, colorSpecifiedByUser, workerColor,
  }) => {
    const requirement = refreshDecisionRequirement(input);
    const colors = requirement.constraints.filter(({ field }) => field === 'color');
    expect.soft(colors.filter(({ level }) => level === 'hard')).toEqual([]);
    const pending = colors.find(({ quote }) => quote?.includes(pendingQuote) && input.rawNarrative.includes(quote));
    expect.soft(pending).toMatchObject({
      value: null, state: 'unknown', level: 'pending', sourceTurnId: requirement.turns[0].id,
    });
    expect.soft(colors.some(({ blocking }) => blocking)).toBe(false);

    const workerBaseline = deconstructLocally(input);
    expect(workerBaseline.colorSpecifiedByUser).toBe(false);
    expect(workerBaseline.officialSpecs.find(({ key }) => key === 'color')).toMatchObject({
      value: expect.stringContaining('待确认'), provenance: 'needs_human_verification',
    });
    expect(workerBaseline.dimensions.find(({ key }) => key === 'colorSystem')?.value).not.toMatch(mentionedColor);
    const onlineOutput: DeconstructedRequirement = {
      ...workerBaseline, engineUsed: 'llm_api', colorSpecifiedByUser,
      officialSpecs: workerBaseline.officialSpecs.map((spec) => spec.key === 'color' ? workerColor : spec),
      dimensions: workerBaseline.dimensions.map((dimension) => dimension.key === 'colorSystem'
        ? { ...dimension, value: workerColor.value }
        : dimension),
    };
    for (const presentation of [decisionPresentation(requirement), decisionPresentation(requirement, onlineOutput)]) {
      expect.soft(presentation.colorSpecifiedByUser).toBe(false);
      const color = presentedColor(requirement, presentation);
      expect.soft(color).toMatch(/待(?:客户)?确认/u);
      expect.soft(color).not.toMatch(mentionedColor);
    }
  });

  it('keeps interview 04 pending for the unlisted square collar without a color gate', () => {
    const requirement = refreshDecisionRequirement(referenceCoat);
    expect(requirement.constraints).toContainEqual(expect.objectContaining({
      field: 'collar', value: null, blocking: true, quote: '照图做方领',
    }));
    const result = matchDecision(requirement);
    expect(result).toMatchObject({ status: 'no_match', recommended: null, alternative: null });
    const evidence = [...result.review, ...result.rejected].flatMap((candidate) => candidate.evidence);
    expect.soft(evidence).toContainEqual(expect.objectContaining({ field: 'collar', outcome: 'unknown' }));
    expect.soft(evidence.some(({ field }) => field === 'color')).toBe(false);
  });

  it('returns two eligible lapel combinations for interview 07', () => {
    const requirement = refreshDecisionRequirement(showroomSuits);
    expect(requirement.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'collar', value: 'lapel', level: 'hard' }),
      expect.objectContaining({ field: 'quantity', value: 28, level: 'hard' }),
    ]));
    const result = matchDecision(requirement);
    const { recommended, alternative } = result;
    expect.soft(result.status).toBe('matched');
    expect.soft(recommended?.status).toBe('eligible');
    expect.soft(alternative?.status).toBe('eligible');
    expect.soft([alternative?.config.patternId, alternative?.config.fabricId])
      .not.toEqual([recommended?.config.patternId, recommended?.config.fabricId]);
    for (const candidate of [recommended, alternative]) {
      if (!candidate) continue;
      expect.soft(candidate.evidence).toContainEqual(expect.objectContaining({ field: 'collar', outcome: 'satisfies' }));
      expect.soft(candidate.evidence.some(({ field }) => field === 'color')).toBe(false);
    }
    const comparison = renderToStaticMarkup(createElement(CandidateComparison, {
      result, selected: recommended, onSelectCandidate: noop,
    }));
    expect.soft(comparison).toContain('B · 替代');
  });

  it('keeps a catalogued reference collar and recognizes an independent explicit color choice and exclusion', () => {
    const input = brief('private_couture', '想订一件外套。参考图里的酒红色很好看，我只参考它的领型，领型必须用立领。');
    const reference = refreshDecisionRequirement(input);
    expect.soft(reference.constraints.filter(({ field, value }) => field === 'color' && value !== null)).toEqual([]);
    expect(reference.constraints).toContainEqual(expect.objectContaining({ field: 'collar', value: 'stand', level: 'hard' }));

    const confirmed = refreshDecisionRequirement({ ...input, rawNarrative: `${input.rawNarrative}成衣颜色确定用酒红，必须排除深绿。` });
    expect(confirmed.constraints.filter(({ field, level }) => field === 'color' && level === 'hard')).toMatchObject([
      { value: 'crimson', op: 'eq', quote: '成衣颜色确定用酒红' },
      { value: 'pine_green', op: 'neq', quote: '必须排除深绿' },
    ]);
  });

  it('uses the same color as a hard condition once the decision maker signs off', () => {
    const input = brief('corporate_uniform', '展厅订二十八套西装，驳领一定得有。若负责人签字，颜色就用深绿。');
    const pending = refreshDecisionRequirement(input);
    const pendingColors = pending.constraints.filter(({ field }) => field === 'color');
    expect.soft(pendingColors).toContainEqual(expect.objectContaining({ level: 'pending', value: null }));
    expect.soft(pendingColors.some(({ level, blocking }) => level === 'hard' || blocking)).toBe(false);

    const approval = '负责人已经签字批准用深绿';
    const confirmed = refreshDecisionRequirement({ ...input, rawNarrative: `${input.rawNarrative}${approval}。` });
    expect.soft(confirmed.constraints).toContainEqual(expect.objectContaining({
      field: 'color', level: 'hard', op: 'eq', value: 'pine_green', quote: expect.stringContaining(approval),
    }));
    expect.soft(matchDecision(confirmed).recommended?.evidence ?? []).toContainEqual(expect.objectContaining({
      field: 'color', value: 'pine_green', outcome: 'satisfies',
    }));
  });

  it('blocks a specified unlisted color and allows a photo or conditional mention of the same color', () => {
    const read = (colorText: string) => refreshDecisionRequirement(brief('private_couture',
      `想给自己做一件外套，领型必须用立领。${colorText}`));
    const specified = read('颜色必须用紫色。');
    expect.soft(specified.constraints).toContainEqual(expect.objectContaining({
      field: 'color', level: 'pending', value: null, blocking: true, quote: '颜色必须用紫色',
    }));
    expect.soft(matchDecision(specified).status).toBe('no_match');

    const conditional = read('若现场灯光太白，可能再看紫色。');
    expect.soft(conditional.constraints).toContainEqual(expect.objectContaining({
      field: 'color', level: 'pending', value: null, quote: expect.stringContaining('可能再看紫色'),
    }));
    const reference = read('照片里的紫色很好看，我只借它的领型。');
    for (const requirement of [conditional, reference]) {
      expect.soft(requirement.constraints.some(({ field, level, value, blocking }) =>
        field === 'color' && (level === 'hard' || value !== null || blocking))).toBe(false);
      const match = matchDecision(requirement);
      expect.soft(match.recommended?.status).toBe('eligible');
      expect.soft(match.recommended?.evidence.some(({ field }) => field === 'color')).toBe(false);
    }
  });

  it('treats a color followed by a first-person rejection as a hard exclusion', () => {
    const requirement = refreshDecisionRequirement(brief('private_couture', '想订一条连衣裙。黑色我这次不做。'));
    expect(requirement.constraints.filter(({ field, level }) => field === 'color' && level === 'hard')).toMatchObject([
      { op: 'neq', value: 'obsidian', quote: '黑色我这次不做' },
    ]);
  });

  it('records a direct first-person color selection with the customer’s words', () => {
    for (const [quote, value] of [['颜色我想要灰色', 'stone_gray'], ['这件的配色我们想要藏青色', 'navy']]) {
      const input = brief('private_couture', `想订一件外套。照片里的酒红色很好看，只参考它的领子。${quote}。`);
      const requirement = refreshDecisionRequirement(input);
      expect(requirement.constraints.filter(({ field }) => field === 'color')).toMatchObject([
        { level: 'hard', op: 'eq', value, quote, sourceTurnId: requirement.turns[0].id },
      ]);
    }

    const quote = '本单颜色我想要紫色';
    const unmapped = refreshDecisionRequirement(brief('private_couture', quote));
    expect(unmapped.constraints).toContainEqual(expect.objectContaining({
      field: 'color', level: 'pending', value: null, blocking: true, quote,
    }));
  });

  it('keeps first-person color wording soft or open when selection is qualified', () => {
    const readColors = (text: string) => refreshDecisionRequirement(brief('private_couture', text))
      .constraints.filter(({ field }) => field === 'color');
    expect(readColors('我想要灰色')).toMatchObject([{ value: 'stone_gray', level: 'preference' }]);
    expect(readColors('颜色我更想要灰色')).toMatchObject([{ value: 'stone_gray', level: 'preference' }]);
    expect(readColors('颜色我想要藏青或者暖灰')).toMatchObject([{ value: null, level: 'pending' }]);
    expect(readColors('若负责人签字，颜色我想要藏青')).toMatchObject([{ value: null, level: 'pending' }]);
    for (const quote of ['颜色我想要藏青，前提是负责人签字', '颜色我想要灰色。不过还得领导拍板', '颜色我想要藏青。还得领导拍板',
      '颜色我想要紫色。不过颜色还得等领导确认']) {
      const colors = readColors(quote);
      expect(colors).toMatchObject([{ value: null, level: 'pending', state: 'unknown', quote }]);
      expect(colors[0].blocking).toBeFalsy();
    }
    expect(readColors('颜色我想要藏青。不过面料还得领导拍板')).toMatchObject([{ value: 'navy', level: 'hard' }]);
    expect(readColors('颜色我想要藏青。不过还得领导确认面料')).toMatchObject([{ value: 'navy', level: 'hard' }]);
    expect(readColors('颜色我想要藏青。不过面料还没定')).toMatchObject([{ value: 'navy', level: 'hard' }]);
    for (const text of ['颜色我想要藏青，预算不够的话再改', '颜色我想要藏青，或者暖灰也行',
      '颜色我想要藏青，但暖灰也可以', '颜色我想要藏青，但也可暖灰',
      '颜色我想要藏青，这只是偏好', '颜色我想要藏青。只是初步考虑', '颜色我想要藏青，暂作参考', '颜色我想要藏青，颜色还没定',
      '颜色我想要藏青？', '对方说，颜色我想要藏青', '版师说：「她只改腰线，颜色我想要藏青，领口保持。」',
      '颜色我想要用照片里的藏青']) {
      expect(readColors(text).some(({ level, blocking }) => level === 'hard' || blocking), text).toBe(false);
    }
  });

  it('preserves color confirmed in a saved revision when later feedback is conditional', () => {
    const requirement = refreshDecisionRequirement(showroomSuits);
    const match = matchDecision(requirement);
    const projectId = 'showroom-color-revision';
    const initial = buildDecisionVersion({ projectId, previous: null, requirement, match,
      candidate: match.recommended, revision: null });
    const confirm = previewDecisionRevision(initial, '颜色正式确定用藏青。');
    const accepted = confirm?.branches.find(({ option, canConfirm, requirement }) => option !== 'defer' && canConfirm &&
      requirement.constraints.some(({ field, value, state }) => field === 'color' && value === 'navy' && state === 'confirmed'));
    if (!confirm || !accepted) throw new Error('Expected a confirmable navy revision');
    const revision = recordDecisionRevision(confirm, accepted, initial.createdAt);
    const saved = buildDecisionVersion({ projectId, previous: initial, requirement: accepted.requirement,
      match: accepted.match, candidate: accepted.candidate, revision });
    const navy = saved.requirement.constraints.find(({ field, state }) => field === 'color' && state === 'confirmed');
    expect(navy).toMatchObject({ value: 'navy', level: 'hard', sourceTurnId: confirm.turn.id });

    const feedback = '数量改成三十套。若现场灯光太白，可能再看深绿；负责人还没给新颜色签字。';
    const pending = previewDecisionRevision(saved, feedback);
    const updated = pending?.branches.find(({ option }) => option === 'accept');
    expect.soft(pending?.requestedPatch.map(({ field }) => field)).toEqual(['quantity']);
    expect.soft(updated?.canConfirm).toBe(true);
    expect.soft(updated?.requirement.constraints ?? []).toContainEqual(expect.objectContaining({ field: 'quantity', value: 30, state: 'confirmed' }));
    expect.soft(updated?.requirement.constraints.filter(({ field, level }) => field === 'color' && level === 'hard')).toEqual([navy]);
    expect.soft(updated?.candidate?.evidence ?? []).toContainEqual(expect.objectContaining({ field: 'color', value: 'navy', outcome: 'satisfies' }));
  });
});
