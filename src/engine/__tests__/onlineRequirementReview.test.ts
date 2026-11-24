import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequirementConstraints } from '../../components/RequirementConstraints';
import { CONFERENCE_BRIEF } from '../../data/decisionFixtures';
import { buildDecisionExport, buildDecisionMarkdown, decisionValueLabel } from '../../utils/decisionHandoff';
import { applyConstraintEdit, buildClarificationQuestions, buildLocalDecisionRequirement } from '../requirementInterview';
import { buildDecisionVersion, decisionInput, decisionPresentation } from '../decisionVersion';
import { matchDecision } from '../decisionMatching';
import { applyOnlineRequirementReview } from '../onlineRequirementReview';
import { previewDecisionRevision, refreshDecisionRequirement } from '../decisionRevisions';

const brief = (rawNarrative: string) => ({
  ...CONFERENCE_BRIEF, rawNarrative, groupSize: '', presetDemoId: undefined,
});

describe('batch order scope', () => {
  it.each([
    ['本批柜台人员订二十二套西服。', 22, '本批 22 套'],
    ['准备新春演出，先下七套。', 7, '本批 7 套'],
    ['首批共有十一名店员，每人配两套西服。', 22, '本批 22 套'],
  ])('retains confirmed batch scope throughout the decision workflow: %s', (text, value, label) => {
    const requirement = buildLocalDecisionRequirement(brief(text));
    const quantity = requirement.constraints.find(({ field }) => field === 'quantity');
    const match = matchDecision(requirement);
    const version = buildDecisionVersion({
      projectId: 'batch', previous: null, requirement, match, candidate: match.recommended, revision: null,
    });
    expect(quantity).toMatchObject({ value, quantityScope: 'batch', level: 'hard' });
    expect(decisionValueLabel(quantity ?? null)).toBe(label);
    expect(decisionInput(requirement).groupSize).toBe(label);
    expect(renderToStaticMarkup(createElement(RequirementConstraints, { requirement }))).toContain(label);
    expect(buildDecisionMarkdown(version, null)).toContain(`数量 · ${label}`);
    const candidates = [match.recommended, ...match.review, ...match.rejected];
    expect(candidates.some((candidate) => candidate?.evidence.some((entry) =>
      entry.field === 'quantity' && entry.detail.includes(label)))).toBe(true);
    const prior = { ...quantity!, quantityScope: undefined };
    expect(decisionValueLabel(prior)).toBe(label);
  });

  it('keeps a batch count and an order count as separate values', () => {
    const requirement = buildLocalDecisionRequirement(brief('工作服整单六十八套。首批做四十套西装。'));
    expect(requirement.constraints.filter(({ field }) => field === 'quantity')).toMatchObject([
      { value: 68, quantityScope: 'order', level: 'hard' },
      { value: 40, quantityScope: 'batch', level: 'hard' },
    ]);
    expect(decisionInput(requirement).groupSize).toBe('68 套');
  });

  it('requires a larger batch to be clarified when its stated overall count uses the same unit', () => {
    const invalid = buildLocalDecisionRequirement(brief('整单十二套服装。首批做四十套。'));
    expect(invalid.constraints.filter(({ field }) => field === 'quantity')).toMatchObject([
      { value: 12, quantityScope: 'order' },
      { value: 40, quantityScope: 'batch' },
      { value: null, level: 'pending', blocking: true },
    ]);
    expect(matchDecision(invalid).status).toBe('no_match');
    const mixed = buildLocalDecisionRequirement(brief('整单十二套服装。首批做四十件。'));
    expect(mixed.constraints.filter(({ field }) => field === 'quantity')).toMatchObject([
      { value: 12, quantityScope: 'order' },
      { value: 40, quantityScope: 'batch' },
    ]);
  });

  it.each(['先做两件样衣。', '这批暂定二十套西装。', '先订大约二十套西装。'])(
    'keeps samples and estimates out of firm production counts: %s',
    (text) => {
      const requirement = buildLocalDecisionRequirement(brief(text));
      expect(requirement.constraints.find(({ field }) => field === 'quantity')).toMatchObject({
        value: null, level: 'pending', quote: text.slice(0, -1),
      });
    },
  );

  it('retains split quantities for review alongside a confirmed batch', () => {
    const requirement = buildLocalDecisionRequirement(brief('给巡展的讲解组订工装，首批二十六套。各尺码要多少，待场务通知。'));
    const batch = requirement.constraints.find(({ field, value }) => field === 'quantity' && value !== null)!;
    const split = requirement.constraints.find(({ field, value }) => field === 'quantity' && value === null)!;
    const confirmed = applyConstraintEdit(requirement.constraints, { ...batch, state: 'confirmed', verifiedBy: '业务顾问' });
    const edited = { ...requirement, constraints: confirmed };
    const html = renderToStaticMarkup(createElement(RequirementConstraints, { requirement: edited, onEdit: () => undefined }));
    expect(html.match(/aria-label="编辑数量"/g)).toHaveLength(1);
    const match = matchDecision(edited);
    const version = buildDecisionVersion({
      projectId: 'breakdown', previous: null, requirement: edited, match, candidate: match.recommended, revision: null,
    });
    const saved = JSON.parse(JSON.stringify(buildDecisionExport(version, null)));
    expect(saved.version.requirement.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'quantity', value: 26, state: 'confirmed', quantityScope: 'batch' }),
      expect.objectContaining({ ...split }),
    ]));
    expect(requirement.constraints.filter(({ field }) => field === 'quantity')).toMatchObject([
      { value: 26, quantityScope: 'batch' },
      { value: null, quote: '各尺码要多少', level: 'pending' },
    ]);
    expect(requirement.questions).toContainEqual({
      field: 'quantity', question: '各款或各组分别需要多少成衣？请注明单位。',
    });
  });

  it('keeps the whole order and an open size breakdown when revising or withdrawing a batch', () => {
    const input = brief('市集工作人员需要首批二十四套制服。全单七十二套。各尺码要多少，待负责人确认。');
    const requirement = buildLocalDecisionRequirement(input);
    const match = matchDecision(requirement);
    const version = buildDecisionVersion({
      projectId: 'revision', previous: null, requirement, match, candidate: match.recommended, revision: null,
    });
    const changed = previewDecisionRevision(version, '本批改成二十九套。')?.branches.find(({ option }) => option === 'accept');
    expect(changed?.canConfirm).toBe(true);
    expect(changed?.requirement.constraints.filter(({ field }) => field === 'quantity')).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 29, quantityScope: 'batch' }),
      expect.objectContaining({ value: 72, quantityScope: 'order' }),
      expect.objectContaining({ value: null, quote: '各尺码要多少' }),
    ]));
    const impossible = previewDecisionRevision(version, '本批改成九十套。');
    expect(impossible?.conflicts).toContainEqual(expect.objectContaining({ field: 'quantity' }));
    expect(impossible?.branches.some(({ option, canConfirm }) => option === 'accept' && canConfirm)).toBe(false);
    const withdrawn = previewDecisionRevision(version, '本批数量不再要求。')?.branches.find(({ option }) => option === 'accept');
    expect(withdrawn?.canConfirm).toBe(true);
    expect(withdrawn?.requirement.constraints.filter(({ field }) => field === 'quantity')).toMatchObject([
      { value: 72, quantityScope: 'order' },
      { value: null, quote: '各尺码要多少' },
      { value: null, quote: '本批数量不再要求' },
    ]);
    const fresh = refreshDecisionRequirement(brief('各尺码要多少，待负责人确认。'), changed!.requirement);
    expect(fresh.constraints.filter(({ field }) => field === 'quantity')).toMatchObject([
      { value: 29, quantityScope: 'batch', state: 'confirmed' },
      { value: null, quote: '各尺码要多少' },
    ]);
    const withoutBreakdown = { ...version, requirement: {
      ...requirement, constraints: requirement.constraints.filter((item) => item.quote !== '各尺码要多少'),
    } };
    const withNewBreakdown = previewDecisionRevision(withoutBreakdown, '本批改成二十九套，各尺码要多少。')
      ?.branches.find(({ option }) => option === 'accept');
    expect(withNewBreakdown?.requirement.constraints.filter(({ field }) => field === 'quantity')).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 29, quantityScope: 'batch' }),
      expect.objectContaining({ value: null, quote: '各尺码要多少' }),
    ]));
  });

  it('grounds a workwear commission in the named business roles', () => {
    const rawNarrative = '博物馆夜场的工作服。行政规定必须用羊毛，后勤要求禁止羊毛。';
    const requirement = buildLocalDecisionRequirement(brief(rawNarrative));
    expect(requirement.constraints.find(({ field }) => field === 'businessType')).toMatchObject({
      state: 'explicit', value: 'corporate_uniform', quote: rawNarrative.slice(0, -1),
    });
    expect(requirement.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'fabric', op: 'eq', value: 'wool' }),
      expect.objectContaining({ field: 'fabric', op: 'neq', value: 'wool' }),
    ]));
  });
});

