import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SCENES } from '../data/scenes';
import { colorReviewText } from './colorPresentation';
import type {
  ConfigurationState,
  CraftAsset,
  DeconstructedRequirement,
  FabricAsset,
  FabricThreeDimRationale,
  FeasibilityNotice,
  MatchExplanation,
  PatternAsset,
  RequirementInput,
  SceneEnvironment,
} from '../types/sartoria';

export interface CuratedConfiguratorOptions {
  recommendedFabrics: FabricAsset[];
  otherFabrics: FabricAsset[];
  recommendedPatterns: PatternAsset[];
  otherPatterns: PatternAsset[];
  recommendedCrafts: CraftAsset[];
  otherCrafts: CraftAsset[];
  orderedScenes: SceneEnvironment[];
  matchedSceneIds: string[];
  primaryRecommendedConfig: ConfigurationState;
}

export function curateAssetsForRequirement(
  input: RequirementInput,
  deconstructed: DeconstructedRequirement,
  currentConfig: ConfigurationState
): CuratedConfiguratorOptions {
  const recommended = recommendInitialConfig(input, deconstructed);
  const text = `${input.projectName} ${input.rawNarrative}`.toLowerCase();
  const selectedFabric = FABRICS.find((f) => f.id === currentConfig.fabricId) ?? FABRICS[0];
  const selectedPattern = PATTERNS.find((p) => p.id === currentConfig.patternId) ?? PATTERNS[0];

  const isStage =
    recommended.patternId === 'pat-official-stage-twopiece' ||
    text.includes('演出') ||
    text.includes('舞台') ||
    text.includes('两件');
  const isGown =
    recommended.patternId === 'pat-haipai-gown-column' ||
    text.includes('晚礼服') ||
    text.includes('晚宴');
  const isUniform = input.businessType === 'corporate_uniform';

  // 1. Score & curate Patterns for this requirement
  const scoredPatterns = PATTERNS.map((pat) => {
    let score = 0;
    if (pat.id === recommended.patternId) score += 120;
    if (pat.id === currentConfig.patternId) score += 15;
    if (pat.businessType === input.businessType) score += 40;
    if (isStage && pat.blueprintConfig.silhouetteType === 'stage_two_piece') score += 45;
    if (isGown && pat.blueprintConfig.silhouetteType === 'gown_column') score += 45;
    if (!isStage && !isGown && !isUniform && pat.blueprintConfig.silhouetteType.startsWith('jacket_')) {
      score += 35;
    }
    if (pat.suitableScenes.includes(recommended.sceneId)) score += 15;
    if (pat.seasonFit.includes(input.season) || pat.seasonFit.includes('all_season')) score += 8;
    return { pat, score };
  }).sort((a, b) => b.score - a.score);

  const recPatternCount = isUniform ? 2 : 3;
  const recommendedPatterns = scoredPatterns.slice(0, recPatternCount).map((x) => x.pat);
  if (!recommendedPatterns.some((p) => p.id === currentConfig.patternId)) {
    recommendedPatterns.unshift(selectedPattern);
  }
  const recPatternIds = new Set(recommendedPatterns.map((p) => p.id));
  const otherPatterns = scoredPatterns
    .filter((x) => !recPatternIds.has(x.pat.id))
    .map((x) => x.pat);

  // 2. Score & curate Fabrics for this requirement
  const scoredFabrics = FABRICS.map((fab) => {
    let score = 0;
    if (fab.id === recommended.fabricId) score += 120;
    if (fab.id === currentConfig.fabricId) score += 12;
    if (fab.suitableBusiness.includes(input.businessType)) score += 40;
    if (isUniform && fab.isDelicateForUniform) score -= 50;
    if (fab.suitableScenes.includes(recommended.sceneId)) score += 20;
    if (fab.seasons.includes(input.season) || fab.seasons.includes('all_season')) score += 14;
    if (isStage && ['ivory_rose', 'ivory', 'stone_gray'].includes(fab.colorFamily)) score += 20;
    if (isGown && ['obsidian', 'ivory', 'crimson'].includes(fab.colorFamily)) score += 25;
    if (text.includes('香云纱') && fab.id.includes('xiangyun')) score += 35;
    if (text.includes('梅花') && fab.id.includes('plum')) score += 35;
    if (text.includes('宋锦') && fab.weave.includes('宋锦')) score += 20;
    return { fab, score };
  }).sort((a, b) => b.score - a.score);

  const recommendedFabrics = scoredFabrics.slice(0, 5).map((x) => x.fab);
  if (!recommendedFabrics.some((f) => f.id === currentConfig.fabricId)) {
    recommendedFabrics.unshift(selectedFabric);
  }
  const recFabricIds = new Set(recommendedFabrics.map((f) => f.id));
  const otherFabrics = scoredFabrics
    .filter((x) => !recFabricIds.has(x.fab.id))
    .map((x) => x.fab);

  // 3. Score & curate Crafts for this requirement & fabric
  const scoredCrafts = CRAFTS.map((craft) => {
    let score = 0;
    if (recommended.craftIds.includes(craft.id)) score += 100;
    if (currentConfig.craftIds.includes(craft.id)) score += 20;
    if (craft.suitableBusiness.includes(input.businessType)) score += 35;
    if (craft.compatibleFabrics.includes(selectedFabric.weave)) score += 30;
    else score -= 25;
    return { craft, score };
  }).sort((a, b) => b.score - a.score);

  const recommendedCrafts = scoredCrafts
    .filter((x) => x.score >= 40)
    .slice(0, 5)
    .map((x) => x.craft);
  for (const activeId of currentConfig.craftIds) {
    if (!recommendedCrafts.some((c) => c.id === activeId)) {
      const found = CRAFTS.find((c) => c.id === activeId);
      if (found) recommendedCrafts.push(found);
    }
  }
  const recCraftIds = new Set(recommendedCrafts.map((c) => c.id));
  const otherCrafts = scoredCrafts
    .filter((x) => !recCraftIds.has(x.craft.id))
    .map((x) => x.craft);

  // 4. Order Scenes by relevance to the requirement & current pattern
  const scoredScenes = SCENES.map((scene) => {
    let score = 0;
    if (scene.id === recommended.sceneId) score += 100;
    if (scene.id === input.targetSceneId) score += 40;
    if (selectedPattern.suitableScenes.includes(scene.id)) score += 35;
    if (scene.suitableBusiness.includes(input.businessType)) score += 20;
    return { scene, score };
  }).sort((a, b) => b.score - a.score);

  const orderedScenes = scoredScenes.map((x) => x.scene);
  const matchedSceneIds = scoredScenes.filter((x) => x.score >= 55).map((x) => x.scene.id);

  return {
    recommendedFabrics,
    otherFabrics,
    recommendedPatterns,
    otherPatterns,
    recommendedCrafts,
    otherCrafts,
    orderedScenes,
    matchedSceneIds,
    primaryRecommendedConfig: recommended,
  };
}

