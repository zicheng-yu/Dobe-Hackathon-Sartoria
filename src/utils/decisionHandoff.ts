import { CRAFTS } from '../data/crafts';
import { buildColorSpec, colorReviewText } from '../engine/colorPresentation';
import { findConstraintChanges } from '../engine/decisionRevisions';
import { describeRequirementValue } from '../engine/requirementInterview';
import type { Constraint, ConstraintChange, ConstraintField, DecisionExport, HandoffReview, Version } from '../types/decisions';
import { buildPromptPackMarkdown } from './exporters';

const FIELD_LABELS: Record<ConstraintField, string> = {
  businessType: '业务类型',
  quantity: '数量',
  scene: '场景',
  season: '季节',
  category: '品类',
  patternStructure: '版型结构',
  collar: '领型',
  fabric: '材质',
  color: '色系',
  motif: '纹样',
  lengthRatio: '长度比例',
  easeAllowance: '活动余量',
  closure: '扣合方式',
  care: '洗护',
  wrinkleResistance: '抗皱',
  luster: '光泽',
  style: '风格',
  craft: '工艺',
};

const VALUE_LABELS: Readonly<Record<string, string>> = {
  private_couture: '个人定制', corporate_uniform: '团体职业服',
  indoor_formal: '室内正式', outdoor_stage: '户外舞台', indoor_performance: '室内演出', formal_evening: '正式晚宴',
  spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季', all_season: '四季通用',
  jacket: '外套', two_piece: '两件式', suit: '西服套装', dress: '连衣礼服', h_line: 'H 型直身',
  cross_open: '交领开襟', stand: '立领', lapel: '驳领', diagonal: '斜襟',
  silk: '真丝', blend: '混纺', wool: '羊毛', polyester: '涤纶', acetate: '醋酸', velvet: '丝绒',
  navy: '藏青', stone_gray: '暖灰', pine_green: '松墨绿', obsidian: '炭黑', crimson: '绯红',
  ivory: '月白', ivory_rose: '米白撞亮粉', earth_brown: '茶褐', neutral_silk: '中性丝调',
  champagne: '香槟色', mist_blue: '雾蓝',
  subtle_jacquard: '细暗纹', plain: '素面', mid_hip: '臀中', ankle: '及踝', floor: '曳地', tailored_suit: '西装比例',
  arm_mobility: '抬臂舒展', standard: '常规放量', no_visible_buttons: '无外露纽扣', visible_buttons: '有外露纽扣',
  machine_wash: '可机洗', dry_clean: '专业干洗', hand_wash: '手洗',
  high: '高光泽', medium: '中等光泽', low: '低光泽',
  traditional_uniform: '传统制服', modern: '现代风格', new_chinese: '新中式',
};

export const REVISION_OPTION_LABELS = {
  keep: '保留原硬条件',
  accept: '确认更改要求',
  defer: '挂起并交由人工复核',
};

const SOURCE_LABELS = {
  official_case: '官方案例参考',
  public_reference: '公开资料参考',
  team_simulation: '团队模拟目录',
};

const OUTCOME_LABELS = {
  satisfies: '满足',
  conflict: '冲突',
  unknown: '证据待核',
  reference: '参考',
};

const ASSET_FIELD_LABELS: Readonly<Record<string, string>> = {
  candidate: '组合',
  onlineReview: '在线拆解待核',
  onlineQuestion: '在线建议追问',
  pattern: '版型',
  fitGuidance: '试身参考',
  drape: '垂感',
  textileReference: '纺织资料',
  compatibleFabrics: '织法兼容',
  suitableBusiness: '适用业务',
  suitableScenes: '适用场景',
};

export const HANDOFF_BOUNDARIES = [
  '目录、参考图与提示词均为模拟设计资料。',
  '实物色卡、洗护与合规结论须按样布和工坊资料核定。',
  '量体、CAD 定版、打样、报价、签约和下单由人工执行。',
];

export function decisionFieldLabel(field: string): string {
  return FIELD_LABELS[field as ConstraintField] ?? ASSET_FIELD_LABELS[field] ?? field;
}

export function decisionValueLabel(constraint: Constraint | null): string {
  if (constraint?.field === 'color' && constraint.value === null && constraint.blocking) return '用色要求待核';
  if (!constraint || constraint.value === null) return '待确认';
  const value = constraint.value;
  const label = constraint.field === 'quantity'
    ? describeRequirementValue(constraint.field, value, constraint.quote, constraint.quantityScope)
    : typeof value === 'boolean' ? (value ? '要求抗皱' : '无需抗皱')
    : VALUE_LABELS[String(value)] ?? CRAFTS.find((craft) => craft.id === value)?.shortName ?? String(value);
  return constraint.op === 'neq' ? `排除 ${label}` : label;
}

