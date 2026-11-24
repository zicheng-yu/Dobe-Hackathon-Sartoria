import { CONSTRAINT_FIELDS, REQUIREMENT_SCHEMA_VERSION } from '../types/decisions';
import type { ClarificationQuestion, Constraint, DecisionRequirement, RequirementTurn } from '../types/decisions';
import type { DimensionItem, OfficialSpecItem, RequirementInput } from '../types/sartoria';
import {
  buildClarificationQuestions, buildLocalDecisionRequirement, constraintsConflict, extractRevisionConstraints,
  isRequirementValue, sameQuantityScope,
} from './requirementInterview';
import { namedQuantityScope } from './requirementQuantity';

const PROFESSIONAL_FIELDS = ['category', 'patternStructure', 'collar', 'fabric', 'color', 'motif', 'lengthRatio', 'easeAllowance'] as const satisfies OfficialSpecItem['key'][];
const DIMENSION_FIELDS = ['styleTone', 'silhouetteReq', 'fabricTexture', 'craftDetail', 'colorSystem', 'sceneFit'] as const satisfies DimensionItem['key'][];

type Schema =
  | { type: 'object'; properties: Record<string, Schema>; required: string[]; additionalProperties: false }
  | { type: 'array'; items: Schema; minItems?: number; maxItems?: number }
  | { type: 'string'; enum?: readonly string[] }
  | { type: 'integer'; minimum?: number; maximum?: number }
  | { type: 'boolean' | 'null' }
  | { anyOf: readonly Schema[] };

function object(properties: Record<string, Schema>): Schema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const string = { type: 'string' } as const;
const nil = { type: 'null' } as const;
const nullableText = { anyOf: [string, nil] } as const;
const statuses = { type: 'string', enum: ['explicit', 'suggested', 'unknown'] } as const;
const presentationField = {
  value: nullableText, state: statuses, level: { type: 'string', enum: ['preference', 'pending'] },
  sourceTurnId: nullableText, quote: nullableText, reason: nullableText,
} satisfies Record<string, Schema>;

// The transport carries only model-editable fields. The trusted brief and editor identity come from the application.
export const requirementResponseSchema = object({
  schemaVersion: { type: 'string', enum: [REQUIREMENT_SCHEMA_VERSION] },
  constraints: { type: 'array', minItems: PROFESSIONAL_FIELDS.length, maxItems: 72, items: object({
    id: string, field: { type: 'string', enum: CONSTRAINT_FIELDS },
    op: { type: 'string', enum: ['eq', 'neq'] },
    value: { anyOf: [string, { type: 'integer', minimum: 1 }, { type: 'boolean' }, nil] },
    level: { type: 'string', enum: ['hard', 'preference', 'pending'] },
    state: statuses, sourceTurnId: nullableText, quote: nullableText, verifiedBy: nil, reason: nullableText,
  }) },
  questions: { type: 'array', maxItems: 2, items: object({
    field: { type: 'string', enum: CONSTRAINT_FIELDS }, question: string,
  }) },
  dimensions: object(Object.fromEntries(DIMENSION_FIELDS.map((field) => [field, object({
    ...presentationField, score: { anyOf: [{ type: 'integer', minimum: 0, maximum: 100 }, nil] },
  })]))),
  aestheticArchetype: object(presentationField),
  emotionTags: { type: 'array', maxItems: 6, items: object(presentationField) },
});

interface PresentationField {
  value: string | null;
  state: 'explicit' | 'suggested' | 'unknown';
  level: 'preference' | 'pending';
  sourceTurnId: string | null;
  quote: string | null;
  reason: string | null;
}

export interface RequirementPresentation {
  dimensions: Record<DimensionItem['key'], PresentationField & { score: number | null }>;
  aestheticArchetype: PresentationField;
  emotionTags: PresentationField[];
}

export type RequirementModelResponse = RequirementPresentation & {
  schemaVersion: typeof REQUIREMENT_SCHEMA_VERSION;
  constraints: Constraint[];
  questions: ClarificationQuestion[];
};