export function recommendInitialConfig(
  input: RequirementInput,
  _deconstructed: DeconstructedRequirement
): ConfigurationState {
  if (input.presetDemoId) {
    const preset = PRESET_DEMO_CASES.find((p) => p.id === input.presetDemoId);
    if (preset && preset.input.rawNarrative === input.rawNarrative) {
      return {
        ...preset.recommendedConfig,
        sceneId: input.targetSceneId || preset.recommendedConfig.sceneId,
      };
    }
  }

  const text = `${input.projectName} ${input.rawNarrative}`.toLowerCase();
  const isUniform = input.businessType === 'corporate_uniform';

  // Smart semantic selection covering Case 6 (Primary Demo), Case 3 (Stage Two-Piece), Cases 1/2/4, Uniform & Evening Gown
  let patternId = isUniform ? 'pat-haipai-suit-ensemble' : 'pat-official-cross-collar-silk';
  let fabricId = isUniform ? 'fab-bund-navy-wool130' : 'fab-official-silk-jacquard-subtle';
  let craftIds: string[] = isUniform
    ? ['crf-full-canvas-guiba', 'crf-hidden-mandarin-placket', 'crf-milanese-cuff-label']
    : ['crf-cross-collar-no-button'];
  let sceneId = input.targetSceneId || (isUniform ? 'scene-lujiazui-summit' : 'scene-studio-minimal');

  if (!isUniform) {
    if (text.includes('演出') || text.includes('演奏') || text.includes('舞台') || text.includes('两件')) {
      patternId = 'pat-official-stage-twopiece';
      fabricId = 'fab-official-ivory-rose-stage';
      craftIds = ['crf-contrast-piping-cuff', 'crf-haipai-pipa-button'];
      sceneId = 'scene-outdoor-stage';
    } else if (
      text.includes('肩背') ||
      text.includes('宽厚') ||
      text.includes('不压肩') ||
      text.includes('不卡手臂') ||
      text.includes('交领') ||
      text.includes('开襟') ||
      text.includes('身形偏高')
    ) {
      patternId = 'pat-official-cross-collar-silk';
      fabricId = 'fab-official-silk-jacquard-subtle';
      craftIds = ['crf-cross-collar-no-button'];
      sceneId = input.targetSceneId || 'scene-studio-minimal';
    } else if (text.includes('香云纱') || text.includes('溜肩')) {
      patternId = 'pat-official-xiangyun-dropped';
      fabricId = 'fab-official-xiangyun-matte';
      craftIds = ['crf-low-collar-ergo', 'crf-hidden-mandarin-placket'];
      sceneId = input.targetSceneId || 'scene-studio-minimal';
    } else if (text.includes('梅花') || text.includes('青果') || text.includes('脖子细') || text.includes('内搭')) {
      patternId = 'pat-official-shawl-plum';
      fabricId = 'fab-official-plum-song';
      craftIds = ['crf-plum-starlight-motif'];
      sceneId = input.targetSceneId || 'scene-jingan-salon';
    } else if (text.includes('晚礼服') || text.includes('礼服') || text.includes('晚宴')) {
      patternId = 'pat-haipai-gown-column';
      fabricId = text.includes('月白')
        ? 'fab-suzhou-moonlight-white'
        : text.includes('丝绒') || text.includes('绯红')
          ? 'fab-xiangyun-crimson-velvet'
          : 'fab-song-obsidian-gold';
      craftIds = ['crf-haipai-pipa-button', 'crf-suzhou-magnolia-embroidery'];
      sceneId = input.targetSceneId || 'scene-bund-banquet';
    } else if (text.includes('脖子短') || text.includes('肚腩') || text.includes('醋酸')) {
      patternId = 'pat-official-h-low-collar';
      fabricId = 'fab-official-acetate-jacquard';
      craftIds = ['crf-low-collar-ergo', 'crf-hidden-mandarin-placket'];
      sceneId = input.targetSceneId || 'scene-studio-minimal';
    }
  } else {
    if (text.includes('暖灰')) fabricId = 'fab-shikumen-stone-gray';
    else if (text.includes('松墨绿') || text.includes('墨绿')) fabricId = 'fab-shanghai-pine-green';
  }

  return {
    patternId,
    fabricId,
    craftIds,
    sceneId,
    activeView: 'scene_look',
    focusedHotspotId: null,
  };
}