export interface SummarizedConstraintChange {
  field: ConstraintField;
  before: string;
  after: string;
  quotes: string[];
}

export function summarizeConstraintChanges(changes: ConstraintChange[]): SummarizedConstraintChange[] {
  const byField = new Map<ConstraintField, ConstraintChange[]>();
  for (const change of changes) {
    const bucket = byField.get(change.field);
    if (bucket) bucket.push(change);
    else byField.set(change.field, [change]);
  }
  return [...byField.entries()].map(([field, entries]) => {
    const beforeConcrete = [...new Set(
      entries.filter((item) => item.previous && item.previous.value !== null).map((item) => decisionValueLabel(item.previous)),
    )];
    const beforeFallback = [...new Set(entries.map((item) => decisionValueLabel(item.previous)))];
    const before = (beforeConcrete.length ? beforeConcrete : beforeFallback).join('、');

    const positiveAfter = [...new Set(
      entries
        .filter((item) => item.next && item.next.value !== null && item.next.op !== 'neq')
        .map((item) => decisionValueLabel(item.next)),
    )];
    const excludedAfter = [...new Set(
      entries
        .filter((item) => item.next && item.next.value !== null && item.next.op === 'neq')
        .map((item) => decisionValueLabel(item.next)),
    )];
    const pendingAfter = [...new Set(
      entries
        .filter((item) => !item.next || item.next.value === null)
        .map((item) => decisionValueLabel(item.next)),
    )];

    let after: string;
    if (positiveAfter.length > 0 && excludedAfter.length > 0) {
      after = `${positiveAfter.join('、')}（${excludedAfter.join('、')}）`;
    } else if (positiveAfter.length > 0) {
      after = positiveAfter.join('、');
    } else if (excludedAfter.length > 0) {
      after = excludedAfter.join('、');
    } else {
      after = pendingAfter.join('、') || '待确认';
    }

    const quotes = [...new Set(
      entries.map((item) => item.next?.quote?.trim()).filter((quote): quote is string => Boolean(quote)),
    )];
    return { field, before, after, quotes };
  });
}

export function decisionSourceLabel(kind: keyof typeof SOURCE_LABELS): string {
  return SOURCE_LABELS[kind];
}

export function decisionOutcomeLabel(outcome: keyof typeof OUTCOME_LABELS): string {
  return OUTCOME_LABELS[outcome];
}

function humanReview(field: string, nextStep: string): HandoffReview {
  const owner = field === 'care' || field === 'wrinkleResistance' ? '面料与质检专员'
    : ['fabric', 'luster', 'motif', 'color'].includes(field) ? '面料顾问'
    : ['pattern', 'patternStructure', 'category', 'collar', 'closure', 'lengthRatio', 'easeAllowance', 'craft'].includes(field) ? '版师与工坊'
    : '定制业务专员';
  return { field, owner, nextStep };
}

export function buildDecisionExport(version: Version, previous: Version | null): DecisionExport {
  const parent = previous?.id === version.parentVersionId && previous.projectId === version.projectId ? previous : null;
  const reviews = new Map<string, HandoffReview>();
  for (const question of version.requirement.questions) {
    reviews.set(question.field, humanReview(question.field, question.question));
  }
  const color = buildColorSpec(version.requirement.constraints);
  const colorReview = colorReviewText({ officialSpecs: [color], colorSpecifiedByUser: color.provenance === 'user_explicit' });
  if (colorReview) {
    reviews.set('color', humanReview('color', `${colorReview}。${color.sourceNote ?? ''}请与客户核对可用实物色卡。`));
  }
  for (const constraint of version.requirement.constraints) {
    if ((constraint.level === 'pending' || constraint.value === null) && !reviews.has(constraint.field)) {
      reviews.set(constraint.field, humanReview(
        constraint.field,
        constraint.reason ?? `请确认${decisionFieldLabel(constraint.field)}后更新需求。`,
      ));
    }
  }
  const selected = version.candidate ?? version.match.review[0];
  for (const evidence of selected?.evidence ?? []) {
    if (evidence.outcome === 'unknown' && !reviews.has(evidence.field)) {
      reviews.set(evidence.field, humanReview(evidence.field, `${evidence.detail} 请按目录编号 ${evidence.assetCode} 核实。`));
    }
  }
  if (!version.candidate) {
    reviews.set('candidate', humanReview('candidate', '根据待核项和拒绝理由补证，或请客户确认是否调整硬条件。'));
  }
  if (!reviews.has('care')) {
    reviews.set('care', humanReview('care', '凭实物样布及正式洗护标准核对成衣养护条件。'));
  }
  reviews.set('pattern', humanReview('pattern', '线下核对量体、活动余量和样衣试身后再定版。'));

  return structuredClone({
    schemaVersion: 'sartoria_handoff_v1',
    simulated: true,
    version,
    previousVersionId: version.parentVersionId,
    versionChanges: parent ? findConstraintChanges(parent.requirement.constraints, version.requirement.constraints) : [],
    reviews: [
      ...reviews.values(),
      ...(version.requirement.onlineReview?.notes ?? []).map((note) => humanReview('onlineReview', note)),
      ...(version.requirement.onlineReview?.questions ?? []).map((question) => humanReview('onlineQuestion', question)),
    ],
    boundaries: HANDOFF_BOUNDARIES,
  });
}

