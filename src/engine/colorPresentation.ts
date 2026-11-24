import type { Constraint } from '../types/decisions';
import type { DeconstructedRequirement, OfficialSpecItem } from '../types/sartoria';
import { describeRequirementValue } from './requirementInterview';

export function buildColorSpec(constraints: readonly Constraint[]): OfficialSpecItem {
  const colors = constraints.filter(({ field }) => field === 'color');
  const pending = colors.find(({ blocking }) => blocking) ?? colors.find((item) =>
    item.state === 'unknown' && (item.sourceTurnId !== null || item.verifiedBy !== null));
  const stated = colors.filter(({ value, state }) => value !== null && (state === 'explicit' || state === 'confirmed'));
  const chosen = stated.filter(({ op }) => op === 'eq');
  const specified = !pending?.blocking && chosen.length > 0;
  const source = specified ? chosen.find(({ level }) => level === 'hard') ?? chosen[0] : pending ?? stated[0];
  const kind = specified ? (source?.level === 'hard' ? 'hard' : 'soft')
    : !pending?.blocking && stated.some(({ op }) => op === 'neq') ? 'excluded' : 'pending';
  const values = stated.map(({ op, value, level }) =>
    `${op === 'neq' ? '排除' : ''}${describeRequirementValue('color', value)}${level === 'preference' ? '（偏好）' : ''}`);
  if (!specified) values.push(pending?.blocking ? '用色要求待核' : '成衣颜色待确认');

  return {
    key: 'color',
    label: '色彩',
    value: values.join('，'),
    provenance: specified ? 'user_explicit' : 'needs_human_verification',
    constraintKind: kind,
    sourceQuote: source?.quote ?? null,
    sourceNote: source ? source.reason ?? '最终以实物色卡核色为准。' : undefined,
  };
}

export function colorReviewText(presentation: Pick<DeconstructedRequirement, 'officialSpecs' | 'colorSpecifiedByUser'>): string | null {
  if (presentation.colorSpecifiedByUser) return null;
  const color = presentation.officialSpecs?.find(({ key }) => key === 'color');
  if (color?.sourceQuote) return `${color.value}。客户原话「${color.sourceQuote}」`;
  return color?.constraintKind === 'excluded' || (color?.constraintKind === 'pending' && color.sourceNote) ? color.value : null;
}
