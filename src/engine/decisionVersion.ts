import { FABRICS } from '../data/fabrics';
import type {
  CandidateCombination,
  Constraint,
  ConstraintField,
  DecisionRequirement,
  MatchResult,
  Revision,
  Version,
} from '../types/decisions';
import type { DeconstructedRequirement, OfficialSpecItem, RequirementInput } from '../types/sartoria';
import { buildColorSpec } from './colorPresentation';
import { deconstructLocally } from './deconstructEngine';
import { evaluateFeasibility } from './matchingEngine';
import { generateVisualPromptPack } from './promptEngine';
import { generateProposalDraft } from './proposalEngine';
import { describeRequirementValue, extractRevisionConstraints, requirementFields } from './requirementInterview';
import { quantityScopeOf } from './requirementQuantity';

function statement(requirement: DecisionRequirement, field: ConstraintField): Constraint | undefined {
  if (requirement.constraints.some((constraint) => constraint.field === field && constraint.blocking)) return undefined;
  const known = requirement.constraints.filter((constraint) => constraint.field === field &&
    constraint.op === 'eq' && constraint.value !== null && constraint.level !== 'pending');
  const order = field === 'quantity' ? known.filter((item) => quantityScopeOf(item) === 'order' && item.state !== 'suggested') : [];
  const options = order.length ? order : known;
  return options.find((constraint) => constraint.state === 'confirmed') ??
    options.find((constraint) => constraint.state === 'explicit') ?? options[0];
}

function groundOnlineArchetype(requirement: DecisionRequirement, title: string): string {
  const exclusions = requirement.constraints.filter(({ field, op, state, level }) => field === 'luster' && op === 'neq' &&
    (state === 'confirmed' || state === 'explicit') && level !== 'pending');
  if (!exclusions.length || exclusions.some(({ value }) => value !== 'high')) return title;

  const chosenLuster = statement(requirement, 'luster');
  if (chosenLuster?.value === 'low' && chosenLuster.state !== 'suggested') return title;

  // Compact ranges in a headline allow medium sheen as well.
  const titleForParsing = title.replace(/中低光泽|低光泽(?:至|到)中等?光泽|中等光泽/gu, '微光泽');
  const assertsLow = extractRevisionConstraints({ id: 'archetype', text: titleForParsing }, 'initial')
    .some(({ field, op, value }) => field === 'luster' && op === 'eq' && value === 'low');
  if (!assertsLow) return title;

  const direction = (['style', 'fabric', 'category'] as const).map((field) => {
    const choice = statement(requirement, field);
    return choice?.level === 'hard' && choice.state !== 'suggested' ? describeRequirementValue(field, choice.value) : '';
  }).join('');
  const lusterBoundary = exclusions.some(({ level }) => level === 'hard') ? '避开高光泽' : '倾向避开高光泽';
  return `${direction || '定制成衣'} · ${lusterBoundary}`;
}

export function decisionInput(requirement: DecisionRequirement, candidate?: CandidateCombination | null): RequirementInput {
  const { input } = requirement;
  const business = statement(requirement, 'businessType')?.value;
  const quantity = statement(requirement, 'quantity');
  const season = statement(requirement, 'season')?.value;
  return {
    ...input,
    businessType: business === 'corporate_uniform' || business === 'private_couture' ? business : input.businessType,
    groupSize: quantity ? describeRequirementValue('quantity', quantity.value,
      quantity.quote ?? (quantity.state === 'suggested' ? input.groupSize : null), quantity.quantityScope) : input.groupSize,
    season: season === 'spring' || season === 'summer' || season === 'autumn' || season === 'winter' || season === 'all_season'
      ? season : input.season,
    targetSceneId: candidate?.config.sceneId ?? input.targetSceneId,
  };
}