export function buildDecisionMarkdown(version: Version, previous: Version | null): string {
  const handoff = buildDecisionExport(version, previous);
  const revision = version.revision;
  const candidateEntries = [
    ['选定组合', version.candidate],
    ['主推', version.match.recommended],
    ['替代', version.match.alternative],
    ['待核', version.match.review[0]],
    ['拒绝示例', version.match.rejected[0]],
  ] as const;
  const shown = new Set<string>();
  const candidateLines = candidateEntries.flatMap(([name, candidate]) => {
    if (!candidate || shown.has(candidate.id)) return [];
    shown.add(candidate.id);
    const config = candidate.config;
    return [
      `### ${name} · ${candidate.id}`,
      '',
      `- 资产 ID：${[config.patternId, config.fabricId, ...config.craftIds, config.sceneId].join(' / ')}`,
      ...candidate.decisionReasons.map((reason) => `- ${reason}`),
      ...candidate.evidence.map((entry) =>
        `- ${entry.assetCode} (${entry.assetId}) · ${decisionFieldLabel(entry.field)} · ${decisionOutcomeLabel(entry.outcome)} · ${entry.detail} · ${decisionSourceLabel(entry.source.kind)} ${entry.source.reference}`,
      ),
      '',
    ];
  });

  return [
    `# ${version.requirement.input.projectName} · V${version.number} 设计交接`,
    '',
    `- 版本 ID：${version.id}`,
    `- 项目 ID：${version.projectId}`,
    `- 前版 ID：${handoff.previousVersionId ?? '首版'}`,
    `- 保存时间：${version.createdAt}`,
    '- 模拟设计资料',
    '',
    '## 客户原话',
    '',
    ...version.requirement.turns.flatMap((turn) => [
      `### ${turn.id}`,
      '',
      ...turn.text.split(/\r?\n/).map((line) => `> ${line}`),
      '',
    ]),
    '## 需求与证据',
    '',
    ...version.requirement.constraints.map((item) => {
      const tier = item.level === 'hard' ? '必须' : item.level === 'preference' ? '偏好' : '待核';
      const provenance = [item.sourceTurnId, item.quote && `「${item.quote}」`, item.verifiedBy].filter(Boolean).join(' · ');
      const pendingDetail = item.level === 'pending' && item.quote && item.reason ? ` · ${item.reason}` : '';
      return `- ${tier} · ${decisionFieldLabel(item.field)} · ${decisionValueLabel(item)}${provenance ? ` · ${provenance}` : ''}${pendingDetail}`;
    }),
    '',
    '## 组合与目录依据',
    '',
    ...(version.match.status === 'no_match' ? ['暂无满足硬条件的组合。', ''] : []),
    ...candidateLines,
    ...(version.proposal ? [
      '## 选定方案',
      '',
      version.proposal.stylePositioning,
      '',
      `- 版型 · ${version.proposal.patternSummary}`,
      `- 面料 · ${version.proposal.fabricSummary}`,
      `- 工艺 · ${version.proposal.craftSummary}`,
      `- 场景 · ${version.proposal.sceneAdaptation}`,
      '',
    ] : []),
    '## 版本差异',
    '',
    ...(revision ? [
      `- 人工选项：${REVISION_OPTION_LABELS[revision.selectedOption]}`,
      `- 反馈原话：「${revision.turn.text}」`,
      ...revision.impacts.map(({ detail }) => `- ${detail}`),
    ] : ['- 首版需求快照']),
    ...summarizeConstraintChanges(handoff.versionChanges).map(({ field, before, after }) =>
      `- ${decisionFieldLabel(field)}：${before} → ${after}`,
    ),
    '',
    '## 人工接手',
    '',
    ...handoff.reviews.map((review) => `- ${decisionFieldLabel(review.field)} · ${review.owner} · ${review.nextStep}`),
    ...handoff.boundaries.map((boundary) => `- ${boundary}`),
    '',
    ...(version.promptPack ? [buildPromptPackMarkdown(version.promptPack)] : []),
  ].join('\n');
}
