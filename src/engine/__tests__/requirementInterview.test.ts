import { describe, expect, it } from 'vitest';
import { PRESET_DEMO_CASES } from '../../data/presetDemos';
import type { RequirementInput } from '../../types/sartoria';
import { buildLocalDecisionRequirement, extractRevisionConstraints, isExplicitWithdrawal } from '../requirementInterview';
import { parseRequirementResponse, parseRequirementResponseOrFallback } from '../requirementSchema';

const corporateContext: RequirementInput = {
  projectName: '秋季会务服', clientName: '项目联系人', businessType: 'corporate_uniform',
  season: 'autumn', groupSize: '', targetSceneId: 'scene-studio-minimal', rawNarrative: '',
};

const mainBrief = { ...corporateContext, rawNarrative: '60 套，室内正式，藏青，耐皱，可机洗，不像传统制服。' };

function makeModelResponse(input: RequirementInput) {
  const { schemaVersion, constraints, questions } = buildLocalDecisionRequirement(input);
  const unknown = { value: null, state: 'unknown', level: 'pending', sourceTurnId: null, quote: null, reason: '原话未提及' };
  const dimension = { ...unknown, score: null };
  return {
    schemaVersion, constraints: constraints.map(({ blocking: _blocking, withdraws: _withdraws, quantityScope: _quantityScope, ...constraint }) => constraint), questions,
    dimensions: {
      styleTone: dimension, silhouetteReq: dimension, fabricTexture: dimension,
      craftDetail: dimension, colorSystem: dimension, sceneFit: dimension,
    },
    aestheticArchetype: unknown, emotionTags: [],
  };
}

