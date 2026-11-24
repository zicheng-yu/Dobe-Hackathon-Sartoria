import { DECISION_CATALOG, simulationSource } from '../data/decisionCatalog';
import { FABRICS } from '../data/fabrics';
import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SCENES, sceneFits } from '../data/scenes';
import type {
  AssetEvidence,
  AssetSource,
  CandidateCombination,
  Constraint,
  ConstraintField,
  ConstraintValue,
  DecisionRequirement,
  MatchResult,
} from '../types/decisions';
import type { ConfigurationState } from '../types/sartoria';
import { sameQuantityScope } from './requirementInterview';
import { describeOrderQuantity } from './requirementQuantity';

type PatternRecord = (typeof DECISION_CATALOG.patterns)[number];
type FabricRecord = (typeof DECISION_CATALOG.fabrics)[number];
type EvidenceAsset = { id: string; code: string; kind: AssetEvidence['kind']; source: AssetSource };
type Outcome = AssetEvidence['outcome'];

const patterns = new Map(DECISION_CATALOG.patterns.map((record) => [record.asset.id, record]));
const fabrics = new Map(DECISION_CATALOG.fabrics.map((record) => [record.asset.id, record]));
const crafts = new Map(DECISION_CATALOG.crafts.map((record) => [record.asset.id, record]));
const scenes = new Map(SCENES.map((scene) => [scene.id, scene]));

const fieldLabels: Record<ConstraintField, string> = {
  businessType: '业务类型', quantity: '订量', scene: '使用场景', season: '穿着季节',
  category: '成衣品类', patternStructure: '版型结构', collar: '领型', fabric: '材质',
  color: '颜色', motif: '纹样', lengthRatio: '长度比例', easeAllowance: '抬臂与松量',
  closure: '门襟扣件', care: '洗护', wrinkleResistance: '耐皱', luster: '光泽',
  style: '风格', craft: '工艺',
};

const valueLabels: Record<string, string | undefined> = {
  corporate_uniform: '团体职业服', private_couture: '个人定制',
  machine_wash: '可机洗', dry_clean: '专业干洗', hand_wash: '手洗',
  indoor_formal: '室内正式', outdoor_stage: '户外舞台',
  indoor_performance: '室内演出', formal_evening: '正式晚宴',
  autumn: '秋季', winter: '冬季', spring: '春季', summer: '夏季', all_season: '四季',
  jacket: '外套', two_piece: '两件式', suit: '职业套装', dress: '连衣裙／礼服',
  h_line: 'H 型', cross_open: '交领开襟', stand: '立领', lapel: '驳领', diagonal: '斜襟',
  silk: '真丝', blend: '混纺', wool: '羊毛', polyester: '聚酯为主', acetate: '醋酸为主', velvet: '丝绒',
  navy: '藏青', neutral_silk: '未指定颜色', obsidian: '黑色', crimson: '绯红',
  ivory: '米白', ivory_rose: '米白撞玫粉', stone_gray: '石灰色', pine_green: '松墨绿',
  subtle_jacquard: '暗纹提花', plain: '素面', mid_hip: '臀中', ankle: '及踝',
  floor: '及地', tailored_suit: '西装比例', arm_mobility: '肩背和袖部放量', standard: '常规放量',
  no_visible_buttons: '无外露纽扣', visible_buttons: '外露纽扣',
  low: '低光泽', medium: '中等光泽', high: '高光泽',
  traditional_uniform: '传统制服', modern: '现代', new_chinese: '新中式',
};

function describeValue(value: ConstraintValue): string {
  if (value === null) return '待核';
  if (value === true) return '是';
  if (value === false) return '否';
  return valueLabels[String(value)] ?? scenes.get(String(value))?.name ?? String(value);
}

function matchingValue(constraint: Constraint, equals: boolean): boolean {
  return constraint.op === 'eq' ? equals : !equals;
}