function buildFabricRationale(
  input: RequirementInput,
  deconstructed: DeconstructedRequirement,
  pattern: (typeof PATTERNS)[number],
  fabric: (typeof FABRICS)[number]
): FabricThreeDimRationale {
  const text = `${input.rawNarrative}`;
  const isCase6 = fabric.id === 'fab-official-silk-jacquard-subtle';
  const isStage = pattern.blueprintConfig.silhouetteType === 'stage_two_piece';

  const styleFit = isCase6
    ? `暗纹含蓄低调，契合简约大气的新中式正式气质，纹样小巧不张扬；色彩待客户线下核定。`
    : isStage
      ? `米白暗纹宋锦与亮粉高垂感缎面呼应户外舞台氛围，兼顾正式仪式感与上镜活力。`
      : `${fabric.weave}具备「${fabric.luster}」视觉语言，贴合「${deconstructed.emotionTags.slice(0, 2).join('、')}」审美定位。`;

  const comfortFit = isCase6
    ? `面料垂感适中、手感柔和、挺而不硬（参考克重 ${fabric.gsm}g/m²），不易紧贴身体，满足宽松无束缚要求。`
    : `${fabric.composition}呈现「${fabric.drape}」体感，${fabric.careAndMoqNote}`;

  const bodyFit =
    text.includes('肩背') || text.includes('宽厚') || isCase6
      ? `针对肩背宽厚体型，面料自带适度骨感，不会软塌塌压肩，兼顾挺括轮廓与抬臂活动舒适度（具体克重与手感须实物米样核实）。`
      : text.includes('肚腩')
        ? `悬垂而不紧贴，配合 H 型直身无收腰结构，有助于自然弱化腹部贴合感。`
        : text.includes('抬手') || text.includes('坐奏') || isStage
          ? `轻盈顺滑且垂坠自然，配合宽袖管与大 A 摆结构，保障演奏抬臂与坐姿舒展。`
          : `契合「${pattern.fitGuidance}」，最终垂感与舒适度以实物米样触感为准。`;

  return { styleFit, comfortFit, bodyFit };
}