describe('the offline requirement interview', () => {
  it('preserves the main corporate brief and the exclusion with a verbatim quote', () => {
    const requirements = buildLocalDecisionRequirement(mainBrief);
    expect(requirements.mode).toBe('local_rules');
    expect(requirements.questions).toEqual([]);
    expect(requirements.constraints.filter(({ level }) => level === 'hard')).toMatchObject([
      { field: 'quantity', value: 60, quote: '60 套' },
      { field: 'scene', value: 'indoor_formal', quote: '室内正式' },
      { field: 'color', value: 'navy', quote: '藏青' },
      { field: 'care', value: 'machine_wash', quote: '可机洗' },
      { field: 'wrinkleResistance', value: true, quote: '耐皱' },
      { field: 'style', value: 'traditional_uniform', quote: '不像传统制服', op: 'neq' },
    ]);
    expect(requirements.constraints.find(({ field }) => field === 'businessType')).toMatchObject({
      value: 'corporate_uniform', state: 'suggested', quote: null,
    });
  });

  it('reads only the requested preferences and leaves preserved hard fields alone', () => {
    const revision = extractRevisionConstraints({ id: 'r-1', text: '想要更亮，最好真丝；机洗和藏青不动' });
    expect(revision).toMatchObject([
      { field: 'fabric', value: 'silk', level: 'preference', sourceTurnId: 'r-1', quote: '最好真丝' },
      { field: 'luster', value: 'high', level: 'preference', sourceTurnId: 'r-1', quote: '想要更亮' },
    ]);
  });

  it('retains both conflicting quotes and pauses selection for the unresolved color', () => {
    const text = '至少六十套，必须藏青，也不能用藏青，取消机洗';
    const revision = extractRevisionConstraints({ id: 'r-2', text });
    expect(revision).toMatchObject([
      { field: 'quantity', value: null, state: 'unknown', quote: '至少六十套' },
      { field: 'color', value: 'navy', op: 'eq', level: 'hard', quote: '必须藏青' },
      { field: 'color', value: 'navy', op: 'neq', level: 'hard', quote: '也不能用藏青' },
      { field: 'color', value: null, state: 'unknown', quote: text, blocking: true },
      { field: 'care', value: null, state: 'unknown', quote: '取消机洗' },
    ]);
    expect(buildLocalDecisionRequirement({ ...corporateContext, rawNarrative: text }).questions).toHaveLength(2);
    expect(extractRevisionConstraints({ id: 'r-3', text: '藏青改黑色，洗护改为只能干洗' })).toMatchObject([
      { field: 'color', value: 'obsidian', level: 'hard' },
      { field: 'care', value: 'dry_clean', level: 'hard' },
    ]);
  });

  it('keeps exclusions when alternatives are still open and normalizes a binary closure', () => {
    const observations = extractRevisionConstraints({
      id: 'alternatives', text: '不要米白，其他颜色先都可以考虑，门襟不得有明扣。',
    });
    expect(observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'color', value: 'ivory', op: 'neq', level: 'hard' }),
      expect.objectContaining({ field: 'color', value: null, level: 'pending' }),
      expect.objectContaining({ field: 'closure', value: 'no_visible_buttons', op: 'eq', level: 'hard' }),
    ]));
  });

  it('distinguishes outfit pieces from counts and honors an explicit corrected total', () => {
    const outfit = extractRevisionConstraints({ id: 'outfit', text: '做舞台款，上下两件。' });
    expect(outfit.find(({ field }) => field === 'patternStructure')?.value).toBe('two_piece');
    expect(outfit.some(({ field }) => field === 'quantity')).toBe(false);
    const count = extractRevisionConstraints({ id: 'corrected', text: '不是订十八套，而是十二套。' });
    expect(count.filter(({ field }) => field === 'quantity')).toMatchObject([{ value: 12, op: 'eq' }]);
  });

  it('reads descriptive classifiers and catalog craft aliases without interpreting craft adjectives as patches', () => {
    const jacket = extractRevisionConstraints({ id: 'jacket-order', text: '给自己做件薄款夹克，工艺选暗门襟改良立领。' });
    expect(jacket).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'quantity', value: 1, level: 'hard' }),
      expect.objectContaining({ field: 'craft', value: 'crf-hidden-mandarin-placket', op: 'eq' }),
    ]));
    const gowns = extractRevisionConstraints({ id: 'gown-order', text: '订两条礼宾长裙，指定全毛衬手工归拔。' });
    expect(gowns).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'quantity', value: 2 }),
      expect.objectContaining({ field: 'craft', value: 'crf-full-canvas-guiba' }),
    ]));
    expect(extractRevisionConstraints({ id: 'meta', text: '两条洗护要求是礼服可机洗且可手洗。' }).some(({ field }) => field === 'quantity')).toBe(false);
  });

  it('scopes compact qualifiers and leaves unaffected protections in place', () => {
    const split = extractRevisionConstraints({ id: 'brief-scope', text: '最好真丝必须可机洗不要干洗，颜色未定、领型必须翻领。' });
    expect(split).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'fabric', value: 'silk', level: 'preference', op: 'eq' }),
      expect.objectContaining({ field: 'care', value: 'machine_wash', level: 'hard', op: 'eq' }),
      expect.objectContaining({ field: 'care', value: 'dry_clean', level: 'hard', op: 'neq' }),
      expect.objectContaining({ field: 'collar', value: 'lapel', level: 'hard', op: 'eq' }),
      expect.objectContaining({ field: 'color', value: null, state: 'unknown' }),
    ]));
    expect(split.find(({ field }) => field === 'color')?.blocking).toBeUndefined();
    const protectedRevision = extractRevisionConstraints({ id: 'protected', text: '机洗、藏青照旧只把领型改成翻领。' });
    expect(protectedRevision).toMatchObject([{ field: 'collar', value: 'lapel', quote: '只把领型改成翻领' }]);
  });

  it('keeps exclusions across a coordinated list and resets at an affirmative instruction', () => {
    const choices = extractRevisionConstraints({ id: 'coordination', text: '禁止羊毛、醋酸和真丝只用聚酯纤维。' });
    expect(choices.filter(({ field }) => field === 'fabric').map(({ op, value }) => [op, value])).toEqual([
      ['neq', 'wool'], ['neq', 'acetate'], ['neq', 'silk'], ['eq', 'polyester'],
    ]);
  });

  it('recognizes a reiterated garment closure predicate without treating it as an unresolved craft', () => {
    const reaffirmation = extractRevisionConstraints({ id: 'closure-review', text: '不用驳领，纽扣仍然不许露在外。' });
    expect(reaffirmation).toMatchObject([
      { field: 'collar', op: 'neq', value: 'lapel' },
      { field: 'closure', op: 'eq', value: 'no_visible_buttons', state: 'explicit', quote: '纽扣仍然不许露在外' },
    ]);
  });

  it('normalizes trailing exclusions and rejects a care method when it is the only allowed care', () => {
    const result = extractRevisionConstraints({ id: 'polarity', text: '深蓝也绝对不用，羊毛一律不考虑，不要采用仅能干洗的布料。' });
    expect(result).toMatchObject([
      { field: 'fabric', value: 'wool', op: 'neq', level: 'hard' },
      { field: 'color', value: 'navy', op: 'neq', level: 'hard' },
      { field: 'care', value: 'dry_clean', op: 'neq', level: 'hard' },
    ]);
  });

  it('separates named craft, collar wording, structure and fabric feel from standalone garment specifications', () => {
    const result = extractRevisionConstraints({
      id: 'catalog-names',
      text: '领口采用西服尖驳领，版型采用两件式结构。工艺指定撞色真丝滚边与高活动量袖口工艺，另一项工艺用 SFG-CR-001。布料像羊毛一样柔和。',
    });
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'collar', value: 'lapel' }),
      expect.objectContaining({ field: 'patternStructure', value: 'two_piece' }),
      expect.objectContaining({ field: 'craft', value: 'crf-contrast-piping-cuff' }),
      expect.objectContaining({ field: 'craft', value: 'crf-haipai-pipa-button' }),
    ]));
    expect(result.some(({ field }) => field === 'category' || field === 'fabric')).toBe(false);
    expect(result.some(({ blocking }) => blocking)).toBe(false);
  });

  it('blocks unsupported explicit values and composition while leaving uncertain preferences open', () => {
    const result = extractRevisionConstraints({
      id: 'unlisted-details', text: '色调锁定烟紫色。布料必须含65%羊毛，袖窿放量至少五厘米，光泽希望像釉面。',
    });
    expect(result.filter(({ blocking }) => blocking).map(({ field }) => field)).toEqual(['fabric', 'color', 'easeAllowance']);
    expect(result.some(({ field, value }) => field === 'fabric' && value === 'wool')).toBe(false);
  });

  it('keeps the proposed replacement while withholding an explicitly unapproved withdrawal', () => {
    const result = extractRevisionConstraints({
      id: 'unapproved', text: '有提议改成手洗。原先的机洗要求尚未批准取消，继续问客户。',
    });
    expect(result).toMatchObject([{ field: 'care', value: 'hand_wash', state: 'explicit' }]);
    expect(result.some(isExplicitWithdrawal)).toBe(false);
  });

  it('replaces only the named craft predicate when changing one item in a craft package', () => {
    const result = extractRevisionConstraints({ id: 'craft-replacement', text: '把手工琵琶盘扣换成缎纹稳缝，其他照旧。' });
    expect(result).toMatchObject([
      { field: 'craft', state: 'unknown', withdraws: { op: 'eq', value: 'crf-haipai-pipa-button' } },
      { field: 'craft', state: 'explicit', op: 'eq', value: 'crf-demo-washable-satin-seams' },
    ]);
  });

  it('distinguishes clothing purchases from attachment counts and buyers from venue requirements', () => {
    const observations = extractRevisionConstraints({ id: 'documents', text: '商务接待组团体订制十八套正装。两份补充协议注明外套细节。穿去小剧场里演奏。' });
    expect(observations.filter(({ field }) => ['businessType', 'quantity', 'scene'].includes(field))).toMatchObject([
      { field: 'businessType', value: 'corporate_uniform' },
      { field: 'quantity', value: 18 },
      { field: 'scene', value: 'indoor_performance' },
    ]);
  });

  it('records optional references and an open care decision without setting concrete constraints', () => {
    const result = extractRevisionConstraints({
      id: 'optional', text: '深蓝暂时仅供参考，交领先列为备选。洗护方式尚未确定。',
    });
    expect(result).toMatchObject([
      { field: 'collar', state: 'unknown', value: null, quote: '交领先列为备选' },
      { field: 'color', state: 'unknown', value: null, quote: '深蓝暂时仅供参考' },
      { field: 'care', state: 'unknown', value: null, quote: '洗护方式尚未确定' },
    ]);
    expect(result.some(({ blocking }) => blocking)).toBe(false);
  });

  it('keeps component specifications attached to one two-piece order', () => {
    const result = extractRevisionConstraints({
      id: 'components', text: '订六套两件套。外套用交领，长裙选纯色且无图案。不能带去干洗。',
    });
    expect(result).toMatchObject([
      { field: 'quantity', value: 6 },
      { field: 'category', value: 'two_piece' },
      { field: 'patternStructure', value: 'two_piece' },
      { field: 'collar', value: 'cross_open' },
      { field: 'motif', value: 'plain' },
      { field: 'care', op: 'neq', value: 'dry_clean' },
    ]);
  });

  it('resolves a restored catalog color and optical finish while carrying forward confirmed constraints', () => {
    const result = extractRevisionConstraints({
      id: 'restoration', text: '色调换回烟银墨黛，光泽从低反光改成柔润微光。领型继续按已经确认的立领做。',
    });
    expect(result).toMatchObject([
      { field: 'color', value: 'stone_gray', level: 'hard' },
      { field: 'luster', value: 'medium', level: 'hard' },
    ]);
  });

  it('recognizes a woven motif as the target of a direct exclusion', () => {
    const result = extractRevisionConstraints({ id: 'woven', text: '成衣做连身礼服，不要织在布面上的细小暗纹。' });
    expect(result).toMatchObject([
      { field: 'category', value: 'dress' },
      { field: 'motif', op: 'neq', value: 'subtle_jacquard' },
    ]);
  });

  it('counts the order separately from independent garment pieces and retains explicit movement requirements', () => {
    const result = extractRevisionConstraints({
      id: 'separate-pieces', text: '订三套两件式礼宾服。夹克与半身裙要分开做成两件。袖窿位置要预留活动余量，举手打拍不能被成衣扯住。',
    });
    expect(result.filter(({ field }) => ['quantity', 'category', 'patternStructure', 'easeAllowance'].includes(field))).toMatchObject([
      { field: 'quantity', value: 3 },
      { field: 'category', value: 'two_piece' },
      { field: 'patternStructure', value: 'two_piece' },
      { field: 'easeAllowance', op: 'eq', value: 'arm_mobility' },
    ]);
    expect(result.some(({ blocking }) => blocking)).toBe(false);
  });

  it('keeps colloquial preference strength distinct from explicit personal or company order forms', () => {
    const personal = extractRevisionConstraints({ id: 'bespoke', text: '按私人量体订做一件女款礼服，做直身H版。深蓝我本人更中意。' });
    expect(personal).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'businessType', value: 'private_couture', level: 'hard' }),
      expect.objectContaining({ field: 'category', value: 'dress' }),
      expect.objectContaining({ field: 'patternStructure', value: 'h_line' }),
      expect.objectContaining({ field: 'color', value: 'navy', level: 'preference' }),
    ]));
    const team = extractRevisionConstraints({ id: 'collective', text: '后勤开团单，用现代极简风，别拿老式机关制服替代。' });
    expect(team).toMatchObject([
      { field: 'businessType', value: 'corporate_uniform', quote: '后勤开团单' },
      { field: 'style', op: 'eq', value: 'modern' },
      { field: 'style', op: 'neq', value: 'traditional_uniform' },
    ]);
  });

  it('preserves polarity when a garment term includes a technical modifier', () => {
    const excluded = extractRevisionConstraints({ id: 'technical-exclusions', text: '不准用窄平驳领，不穿立领，设计经理不接受专业的干洗。' });
    expect(excluded).toMatchObject([
      { field: 'collar', op: 'neq', value: 'lapel' },
      { field: 'collar', op: 'neq', value: 'stand' },
      { field: 'care', op: 'neq', value: 'dry_clean' },
    ]);
  });

  it('keeps attributed negative preferences soft and explicit trailing exclusions hard', () => {
    const result = extractRevisionConstraints({
      id: 'negative-preference', text: '立领我本人不太中意，深蓝这边更偏爱。专业干洗后勤明确不接受，另外我不怎么喜欢亮面。',
    });
    expect(result).toMatchObject([
      { field: 'collar', op: 'neq', value: 'stand', level: 'preference', quote: '立领我本人不太中意' },
      { field: 'color', op: 'eq', value: 'navy', level: 'preference', quote: '深蓝这边更偏爱' },
      { field: 'care', op: 'neq', value: 'dry_clean', level: 'hard', quote: '专业干洗后勤明确不接受' },
      { field: 'luster', op: 'neq', value: 'high', level: 'preference', quote: '我不怎么喜欢亮面' },
    ]);
  });

  it('keeps the approved plan intact while applying a separate hem change', () => {
    const result = extractRevisionConstraints({ id: 'plan', text: '春季和正式礼厅仍照原单只把裙长改成及踝。' });
    expect(result).toMatchObject([{ field: 'lengthRatio', op: 'eq', value: 'ankle', quote: '只把裙长改成及踝' }]);
  });

  it('handles compact workplace phrasing and coordinated exclusions without reversing polarity', () => {
    const observations = extractRevisionConstraints({
      id: 'workplace',
      text: '给我们部门统一订做二十四身工作服，室内礼宾接待，色系指定午夜蓝；禁止使用羊毛和真丝；不要送去干洗、还要能放进洗衣机；纽扣不可外露。',
    });
    expect(observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'businessType', op: 'eq', value: 'corporate_uniform' }),
      expect.objectContaining({ field: 'quantity', op: 'eq', value: 24 }),
      expect.objectContaining({ field: 'scene', op: 'eq', value: 'indoor_formal' }),
      expect.objectContaining({ field: 'color', op: 'eq', value: 'navy' }),
      expect.objectContaining({ field: 'fabric', op: 'neq', value: 'wool' }),
      expect.objectContaining({ field: 'fabric', op: 'neq', value: 'silk' }),
      expect.objectContaining({ field: 'care', op: 'neq', value: 'dry_clean' }),
      expect.objectContaining({ field: 'care', op: 'eq', value: 'machine_wash' }),
      expect.objectContaining({ field: 'closure', op: 'eq', value: 'no_visible_buttons' }),
    ]));
  });

  it('guards hard unknowns while leaving absent or explicitly withdrawn fields open', () => {
    const observations = extractRevisionConstraints({
      id: 'follow-up', text: '裙长必须过膝，颜色未指定，不强制机洗，领型改成交领其他照旧。',
    });
    expect(observations.find(({ field }) => field === 'lengthRatio')).toMatchObject({ state: 'unknown', blocking: true });
    expect(observations.find(({ field }) => field === 'color')).not.toHaveProperty('blocking');
    const withdrawal = observations.find(({ field }) => field === 'care')!;
    expect(isExplicitWithdrawal(withdrawal)).toBe(true);
    expect(withdrawal).not.toHaveProperty('blocking');
    expect(observations.find(({ field }) => field === 'collar')).toMatchObject({ value: 'cross_open' });
  });

  it.each([
    { text: '单位职业装，通勤套装，套数为８８。', business: 'corporate_uniform', category: 'suit', quantity: 88 },
    { text: '只给自己订一条礼裙，穿去室内的正式晚宴。', business: 'private_couture', category: 'dress', quantity: 1 },
  ])('distinguishes explicit recipients, garment categories and counts in $text', ({ text, business, category, quantity }) => {
    const extracted = extractRevisionConstraints({ id: 'recipient', text });
    expect(extracted).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'businessType', value: business, state: 'explicit' }),
      expect.objectContaining({ field: 'category', value: category, state: 'explicit' }),
      expect.objectContaining({ field: 'quantity', value: quantity, state: 'explicit' }),
    ]));
  });

  it('keeps the official case references separate from explicit fit and item requirements', () => {
    const case6 = PRESET_DEMO_CASES.find(({ id }) => id === 'official-case-6')!;
    const { constraints } = buildLocalDecisionRequirement(case6.input);
    expect(constraints.find(({ field }) => field === 'category')).toMatchObject({ value: 'jacket', state: 'explicit' });
    expect(constraints.find(({ field }) => field === 'easeAllowance')).toMatchObject({ value: 'arm_mobility', state: 'explicit' });
    expect(constraints.find(({ field }) => field === 'fabric')).toMatchObject({ value: 'silk', state: 'suggested', quote: null });
    expect(constraints.find(({ field }) => field === 'collar')).toMatchObject({ value: 'cross_open', state: 'suggested', quote: null });
    expect(constraints.find(({ field }) => field === 'color')).toMatchObject({ value: null, state: 'unknown', quote: null });

    const case3 = PRESET_DEMO_CASES.find(({ id }) => id === 'official-case-3')!;
    const confirmed = buildLocalDecisionRequirement(case3.input).constraints;
    expect(confirmed.find(({ field }) => field === 'patternStructure')).toMatchObject({ value: 'two_piece', state: 'explicit' });
    expect(confirmed.find(({ field }) => field === 'easeAllowance')).toMatchObject({ value: 'arm_mobility', state: 'explicit' });
  });
});