export type RequirementResponseResult =
  | { ok: true; requirement: DecisionRequirement; presentation: RequirementPresentation }
  | { ok: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function satisfiesSchema(schema: Schema, value: unknown): boolean {
  if ('anyOf' in schema) return schema.anyOf.some((option) => satisfiesSchema(option, value));
  switch (schema.type) {
    case 'object':
      return isRecord(value) && Object.keys(value).length === schema.required.length &&
        schema.required.every((key) => Object.hasOwn(value, key) && satisfiesSchema(schema.properties[key], value[key]));
    case 'array':
      return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) &&
        [...value].every((item) => satisfiesSchema(schema.items, item));
    case 'string':
      return typeof value === 'string' && (schema.enum?.includes(value) ?? true);
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
  }
}

function hasText(text: string | null): text is string {
  return Boolean(text?.trim());
}

function hasVerbatimQuote(item: Pick<Constraint, 'quote' | 'sourceTurnId'>, turns: Map<string, RequirementTurn>): boolean {
  return hasText(item.quote) && hasText(item.sourceTurnId) && Boolean(turns.get(item.sourceTurnId)?.text.includes(item.quote));
}

function hasNoQuote(item: Pick<Constraint, 'quote' | 'sourceTurnId'>): boolean {
  return item.quote === null && item.sourceTurnId === null;
}

function sameFact(left: Constraint, right: Constraint): boolean {
  return left.field === right.field && left.op === right.op && left.value === right.value &&
    left.level === right.level && left.state === right.state && left.sourceTurnId === right.sourceTurnId;
}

function sourcedUnknown(item: Constraint, facts: Constraint[]): Constraint | undefined {
  if (item.state !== 'unknown' || !item.quote) return;
  return facts.find((fact) => sameFact(fact, item) && fact.quote !== null && item.quote!.includes(fact.quote));
}

function validConstraint(item: Constraint, turns: Map<string, RequirementTurn>, facts: Constraint[], initialTurnId: string): boolean {
  if (!hasText(item.id) || item.verifiedBy !== null) return false;
  if (item.state === 'unknown') {
    if (item.level !== 'pending' || item.value !== null || item.op !== 'eq' || !hasText(item.reason)) return false;
    return hasNoQuote(item) || hasVerbatimQuote(item, turns) && Boolean(sourcedUnknown(item, facts));
  }
  if (!isRequirementValue(item.field, item.value)) return false;
  if (item.state === 'suggested') {
    return item.field !== 'color' && item.level === 'preference' && item.op === 'eq' && hasNoQuote(item) && hasText(item.reason);
  }
  if (item.state !== 'explicit' || item.level === 'pending' || !hasVerbatimQuote(item, turns)) return false;
  return facts.some((fact) => sameFact(fact, item) && fact.quote !== null && item.quote!.includes(fact.quote)) || (
    facts.some((fact) => sameFact(fact, item) && fact.quote?.includes(item.quote!)) &&
    extractRevisionConstraints({ id: item.sourceTurnId!, text: item.quote! }, item.sourceTurnId === initialTurnId ? 'initial' : 'revision')
      .some((fact) => sameFact(fact, item))
  );
}

function validPresentation(item: PresentationField, turns: Map<string, RequirementTurn>): boolean {
  if (item.state === 'unknown') return item.value === null && item.level === 'pending' && hasNoQuote(item) && hasText(item.reason);
  if (item.level !== 'preference' || !hasText(item.value)) return false;
  if (item.state === 'suggested') return hasNoQuote(item) && hasText(item.reason);
  return hasVerbatimQuote(item, turns) && Boolean(item.quote?.includes(item.value));
}