function constraintOutcome(constraint: Constraint, actual: ConstraintValue, equals: boolean): Outcome {
  if (constraint.state === 'unknown' || constraint.value === null || actual === null) return 'unknown';
  return matchingValue(constraint, equals) ? 'satisfies' : 'conflict';
}

function evidence(
  asset: EvidenceAsset,
  field: string,
  value: ConstraintValue,
  outcome: Outcome,
  detail: string,
  constraintId: string | null = null,
): AssetEvidence {
  return {
    constraintId, assetId: asset.id, assetCode: asset.code, kind: asset.kind,
    field, value, source: asset.source, outcome, detail,
  };
}

function teamEvidence(asset: EvidenceAsset): EvidenceAsset {
  return { ...asset, source: simulationSource(asset.kind, asset.code) };
}

function checkConstraint(
  asset: EvidenceAsset,
  constraint: Constraint,
  actual: ConstraintValue,
  equals = actual === constraint.value,
  actualText = describeValue(actual),
): AssetEvidence {
  const outcome = constraintOutcome(constraint, actual, equals);
  const requestedValue = constraint.field === 'quantity' && typeof constraint.value === 'number'
    ? describeOrderQuantity(constraint.value, constraint.quote, constraint.quantityScope) : describeValue(constraint.value);
  const requested = `${constraint.op === 'neq' ? '排除 ' : ''}${requestedValue}`;
  const label = `${asset.code} · ${fieldLabels[constraint.field]}`;
  const intent = constraint.level === 'preference' ? '偏好' : '要求';
  return evidence(asset, constraint.field, actual, outcome,
    `${label}：${intent}${requested}，目录记录为${actualText}。`, constraint.id);
}

function allowed(
  asset: EvidenceAsset,
  field: string,
  otherId: string,
  compatible: boolean,
  detail: string,
): AssetEvidence {
  return evidence(teamEvidence(asset), field, otherId, compatible ? 'satisfies' : 'conflict', detail);
}

function sameSet(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((id) => second.includes(id));
}

function matchReferences(config: ConfigurationState): { items: AssetEvidence[]; affinity: number } {
  const references = DECISION_CATALOG.cases
    .filter(({ asset }) => asset.patternId === config.patternId || asset.fabricId === config.fabricId)
    .map(({ asset, source }) => {
      const samePair = asset.patternId === config.patternId && asset.fabricId === config.fabricId;
      const sameCrafts = sameSet(asset.craftIds, config.craftIds);
      return { asset, source, affinity: samePair ? (sameCrafts ? 3 : 2) : 1 };
    })
    .sort((first, second) => second.affinity - first.affinity)
    .slice(0, 2);
  return {
    items: references.map(({ asset, source }) => evidence(
      { id: asset.id, code: asset.code, kind: 'case', source },
      'caseReference', asset.title, 'reference', '模拟历史案例参考，组合判定使用版型、面料与工艺字段。',
    )),
    affinity: references[0]?.affinity ?? 0,
  };
}

const careGuidance: Record<string, string | undefined> = {
  machine_wash: '模拟可低温机洗。陪同样衣核验辅料、拼缝和洗后变化。',
  dry_clean: '模拟目录标注专业干洗。核验样衣洗标。',
  hand_wash: '模拟目录标注手洗。核验样衣洗标。',
};