export function evaluateMatch(
  input: RequirementInput,
  deconstructed: DeconstructedRequirement,
  config: ConfigurationState
): MatchExplanation {
  const pattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const fabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const scene = SCENES.find((s) => s.id === config.sceneId) ?? SCENES[0];
  const crafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));

  let patternScore = 80;
  if (pattern.businessType === input.businessType) patternScore += 12;
  if (pattern.suitableScenes.includes(scene.id)) patternScore += 5;
  if (pattern.seasonFit.includes(input.season) || pattern.seasonFit.includes('all_season')) {
    patternScore += 1;
  }
  patternScore = Math.min(98, patternScore);

  let fabricScore = 78;
  if (fabric.suitableBusiness.includes(input.businessType)) fabricScore += 11;
  if (fabric.suitableScenes.includes(scene.id)) fabricScore += 5;
  if (fabric.seasons.includes(input.season) || fabric.seasons.includes('all_season')) {
    fabricScore += 4;
  } else {
    fabricScore -= 8;
  }
  if (input.businessType === 'corporate_uniform' && fabric.isDelicateForUniform) {
    fabricScore -= 16;
  }
  fabricScore = Math.max(58, Math.min(98, fabricScore));

  let craftScore = crafts.length === 0 ? 78 : 86;
  let incompatibleCount = 0;
  for (const craft of crafts) {
    if (craft.compatibleFabrics.includes(fabric.weave)) {
      craftScore += 4;
    } else {
      incompatibleCount += 1;
      craftScore -= 10;
    }
  }
  craftScore = Math.max(56, Math.min(98, craftScore));

  let sceneScore = 82;
  if (scene.suitableBusiness.includes(input.businessType)) sceneScore += 8;
  if (scene.recommendedColorFamilies.includes(fabric.colorFamily)) sceneScore += 7;
  sceneScore = Math.min(98, sceneScore);

  const overallScore = Math.round(
    patternScore * 0.28 + fabricScore * 0.28 + craftScore * 0.22 + sceneScore * 0.22
  );

  const reasons: MatchExplanation['reasons'] = [
    {
      category: '版型适配',
      title: `${pattern.name}（${pattern.code}）`,
      detail: `${pattern.silhouette}；${pattern.easeAllowance}`,
      score: patternScore,
    },
    {
      category: '面料适配',
      title: `${fabric.name}（${fabric.code} · ${fabric.gsm}g/m²）`,
      detail: `${fabric.composition} · ${fabric.drape} · ${fabric.luster}`,
      score: fabricScore,
    },
    {
      category: '工艺组合',
      title: crafts.length > 0 ? crafts.map((c) => `${c.shortName}(${c.code})`).join(' + ') : '净面极简精工',
      detail:
        incompatibleCount > 0
          ? `存在 ${incompatibleCount} 项工艺与「${fabric.weave}」需版师复核兼容性。`
          : '所选工艺与面料织法及体态诉求规范兼容。',
      score: craftScore,
    },
    {
      category: '场景契合',
      title: `${scene.name} · ${scene.lighting.colorTempLabel}`,
      detail: scene.backdropHint,
      score: sceneScore,
    },
  ];

  const similarCaseIds = HISTORICAL_CASES.map((hc) => {
    let sim = 0;
    if (hc.businessType === input.businessType) sim += 35;
    if (hc.patternId === pattern.id) sim += 30;
    if (hc.fabricId === fabric.id) sim += 25;
    if (hc.sceneId === scene.id) sim += 15;
    return { id: hc.id, sim };
  })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 2)
    .map((x) => x.id);

  const fabricRationale = buildFabricRationale(input, deconstructed, pattern, fabric);

  return {
    overallScore,
    patternScore,
    fabricScore,
    craftScore,
    sceneScore,
    reasons,
    fabricRationale,
    similarCaseIds,
  };
}