export function decisionPresentation(
  requirement: DecisionRequirement,
  presentation = deconstructLocally(decisionInput(requirement), requirement.constraints),
): DeconstructedRequirement {
  const color = buildColorSpec(requirement.constraints);
  const colorSpecifiedByUser = color.provenance === 'user_explicit';
  const officialSpecs = presentation.officialSpecs.map((spec): OfficialSpecItem => {
    if (spec.key === 'color') return { ...spec, ...color };
    const value = statement(requirement, spec.key);
    const assertions = requirement.constraints.filter((item) => item.field === spec.key);
    const pending = assertions.find((item) => item.state === 'unknown' &&
      (item.sourceTurnId !== null || item.blocking || item.verifiedBy !== null));
    const exclusions = assertions.filter((item) => item.op === 'neq' && item.value !== null && item.level === 'hard');
    if (!value && (pending || exclusions.length)) {
      const facts = exclusions.map((item) => `排除${describeRequirementValue(item.field, item.value)}`);
      return { ...spec, value: [...facts, '具体选项待确认'].join('，'), provenance: 'needs_human_verification',
        constraintKind: 'pending', sourceQuote: pending?.quote ?? exclusions[0]?.quote ?? null,
        sourceNote: pending?.reason ?? '已记录排除项，具体选项由顾问与客户复核。' };
    }
    if (!value) return spec;
    const label = describeRequirementValue(spec.key, value.value);
    return {
      ...spec,
      value: value.level === 'preference' ? `${label}（偏好）` : label,
      provenance: value.state === 'suggested' ? 'system_suggested' : 'user_explicit',
      sourceNote: value.state === 'confirmed'
        ? `定制业务专员已确认${value.quote ? ` · 原话「${value.quote}」` : ''}`
        : value.quote ? `原话「${value.quote}」` : value.reason ?? undefined,
    };
  });
  const originalBuckets = presentation.threeBuckets;
  const onlineReview = requirement.onlineReview;
  const reviewNotes = presentation.engineUsed === 'llm_api' ? [] : originalBuckets.needsHumanVerification;
  const sourcedConstraints = requirement.constraints.filter(({ state }) => state === 'confirmed' || state === 'explicit');
  return {
    ...presentation,
    aestheticArchetype: presentation.engineUsed === 'llm_api'
      ? groundOnlineArchetype(requirement, presentation.aestheticArchetype) : presentation.aestheticArchetype,
    colorSpecifiedByUser,
    officialSpecs,
    dimensions: presentation.dimensions.map((dimension) => dimension.key === 'colorSystem'
      ? { ...dimension, value: color.value, detail: '最终按顾问与客户核定的实物色卡确认成衣用色。' }
      : dimension),
    threeBuckets: {
      ...originalBuckets,
      userExplicit: sourcedConstraints.map(({ field, op, value, level, quote, quantityScope }) =>
        `${requirementFields[field].label}：${op === 'neq' ? '排除 ' : ''}${describeRequirementValue(field, value, quote, quantityScope)}${level === 'preference' ? '（偏好）' : ''}`),
      needsHumanVerification: [...new Set([...reviewNotes, ...(onlineReview?.notes ?? [])])],
    },
    followUpQuestions: onlineReview?.questions ?? (presentation.engineUsed === 'llm_api' ? [] : presentation.followUpQuestions),
  };
}

export function buildDecisionVersion({ projectId, previous, requirement, match, candidate, revision, now = new Date().toISOString() }: {
  projectId: string;
  previous: Version | null;
  requirement: DecisionRequirement;
  match: MatchResult;
  candidate: CandidateCombination | null;
  revision: Revision | null;
  now?: string;
}): Version {
  const number = (previous?.number ?? 0) + 1;
  const id = `${projectId}:v${number}`;
  const approved = candidate?.status === 'eligible' ? candidate : null;
  const version: Version = {
    id, projectId, number, parentVersionId: previous?.id ?? null, createdAt: now,
    requirement, match, candidate: approved, proposal: null, promptPack: null, revision,
  };
  if (approved) {
    const input = decisionInput(requirement, approved);
    const deconstructed = decisionPresentation(requirement);
    const { config } = approved;
    const feasibility = evaluateFeasibility(input, config, deconstructed);
    const proposal = generateProposalDraft(input, deconstructed, config, feasibility, {
      similarCaseIds: approved.referenceCaseIds,
      fabricRationale: {
        styleFit: approved.comparison.style,
        comfortFit: approved.comparison.comfort,
        bodyFit: approved.comparison.fit,
      },
    });
    proposal.id = id;
    proposal.generatedAt = now;
    proposal.dataSourceStatement = '版型、面料、工艺和案例来自模拟静态目录。来源与逐字段证据随交接包保存，实际洗护、量体及制作由人工复核。';
    const prompts = generateVisualPromptPack(input, deconstructed, config);
    const fabric = FABRICS.find((asset) => asset.id === config.fabricId);
    if (fabric) prompts.deliveryBrief.push(`材质参考：${fabric.code} · ${fabric.composition} · ${fabric.luster}。`);
    prompts.generatedAt = now;
    version.proposal = proposal;
    version.promptPack = prompts;
  }
  return structuredClone(version);
}