function evaluate(requirement: DecisionRequirement, config: ConfigurationState) {
  const pattern = patterns.get(config.patternId);
  const fabric = fabrics.get(config.fabricId);
  const scene = scenes.get(config.sceneId);
  const configuredFabric = fabric?.asset ?? FABRICS.find((item) => item.id === config.fabricId);
  const selectedCrafts = [...new Set(config.craftIds)].map((id) => ({ id, record: crafts.get(id) }));
  const patternAsset: EvidenceAsset = {
    id: config.patternId, code: pattern?.asset.code ?? config.patternId, kind: 'pattern',
    source: pattern?.source ?? simulationSource('pattern', config.patternId),
  };
  const fabricAsset: EvidenceAsset = {
    id: config.fabricId, code: configuredFabric?.code ?? config.fabricId, kind: 'fabric',
    source: fabric?.source ?? simulationSource('fabric', config.fabricId),
  };
  const craftAssets = selectedCrafts.map(({ id, record }) => ({
    id, code: record?.asset.code ?? id, kind: 'craft' as const,
    source: record?.source ?? simulationSource('craft', id),
  }));
  const structuralEvidence: AssetEvidence[] = [];
  if (pattern && selectedCrafts.length > 1 &&
      !pattern.profile.craftPackages.some((bundle) => selectedCrafts.every(({ id }) => bundle.includes(id)))) {
    structuralEvidence.push(evidence(teamEvidence(patternAsset), 'craftPackageCompatibility', null, 'unknown',
      '所选工艺缺少在该版型上共同使用的目录记录，组合需由工坊复核。'));
  }
  if (!pattern) {
    structuralEvidence.push(evidence(patternAsset, 'catalog', null, 'conflict', '版型 ID 未收录于当前目录。'));
  }
  if (!fabric) {
    structuralEvidence.push(configuredFabric
      ? evidence(fabricAsset, 'catalog', null, 'unknown', '旧版面料仅有视觉参考，组合属性待补录。')
      : evidence(fabricAsset, 'catalog', null, 'conflict', '面料 ID 未收录于当前目录。'));
  }
  if (!scene) {
    structuralEvidence.push(evidence(patternAsset, 'sceneCompatibility', config.sceneId, 'conflict', '场景 ID 未收录于当前目录。'));
  } else if (pattern && fabric) {
    const sceneMatches = pattern.asset.suitableScenes.includes(scene.id)
      && fabric.asset.suitableScenes.includes(scene.id)
      && scene.suitableBusiness.includes(pattern.asset.businessType);
    structuralEvidence.push(allowed(patternAsset, 'sceneCompatibility', scene.id, sceneMatches,
      sceneMatches ? `版型与面料均列入${scene.shortName}适配范围。` : `目录未将版型和面料同时列入${scene.shortName}适配范围。`));
  }
  if (pattern && fabric) {
    const fabricMatches = fabric.profile.compatiblePatternIds.includes(pattern.asset.id)
      && fabric.asset.suitableBusiness.includes(pattern.asset.businessType);
    structuralEvidence.push(allowed(fabricAsset, 'patternFabricCompatibility', pattern.asset.id, fabricMatches,
      `${fabric.asset.shortName}与${pattern.asset.code}${fabricMatches ? '属于目录内适用组合' : '超出目录内适用组合'}。`));
  }
  for (const [index, { record }] of selectedCrafts.entries()) {
    const resource = craftAssets[index];
    if (!record) {
      structuralEvidence.push(evidence(resource, 'catalog', null, 'conflict', '工艺 ID 未收录于当前目录。'));
      continue;
    }
    if (pattern && fabric) {
      const craftMatches = record.asset.compatibleFabrics.includes(fabric.asset.weave)
        && record.profile.compatiblePatternIds.includes(pattern.asset.id)
        && record.asset.suitableBusiness.includes(pattern.asset.businessType);
      structuralEvidence.push(allowed(resource, 'craftCompatibility', fabric.asset.id, craftMatches,
        `${record.asset.shortName}与${fabric.asset.shortName}、${pattern.asset.code}${craftMatches ? '的组合已列入模拟兼容表' : '超出模拟兼容表'}。`));
    }
  }

  const statedQuantities = requirement.constraints.filter((item) => item.field === 'quantity' &&
    item.op === 'eq' && item.level === 'hard' && typeof item.value === 'number');
  const quantityChecks = (constraint: Constraint) => [
    { record: pattern, asset: patternAsset }, { record: fabric, asset: fabricAsset },
  ].map(({ record, asset }) => {
    const range = record?.profile.quantity;
    const value = range ? `${range[0]}–${range[1]}` : null;
    const stated = constraint.op === 'neq' ? statedQuantities.find((item) => sameQuantityScope(item, constraint)) : undefined;
    if (typeof stated?.value === 'number') {
      return checkConstraint(teamEvidence(asset), constraint, stated.value,
        stated.value === constraint.value, `已确认的数量 ${describeOrderQuantity(stated.value, stated.quote, stated.quantityScope)}`);
    }
    const within = range && typeof constraint.value === 'number'
      && range[0] <= constraint.value && constraint.value <= range[1];
    if (constraint.op === 'neq' && within && range[0] !== range[1]) {
      return checkConstraint(teamEvidence(asset), constraint, null, false,
        `模拟接单区间 ${value} 套包含排除值，实际订量待确认`);
    }
    return checkConstraint(teamEvidence(asset), constraint, value, Boolean(within),
      range ? `模拟接单区间 ${value} 套` : '待核');
  });

  const careChecks = (constraint: Constraint) => {
    const rating = [checkConstraint(teamEvidence(fabricAsset), constraint, fabric?.profile.care ?? null)];
    for (const [index, { record }] of selectedCrafts.entries()) {
      rating.push(checkConstraint(teamEvidence(craftAssets[index]), constraint, record?.profile.care ?? null));
    }
    if (selectedCrafts.length === 0 && (constraint.value === 'machine_wash' || fabric?.profile.care === 'machine_wash')) {
      rating.push(checkConstraint(teamEvidence(patternAsset), constraint, null, false, '成衣缝制与辅料洗护待核'));
    }
    return rating;
  };

  function check(constraint: Constraint): AssetEvidence[] {
    if (constraint.blocking) {
      return [evidence(teamEvidence(patternAsset), constraint.field, null, 'unknown',
        `${fieldLabels[constraint.field]}需要人工裁决。${constraint.reason ?? ''}`, constraint.id)];
    }
    const patternValue = pattern?.profile;
    const fabricValue = fabric?.profile;
    switch (constraint.field) {
      case 'businessType':
        return [checkConstraint(patternAsset, constraint, pattern?.asset.businessType ?? null)];
      case 'quantity':
        return quantityChecks(constraint);
      case 'scene': {
        const fits = scene && sceneFits(scene.id, String(constraint.value));
        if (!scene || fits === undefined) return [checkConstraint(teamEvidence(patternAsset), constraint, null, false, '场景类别待核')];
        return [checkConstraint(teamEvidence(patternAsset), constraint, scene.id, fits, scene.shortName)];
      }
      case 'season':
        return [
          { source: patternAsset, seasons: pattern?.asset.seasonFit },
          { source: fabricAsset, seasons: fabric?.asset.seasons },
        ].map(({ source, seasons }) => checkConstraint(teamEvidence(source), constraint, seasons?.join(', ') ?? null,
          Boolean(seasons?.some((season) => season === constraint.value || season === 'all_season')),
          seasons?.map(describeValue).join('、') ?? '待核'));
      case 'collar': {
        const values = patternValue?.collars;
        const matches = values?.find((value) => value === constraint.value);
        return [checkConstraint(patternAsset, constraint, matches ?? values?.join(', ') ?? null,
          Boolean(matches), values?.map(describeValue).join('、') ?? '待核')];
      }
      case 'category':
      case 'patternStructure':
      case 'lengthRatio':
      case 'easeAllowance':
      case 'style':
        return [checkConstraint(patternAsset, constraint, patternValue?.[constraint.field] ?? null)];
      case 'fabric':
      case 'motif':
      case 'luster':
        return [checkConstraint(fabricAsset, constraint, fabricValue?.[constraint.field] ?? null)];
      case 'color': {
        const color = fabric?.asset.colorFamily;
        return [checkConstraint(fabricAsset, constraint, color && color !== 'neutral_silk' ? color : null)];
      }
      case 'closure': {
        const closureStyle = pattern?.asset.blueprintConfig.closureStyle;
        const hidden = closureStyle === 'open_no_buttons' || closureStyle === 'hidden_placket';
        return [checkConstraint(patternAsset, constraint,
          closureStyle ? (hidden ? 'no_visible_buttons' : 'visible_buttons') : null)];
      }
      case 'care':
        return careChecks(constraint);
      case 'wrinkleResistance':
        return [checkConstraint(teamEvidence(fabricAsset), constraint, fabricValue?.wrinkleResistance ?? null)];
      case 'craft': {
        const matchingCraft = craftAssets.find((craft) => craft.id === constraint.value || craft.code === constraint.value);
        return [checkConstraint(matchingCraft ?? teamEvidence(patternAsset), constraint,
          matchingCraft?.id ?? 'absent', Boolean(matchingCraft), matchingCraft?.code ?? '未选用该工艺')];
      }
    }
  }

  const checks = requirement.constraints.filter((constraint) => constraint.level !== 'pending' || constraint.blocking).map((constraint) => {
    const items = check(constraint);
    const outcome = items.some((item) => item.outcome === 'conflict') ? 'conflict'
      : items.some((item) => item.outcome === 'unknown') ? 'unknown' : 'satisfies';
    return { constraint, items, outcome };
  });
  const hard = checks.filter(({ constraint }) => constraint.level === 'hard' || constraint.blocking);
  const preferences = checks.filter(({ constraint }) => constraint.level === 'preference' && constraint.value !== null);
  const hardConflicts = hard.filter(({ outcome }) => outcome === 'conflict').length;
  const hardUnknowns = hard.filter(({ outcome }) => outcome === 'unknown').length;
  const structuralConflicts = structuralEvidence.filter(({ outcome }) => outcome === 'conflict').length;
  const status = hardConflicts || structuralConflicts ? 'rejected'
    : hardUnknowns || structuralEvidence.some(({ outcome }) => outcome === 'unknown') ? 'needs_review' : 'eligible';
  const preferenceHits = preferences.filter(({ outcome }) => outcome === 'satisfies').length;
  const totalPoints = 3 * hard.length + preferences.length;
  const ruleScore = status === 'eligible'
    ? (totalPoints ? Math.round(100 * (3 * hard.length + preferenceHits) / totalPoints) : 100) : 0;

  const relatedCases = matchReferences(config);
  const publicReferences = (fabric?.profile.publicReferences ?? []).map((source) => evidence(
    { ...fabricAsset, source }, 'textileReference', null, 'reference', '公开纺织知识参考。单个模拟资产的性能由团队目录设定。',
  ));
  const comparisonEvidence = [
    ...(pattern ? [evidence(patternAsset, 'fitGuidance', pattern.asset.easeAllowance, 'reference', pattern.asset.fitGuidance)] : []),
    ...(fabric ? [
      evidence(fabricAsset, 'drape', fabric.asset.drape, 'reference', `${fabric.asset.drape} · ${fabric.asset.gsm} g/m²（模拟）`),
      evidence(fabricAsset, 'luster', fabric.profile.luster, 'reference', `${fabric.asset.shortName}的模拟光泽为${describeValue(fabric.profile.luster)}。`),
    ] : []),
  ];
  const blockingDetails = [
    ...hard.flatMap(({ items }) => items.filter(({ outcome }) => outcome === 'conflict' || outcome === 'unknown')),
    ...structuralEvidence.filter(({ outcome }) => outcome === 'conflict' || outcome === 'unknown'),
  ];
  const decisionReasons = status === 'eligible'
    ? [`通过 ${hard.length} 条硬条件与组合兼容校验，满足 ${preferenceHits}/${preferences.length} 条偏好。`,
      ...preferences.flatMap(({ constraint, outcome, items }) => constraint.state !== 'suggested'
        ? [outcome === 'satisfies' ? items[0].detail : `偏好取舍 · ${items.find((item) => item.outcome === outcome)?.detail ?? items[0].detail}`]
        : [])]
    : blockingDetails.map(({ outcome, detail }) => `${outcome === 'unknown' ? '待核' : '不符'} · ${detail}`);

  const selectedCare = fabric?.profile.care;
  const careAligned = selectedCrafts.length === 0
    ? selectedCare !== 'machine_wash'
    : selectedCrafts.every(({ record }) => record?.profile.care === selectedCare);
  const candidate: CandidateCombination = {
    id: [config.patternId, config.fabricId, config.sceneId, ...config.craftIds.toSorted()].join('::'),
    config: { ...config, craftIds: [...config.craftIds] },
    status, ruleScore,
    evidence: [...checks.flatMap(({ items }) => items), ...structuralEvidence, ...comparisonEvidence, ...publicReferences, ...relatedCases.items],
    decisionReasons,
    comparison: {
      style: `${pattern?.asset.category ?? '版型待核'} · ${fabric ? describeValue(fabric.profile.luster) : '光泽待核'}`,
      comfort: configuredFabric ? `${configuredFabric.drape} · ${configuredFabric.gsm} g/m²（模拟）` : '体感待核。',
      fit: pattern?.asset.easeAllowance ?? '松量待核。',
      care: selectedCare && careAligned ? careGuidance[selectedCare] ?? '洗护待核。'
        : selectedCare ? `面料标注${describeValue(selectedCare)}，成衣工艺与辅料洗护待核。` : '面料洗护资料缺项，等待样衣与洗标核验。',
    },
    referenceCaseIds: relatedCases.items.map(({ assetId }) => assetId),
  };
  return { candidate, hardConflicts, hardUnknowns, structuralConflicts, preferenceHits, affinity: relatedCases.affinity };
}