export function evaluateFeasibility(
  input: RequirementInput,
  config: ConfigurationState,
  deconstructed?: DeconstructedRequirement
): FeasibilityNotice[] {
  const notices: FeasibilityNotice[] = [];
  const pattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const fabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const crafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));

  if (input.season === 'summer' && fabric.gsm >= 280) {
    notices.push({
      id: 'feas-summer-heavy-gsm',
      level: 'risk',
      dimension: '季节克重',
      title: `夏季选配重磅面料预警（${fabric.gsm}g/m²）`,
      detail: `「${fabric.shortName}」克重偏高，夏季或室外易闷热，建议换选 195–235g/m² 透气面料。`,
    });
  } else if (input.season === 'winter' && fabric.gsm <= 190) {
    notices.push({
      id: 'feas-winter-light-gsm',
      level: 'caution',
      dimension: '季节克重',
      title: `冬季偏轻克重提示（${fabric.gsm}g/m²）`,
      detail: `「${fabric.shortName}」偏轻薄，若含户外环节建议增加内搭保暖或换选高克重面料。`,
    });
  } else {
    notices.push({
      id: 'feas-season-ok',
      level: 'pass',
      dimension: '季节克重',
      title: `克重与体感适配良好（${fabric.gsm}g/m² · ${fabric.drape}）`,
      detail: '满足当前季候与场景穿着舒适度参考要求，实物手感须通过工坊米样复核。',
    });
  }

  if (input.businessType === 'corporate_uniform' && fabric.isDelicateForUniform) {
    notices.push({
      id: 'feas-uniform-delicate',
      level: 'risk',
      dimension: '团单规范',
      title: '团体职业服选配娇贵纯丝/丝绒风险',
      detail: `「${fabric.shortName}」高频团装易勾丝且维护成本高，建议优先选用 Super 130s 羊毛、羊毛真丝混纺或抗皱斜纹呢。`,
    });
  }

  const incompatibleCrafts = crafts.filter((c) => !c.compatibleFabrics.includes(fabric.weave));
  if (incompatibleCrafts.length > 0) {
    notices.push({
      id: 'feas-craft-incompat',
      level: 'risk',
      dimension: '工艺兼容',
      title: `工艺与织法需复核：${incompatibleCrafts.map((c) => c.shortName).join('、')}`,
      detail:
        incompatibleCrafts[0].incompatibleNotes ||
        `当前工艺与「${fabric.weave}」织法需由资深版师评估衬布加固方案。`,
    });
  } else if (crafts.length > 0) {
    notices.push({
      id: 'feas-craft-ok',
      level: 'pass',
      dimension: '工艺兼容',
      title: `已选 ${crafts.length} 项工艺与「${fabric.weave}」规范兼容`,
      detail: '符合静态工艺规范库约束，实际落位与对花方案须交由版师终审。',
    });
  }

  if (deconstructed && !deconstructed.colorSpecifiedByUser) {
    const colorReview = colorReviewText(deconstructed);
    notices.push({
      id: 'feas-color-unassigned',
      level: 'caution',
      dimension: '人工边界',
      title: colorReview ? '用色待人工核对' : '客户未指定颜色 · 禁止 AI 代客定色',
      detail: `${colorReview ? `${colorReview}。` : ''}当前视觉与选配预览仅作廓形与肌理示意，最终成衣色彩须由顾问携实物面料色卡线下与客户确认。`,
    });
  }

  const extraDays = crafts.reduce((sum, c) => sum + c.extraLeadDays, 0);
  const totalRefDays = pattern.baseLeadDays + extraDays;
  if (extraDays >= 10) {
    notices.push({
      id: 'feas-lead-time',
      level: 'caution',
      dimension: '工期排期',
      title: `含高工时手工工艺（参考周期约 ${totalRefDays} 工作日）`,
      detail: `非遗手工预计额外增加 ${extraDays} 个工作日，仅供内部企划估算，实际排期须由工坊人工核定。`,
    });
  } else {
    notices.push({
      id: 'feas-lead-standard',
      level: 'pass',
      dimension: '工期排期',
      title: `参考企划周期约 ${totalRefDays} 个工作日（非正式交期承诺）`,
      detail: '处于集团标准参考周期内，最终交期与排产由人工团队核定。',
    });
  }

  notices.push({
    id: 'feas-human-boundary',
    level: 'caution',
    dimension: '人工边界',
    title: 'AI 企划参考初稿 · 不做报价/CAD定版/签约/打样/下单',
    detail:
      '全部资产为静态模拟数据，不接入生产系统或真实业务 API；具体松量厘米数、CAD 定版、打样试身、报价签约均由人工完成。',
  });

  return notices;
}