export function parseRequirementResponse(
  payload: unknown,
  input: RequirementInput,
  turns: RequirementTurn[] = [{ id: 'brief-1', text: input.rawNarrative }],
): RequirementResponseResult {
  let value: unknown = payload;
  if (typeof payload === 'string') {
    try {
      value = JSON.parse(payload);
    } catch {
      return { ok: false, issues: ['无法解析需求 JSON。'] };
    }
  }
  if (!satisfiesSchema(requirementResponseSchema, value)) {
    return { ok: false, issues: ['结构化需求不符合 sartoria_requirement_v1。'] };
  }
  const response = value as RequirementModelResponse;
  const { constraints, questions, dimensions, aestheticArchetype, emotionTags } = response;
  const sourceTurns = new Map(turns.map((turn) => [turn.id, turn]));
  if (sourceTurns.size !== turns.length || turns[0]?.text !== input.rawNarrative) {
    return { ok: false, issues: ['原始简报与访问记录不一致。'] };
  }
  const issues: string[] = [];
  const facts = turns.flatMap((turn, index) => extractRevisionConstraints(turn, index === 0 ? 'initial' : 'revision'));
  const pendingFacts = constraints.map((item) => sourcedUnknown(item, facts));
  const normalized = constraints.map((item, index) => {
    const fact = pendingFacts[index];
    if (fact) return { ...item, reason: fact.reason, blocking: fact.blocking, withdraws: fact.withdraws };
    if (item.field === 'quantity' && item.quote) {
      const sourced = facts.filter((known) => sameFact(known, item) && known.quote &&
        (item.quote!.includes(known.quote) || known.quote.includes(item.quote!)));
      const scopes = new Set(sourced.map(({ quantityScope }) => quantityScope));
      const statedScope = namedQuantityScope(item.quote);
      if (scopes.size > 1 && (!statedScope || !scopes.has(statedScope))) {
        issues.push('数量原话同时涉及整单及本批，须分别提供明确范围的引文。');
      }
      const scope = scopes.size === 1 ? scopes.values().next().value : statedScope;
      if (scope) return { ...item, quantityScope: scope };
    }
    return item;
  });
  const blockedFields = new Set(normalized.filter((item) => item.blocking).map(({ field }) => field));
  if (!PROFESSIONAL_FIELDS.every((field) => constraints.some((item) => item.field === field))) issues.push('八项专业字段必须逐项给出。');
  if (new Set(constraints.map(({ id }) => id)).size !== constraints.length) issues.push('约束 ID 重复。');
  for (const [index, constraint] of normalized.entries()) {
    if (!validConstraint(constraint, sourceTurns, facts, turns[0].id)) issues.push(`${constraint.field} 的值、状态或原话无法核实。`);
    const others = normalized.slice(index + 1).filter((item) => item.field === constraint.field);
    if (!blockedFields.has(constraint.field) && others.some((item) => constraintsConflict(constraint, item))) issues.push(`${constraint.field} 含互相冲突的硬约束。`);
    const unsourcedUnknown = (item: Constraint) => item.state === 'unknown' && item.sourceTurnId === null;
    if (others.some((item) => unsourcedUnknown(item) || unsourcedUnknown(constraint))) issues.push(`${constraint.field} 同时含无出处的未决项与其他状态。`);
    if (others.some((item) => sameFact(constraint, item) && sameQuantityScope(constraint, item))) issues.push(`${constraint.field} 含重复约束。`);
  }
  // Keep all locally verified statements and require a quoted pending item when the source conflicts.
  for (const fact of facts) {
    if (!normalized.some((item) => sameFact(fact, item) && sameQuantityScope(fact, item))) {
      issues.push(`${fact.field} 遗漏了原话中的明确或待确认项。`);
    }
  }
  const validQuestionFields = new Set(buildClarificationQuestions(normalized).map(({ field }) => field));
  if (new Set(questions.map(({ field }) => field)).size !== questions.length || questions.some((question) =>
    !hasText(question.question) || !validQuestionFields.has(question.field))) issues.push('追问须指向尚未决定的关键字段。');

  if ([...Object.values(dimensions), aestheticArchetype, ...emotionTags].some((item) => !validPresentation(item, sourceTurns)) ||
    Object.values(dimensions).some((item) => item.state !== 'suggested' && item.score !== null)) issues.push('审美字段的取值、依据或建议评分无法核实。');
  if (issues.length) return { ok: false, issues: [...new Set(issues)] };

  return {
    ok: true,
    requirement: {
      schemaVersion: REQUIREMENT_SCHEMA_VERSION, mode: 'validated', input, turns, questions,
      constraints: normalized,
    },
    presentation: { dimensions, aestheticArchetype, emotionTags },
  };
}

export function parseRequirementResponseOrFallback(payload: unknown, input: RequirementInput, turns?: RequirementTurn[]) {
  const parsed = parseRequirementResponse(payload, input, turns);
  if (parsed.ok) return parsed;
  return { ...parsed, requirement: buildLocalDecisionRequirement(input) };
}