export function evaluateDecisionConfiguration(requirement: DecisionRequirement, config: ConfigurationState): CandidateCombination {
  return evaluate(requirement, config).candidate;
}

function chooseScene(requirement: DecisionRequirement, pattern: PatternRecord, fabric: FabricRecord): string {
  const common = pattern.asset.suitableScenes.filter((id) =>
    scenes.get(id)?.suitableBusiness.includes(pattern.asset.businessType) && fabric.asset.suitableScenes.includes(id));
  if (!common.length) return pattern.asset.suitableScenes[0] ?? requirement.input.targetSceneId;
  const constraints = requirement.constraints.filter((constraint) => constraint.field === 'scene' && constraint.value !== null && constraint.level !== 'pending');
  const options = common.map((id) => {
    const outcomes = constraints.map((constraint) => {
      const fits = sceneFits(id, String(constraint.value));
      return fits === undefined ? 'unknown' : matchingValue(constraint, fits) ? 'satisfies' : 'conflict';
    });
    return {
      id,
      conflicts: constraints.filter((constraint, index) => constraint.level === 'hard' && outcomes[index] === 'conflict').length,
      unknowns: constraints.filter((constraint, index) => constraint.level === 'hard' && outcomes[index] === 'unknown').length,
      preferences: constraints.filter((constraint, index) => constraint.level === 'preference' && outcomes[index] === 'satisfies').length,
    };
  });
  return options.sort((first, second) => first.conflicts - second.conflicts || first.unknowns - second.unknowns
    || second.preferences - first.preferences
    || Number(second.id === requirement.input.targetSceneId) - Number(first.id === requirement.input.targetSceneId))[0].id;
}