describe('online pending details', () => {
  const input = brief('初秋的团体职业服，先定二十八套西装。');
  const local = buildLocalDecisionRequirement(input);
  const baseline = decisionPresentation(local);
  const notes = ['讲解组各配多少件，等名单齐了再分。', '洗护要求待场务确认。'];
  const questions = ['分几天交货？'];
  const online = {
    ...baseline, engineUsed: 'llm_api' as const, followUpQuestions: questions,
    threeBuckets: { ...baseline.threeBuckets, needsHumanVerification: notes },
  };

  it('shows model pending details and questions in the normal review and archives them with the decision', () => {
    const requirement = applyOnlineRequirementReview(local, online);
    const rendered = renderToStaticMarkup(createElement(RequirementConstraints, { requirement }));
    expect(rendered).toContain('在线拆解待核');
    expect(rendered).toContain(notes[0]);
    expect(rendered).toContain(questions[0]);
    const match = matchDecision(requirement);
    const version = buildDecisionVersion({
      projectId: 'online', previous: null, requirement, match, candidate: match.recommended, revision: null,
    });
    const downloaded = JSON.parse(JSON.stringify(buildDecisionExport(version, null)));
    expect(downloaded.version.requirement.onlineReview).toEqual({ notes, questions });
    expect(buildDecisionMarkdown(downloaded.version, null)).toContain(notes[0]);
    expect(decisionPresentation(downloaded.version.requirement).threeBuckets.needsHumanVerification).toContain(notes[0]);
  });

  it('removes answered model topics after human confirmation and keeps independent open work', () => {
    const requirement = applyOnlineRequirementReview(local, online);
    const constraints = requirement.constraints.map((item) => item.field === 'care' ? {
      ...item, value: 'machine_wash', state: 'confirmed' as const, level: 'hard' as const,
    } : item);
    const edited = applyOnlineRequirementReview({ ...requirement, constraints, questions: buildClarificationQuestions(constraints) });
    expect(edited.onlineReview).toEqual({ notes: [notes[0]], questions });
    expect(refreshDecisionRequirement(brief('我想做一条连衣裙。'), edited).onlineReview).toBeUndefined();
    const match = matchDecision(requirement);
    const version = buildDecisionVersion({
      projectId: 'online', previous: null, requirement, match, candidate: match.recommended, revision: null,
    });
    const revised = previewDecisionRevision(version, '数量改为三十二套。')?.branches.find(({ option }) => option === 'accept');
    expect(revised?.requirement.constraints.find(({ field }) => field === 'quantity')).toMatchObject({
      value: 32, quantityScope: 'batch', state: 'confirmed',
    });
    expect(decisionInput(revised!.requirement).groupSize).toBe('本批 32 套');
    expect(revised?.requirement.onlineReview?.notes).toContain(notes[0]);
  });

  it('resolves each pending quantity only after confirmation of its own scope', () => {
    const batchNote = '首批件数待签字。';
    const totalNotes = ['累计数量待确认。', '累计总量待确认。'];
    const mixed = '首批数量和整单总量待确认。';
    const split = '各尺码分配数量待核。';
    const remainingApproval = '本批件数已获确认，余单尚需财务签核。';
    const batchQuestion = '本批要配几套制服？';
    const requirement = applyOnlineRequirementReview(local, {
      ...online,
      followUpQuestions: [...questions, batchQuestion],
      threeBuckets: { ...online.threeBuckets, needsHumanVerification: [batchNote, ...totalNotes, mixed, split, remainingApproval] },
    });
    const batch = requirement.constraints.find(({ field }) => field === 'quantity')!;
    const confirmedBatch = { ...batch, state: 'confirmed' as const };
    const afterBatch = applyOnlineRequirementReview({
      ...requirement,
      constraints: requirement.constraints.map((item) => item.id === batch.id ? confirmedBatch : item),
    });
    expect(afterBatch.onlineReview).toEqual({ notes: [...totalNotes, mixed, split, remainingApproval], questions });
    const afterTotal = applyOnlineRequirementReview({
      ...afterBatch,
      constraints: [...afterBatch.constraints, {
        ...confirmedBatch, id: 'entire-order', value: 50, quantityScope: 'order', quote: null,
      }],
    });
    expect(afterTotal.onlineReview?.notes).toEqual([split, remainingApproval]);
  });
});