describe('the strict requirement response boundary', () => {
  it('accepts a complete, versioned and semantically supported payload', () => {
    const response = makeModelResponse(mainBrief);
    expect(parseRequirementResponse(JSON.stringify(response), mainBrief)).toMatchObject({ ok: true, requirement: { mode: 'validated' } });
  });

  it('restores the order scope from source when validating model quantities', () => {
    const input = { ...corporateContext, rawNarrative: '整单二十六套西装。首批先做二十套。' };
    expect(parseRequirementResponse(makeModelResponse(input), input)).toMatchObject({
      ok: true, requirement: { constraints: expect.arrayContaining([
        expect.objectContaining({ field: 'quantity', value: 26, quantityScope: 'order' }),
        expect.objectContaining({ field: 'quantity', value: 20, quantityScope: 'batch' }),
      ]) },
    });
  });

  it('requires individually scoped evidence when equal counts cover both an order and a batch', () => {
    const input = { ...corporateContext, rawNarrative: '整单二十六套首批二十六套。' };
    const response = makeModelResponse(input);
    const amounts = response.constraints.filter(({ field }) => field === 'quantity');
    expect(amounts).toHaveLength(2);
    expect(parseRequirementResponse(response, input)).toMatchObject({ ok: false });
    amounts[0].quote = '整单二十六套';
    amounts[1].quote = '首批二十六套';
    expect(parseRequirementResponse(response, input)).toMatchObject({
      ok: true, requirement: { constraints: expect.arrayContaining([
        expect.objectContaining({ field: 'quantity', value: 26, quantityScope: 'order' }),
        expect.objectContaining({ field: 'quantity', value: 26, quantityScope: 'batch' }),
      ]) },
    });
  });

  it('recovers from malformed JSON or a response outside the schema', () => {
    expect(parseRequirementResponseOrFallback('invalid', mainBrief)).toMatchObject({ ok: false, requirement: { mode: 'local_rules' } });
    for (const reply of [
      { ...makeModelResponse(mainBrief), inventory: [] },
      { ...makeModelResponse(mainBrief), schemaVersion: 'sartoria_requirement_v2' },
      { ...makeModelResponse(mainBrief), dimensions: {} },
    ]) {
      expect(parseRequirementResponse(reply, mainBrief)).toMatchObject({ ok: false });
    }
  });

  it('rejects invented evidence, reversed exclusions and model confirmations', () => {
    for (const patch of [
      { quote: '一定要传统制服', op: 'eq' }, { quote: '不像传统制服', op: 'eq' },
      { sourceTurnId: 'nonexistent' }, { value: 'casual' }, { level: 'preference' },
      { state: 'confirmed', verifiedBy: 'ghost' },
    ]) {
      const response = makeModelResponse(mainBrief);
      Object.assign(response.constraints.find(({ field }) => field === 'style')!, patch);
      expect(parseRequirementResponse(response, mainBrief)).toMatchObject({ ok: false });
    }
  });

  it('rejects a missing hard requirement or an invented suggested color', () => {
    const response = makeModelResponse(mainBrief);
    response.constraints = response.constraints.filter(({ field }) => field !== 'care');
    expect(parseRequirementResponse(response, mainBrief)).toMatchObject({ ok: false });

    const input = { ...corporateContext, rawNarrative: '可机洗' };
    const chosenColor = makeModelResponse(input);
    Object.assign(chosenColor.constraints.find(({ field }) => field === 'color')!, {
      state: 'suggested', level: 'preference', value: 'navy', reason: '设计建议',
    });
    expect(parseRequirementResponse(chosenColor, input)).toMatchObject({ ok: false });
  });

  it('rejects a model promoting a source color reference into a customer requirement', () => {
    const input = { ...corporateContext, rawNarrative: '深蓝暂时仅供参考。' };
    const response = makeModelResponse(input);
    expect(parseRequirementResponse(response, input)).toMatchObject({ ok: true });
    Object.assign(response.constraints.find(({ field }) => field === 'color')!, {
      state: 'explicit', level: 'hard', value: 'navy', quote: '深蓝', reason: null,
    });
    expect(parseRequirementResponse(response, input)).toMatchObject({ ok: false });
  });

  it('derives a blocking hard unknown from trusted raw text after schema validation', () => {
    const input = { ...corporateContext, rawNarrative: '颜色必须藏青或黑色。' };
    expect(parseRequirementResponse(makeModelResponse(input), input)).toMatchObject({
      ok: true, requirement: { constraints: expect.arrayContaining([
        expect.objectContaining({ field: 'color', state: 'unknown', blocking: true }),
      ]) },
    });
  });

  it('derives the withdrawal predicate and pending reason from the actual quoted statement', () => {
    const input = { ...corporateContext, rawNarrative: '取消禁止使用羊毛的要求。' };
    const stated = parseRequirementResponse(makeModelResponse(input), input);
    expect(stated).toMatchObject({
      ok: true, requirement: { constraints: expect.arrayContaining([
        expect.objectContaining({ field: 'fabric', withdraws: { op: 'neq', value: 'wool' } }),
      ]) },
    });

    const unclear = { ...corporateContext, rawNarrative: '颜色必须藏青或者暖灰。' };
    const response = makeModelResponse(unclear);
    response.constraints.find(({ field }) => field === 'color')!.reason = '原话明确撤回该要求。';
    const parsed = parseRequirementResponse(response, unclear);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const color = parsed.requirement.constraints.find(({ field }) => field === 'color')!;
      expect(color.blocking).toBe(true);
      expect(isExplicitWithdrawal(color)).toBe(false);
    }
  });

  it('accepts quoted conflicting facts only with a verified blocking marker', () => {
    const input = { ...corporateContext, rawNarrative: '一定要米白，绝不能米白。' };
    const response = makeModelResponse(input);
    expect(parseRequirementResponse(response, input)).toMatchObject({ ok: true });
    response.constraints = response.constraints.filter((item) => item.field !== 'color' || item.state !== 'unknown');
    expect(parseRequirementResponse(response, input)).toMatchObject({ ok: false });
  });
});