function representativeCandidates<T extends { candidate: CandidateCombination }>(options: T[]): CandidateCombination[] {
  const seen = new Set<string>();
  const results: CandidateCombination[] = [];
  for (const { candidate } of options) {
    if (seen.has(candidate.config.fabricId)) continue;
    results.push(candidate);
    seen.add(candidate.config.fabricId);
  }
  return results.slice(0, 4);
}

function craftPackagesForRequest(pattern: PatternRecord, requestedCrafts: ReadonlySet<string>): readonly (readonly string[])[] {
  const packages = pattern.profile.craftPackages;
  if (!requestedCrafts.size) return packages;
  const ordered = new Map(packages.map((ids) => [ids.toSorted().join('|'), ids]));
  for (const ids of packages) {
    // Expose explicitly requested optional details from a documented package without mixing packages.
    const selected = ids.filter((id) => requestedCrafts.has(id) || requestedCrafts.has(crafts.get(id)?.asset.code ?? ''));
    if (selected.length > 0 && selected.length < ids.length) {
      const key = selected.toSorted().join('|');
      if (!ordered.has(key)) ordered.set(key, selected);
    }
  }
  return [...ordered.values()];
}

export function matchDecision(requirement: DecisionRequirement): MatchResult {
  const requestedCrafts = new Set(requirement.constraints.flatMap(({ field, op, level, state, value }) =>
    field === 'craft' && op === 'eq' && level !== 'pending' && (state === 'explicit' || state === 'confirmed') && typeof value === 'string'
      ? [value] : []));
  const options = DECISION_CATALOG.patterns.flatMap((pattern) => {
    const craftPackages = craftPackagesForRequest(pattern, requestedCrafts);
    return DECISION_CATALOG.fabrics.flatMap((fabric) => {
      const sceneId = chooseScene(requirement, pattern, fabric);
      return craftPackages.flatMap((craftIds) => {
        // Synthetic washable fabrics need an identified construction package.
        if (craftIds.length === 0 && fabric.profile.care === 'machine_wash') return [];
        return [evaluate(requirement, {
          patternId: pattern.asset.id, fabricId: fabric.asset.id, craftIds: [...craftIds], sceneId,
          activeView: 'scene_look', focusedHotspotId: null,
        })];
      });
    });
  });
  const suppliedReference = PRESET_DEMO_CASES.find((preset) => preset.id === requirement.input.presetDemoId
    && preset.input.rawNarrative === requirement.input.rawNarrative)?.recommendedConfig;
  const matchesSuppliedReference = ({ config }: CandidateCombination) => Boolean(suppliedReference
    && config.patternId === suppliedReference.patternId && config.fabricId === suppliedReference.fabricId
    && sameSet(config.craftIds, suppliedReference.craftIds));
  const eligible = options.filter(({ candidate }) => candidate.status === 'eligible')
    .sort((first, second) => second.preferenceHits - first.preferenceHits
      || Number(matchesSuppliedReference(second.candidate)) - Number(matchesSuppliedReference(first.candidate))
      || second.affinity - first.affinity);
  const recommended = eligible[0]?.candidate ?? null;
  const alternative = eligible.find(({ candidate }) => recommended && (
    candidate.config.fabricId !== recommended.config.fabricId || candidate.config.patternId !== recommended.config.patternId
  ))?.candidate ?? null;
  const eligibleFabrics = new Set(eligible.map(({ candidate }) => candidate.config.fabricId));
  const closestFirst = options.filter(({ candidate }) => candidate.status !== 'eligible')
    .sort((first, second) => first.structuralConflicts - second.structuralConflicts
      || first.hardConflicts - second.hardConflicts || first.hardUnknowns - second.hardUnknowns
      || Number(eligibleFabrics.has(first.candidate.config.fabricId)) - Number(eligibleFabrics.has(second.candidate.config.fabricId))
      || second.affinity - first.affinity);
  return {
    status: recommended ? 'matched' : 'no_match', recommended, alternative,
    review: representativeCandidates(closestFirst.filter(({ candidate }) => candidate.status === 'needs_review')),
    rejected: representativeCandidates(closestFirst.filter(({ candidate }) => candidate.status === 'rejected')),
  };
}
