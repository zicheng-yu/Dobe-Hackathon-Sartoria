import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SCENES } from '../data/scenes';
import type { Constraint } from '../types/decisions';
import { buildColorSpec } from './colorPresentation';
import { extractRevisionConstraints } from './requirementInterview';
import type {
  DeconstructErrorInfo,
  DeconstructedRequirement,
  DeconstructUsageMeta,
  DimensionItem,
  EngineMode,
  OfficialSpecItem,
  RequirementInput,
  SpecProvenance,
  ThreeBucketBreakdown,
  WorkerLlmStatus,
  WorkerQuotaSnapshot,
} from '../types/sartoria';

const SEASON_LABELS: Record<RequirementInput['season'], string> = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
  all_season: '四季通用',
};

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function buildFallbackThreeBuckets(
  input: RequirementInput,
  officialSpecs: OfficialSpecItem[],
  bodyErgonomics: string[]
): ThreeBucketBreakdown {
  const userExplicit: string[] = [];
  const systemSuggested: string[] = [];
  const needsHumanVerification: string[] = [];

  for (const spec of officialSpecs) {
    const line = `【${spec.label}】${spec.value}`;
    if (spec.provenance === 'user_explicit') {
      userExplicit.push(line);
    } else if (spec.provenance === 'needs_human_verification') {
      needsHumanVerification.push(line);
    } else {
      systemSuggested.push(line);
    }
  }

  if (bodyErgonomics.length > 0) {
    userExplicit.push(`体态与穿着痛点线索：${bodyErgonomics.join('；')}`);
  }
  if (input.rawNarrative.trim()) {
    userExplicit.unshift(`原始需求摘录：「${input.rawNarrative.trim().slice(0, 68)}${input.rawNarrative.trim().length > 68 ? '…' : ''}」`);
  }

  if (!needsHumanVerification.some((x) => x.includes('量体') || x.includes('放量'))) {
    needsHumanVerification.push('精确净体尺寸与具体松量厘米数：须由版师实测与试穿核定，AI 不凭空报数');
  }
  needsHumanVerification.push('最终 CAD 定版、实物米样核色、打样试身、正式报价与签约下单均由人工团队执行');

  return {
    userExplicit,
    systemSuggested,
    needsHumanVerification,
  };
}

export function buildOfficialEightSpecs(input: RequirementInput, constraints?: readonly Constraint[]): {
  officialSpecs: OfficialSpecItem[];
  bodyErgonomics: string[];
  threeBuckets: ThreeBucketBreakdown;
  colorSpecifiedByUser: boolean;
} {
  // Exact official translation when matching an unmodified preset
  if (input.presetDemoId) {
    const preset = PRESET_DEMO_CASES.find((p) => p.id === input.presetDemoId);
    if (preset?.officialSpecOverride && preset.input.rawNarrative === input.rawNarrative) {
      const cues = preset.officialSpecOverride
        .map((s) => s.ergonomicCue)
        .filter((v): v is string => Boolean(v));
      const colorSpecifiedByUser = preset.colorSpecifiedByUser ?? false;
      const threeBuckets =
        preset.threeBucketsOverride ??
        buildFallbackThreeBuckets(input, preset.officialSpecOverride, cues);
      return {
        officialSpecs: preset.officialSpecOverride,
        bodyErgonomics: cues,
        threeBuckets,
        colorSpecifiedByUser,
      };
    }
  }

  const text = `${input.projectName} ${input.rawNarrative}`.toLowerCase();
  const isUniform = input.businessType === 'corporate_uniform';
  const isTwoPieceStage = hasAny(text, ['演出', '演奏', '两件', '舞台', '连衣裙和一件外套', '坐奏']);
  const isGown = !isTwoPieceStage && hasAny(text, ['晚礼服', '礼服', '旗袍', '晚宴']);

  const broadBackOrTall = hasAny(text, [
    '身形偏高',
    '肩背',
    '宽厚',
    '不压肩',
    '不要压肩',
    '不卡手臂',
    '交领',
    '开襟',
    '无立领',
  ]);
  const shortNeck = hasAny(text, ['脖子短', '领子不能太高', '领子不要太高', '显脖子长', '显得脖子长']);
  const slimNeck = hasAny(text, ['脖子细', '领子窄', '窄一点', '青果']);
  const hasBelly = hasAny(text, ['肚腩', '小肚子', '腹部', '藏肉', '微胖']);
  const slopedShoulder = hasAny(text, ['溜肩', '窄肩']);
  const needLayering = hasAny(text, ['内搭', '叠穿', '里面穿']);
  const needArmLift = hasAny(text, ['抬手', '演奏', '坐奏', '活动方便', '舒展', '不卡手臂', '不要束缚']);

  const bodyErgonomics: string[] = [];
  if (broadBackOrTall) bodyErgonomics.push('高个宽厚肩背 → 微落平肩 + 肩背/袖笼方向放量，不压肩不卡臂');
  if (shortNeck) bodyErgonomics.push('短颈修饰 → 建议低立领（具体领高由版师量体核实）');
  if (slimNeck) bodyErgonomics.push('显颈部纤细 → 窄青果西装领拉长 V 区');
  if (hasBelly) bodyErgonomics.push('腹部藏肉 → H 型无收腰 + 前片腹部宽松方向');
  if (slopedShoulder) bodyErgonomics.push('溜肩友好 → 自然落肩柔和肩斜线');
  if (needLayering) bodyErgonomics.push('预留内搭层叠空间 → 围度宽松舒展');
  if (needArmLift && !broadBackOrTall) {
    bodyErgonomics.push('动作工学 → 宽袖笼抬臂放量方向 + 坐姿舒展');
  }

  // 1. 品类
  const category = isTwoPieceStage
    ? '两件式套装（短外套 + 无袖连衣裙）'
    : isUniform
      ? '团体职业套装（男女同源正装上衣 + 西裤/套裙）'
      : isGown
        ? '高端海派定制长礼服'
        : '外套';

  // 2. 版型结构
  let patternStructure = 'H 型直身结构，无收腰；肩型采用微落平肩，线条简约利落';
  if (isTwoPieceStage) {
    patternStructure =
      '外套：短款微 H 型，肩型自然平肩不压肩；连衣裙：收腰大 A 摆结构，腰腹保留松量，裙摆舒展';
  } else if (isUniform) {
    patternStructure = '建筑感微收腰正装廓形（男女套系），轻薄马尾衬立体肩型，久穿不塌';
  } else if (isGown) {
    patternStructure = '修身直筒微鱼尾廓形（H-X 比例拉长），立体胸腰省道收拢';
  } else if (slopedShoulder) {
    patternStructure = 'H 型直身结构，无收腰；肩型采用自然落肩，线条柔和松弛';
  } else if (slimNeck || needLayering) {
    patternStructure = 'H 型直身结构，微微收腰；肩型采用微落平肩，线条简约利落';
  }

  // 3. 领型
  let collar = '低立领（官方参考领高 3cm 以内，最终高度由版师量体核定），领线条圆润';
  if (isTwoPieceStage) {
    collar = '外套：中式斜襟领，线条柔和；连衣裙：简约小圆领，贴合颈部不卡肩';
  } else if (broadBackOrTall && !shortNeck && !slimNeck) {
    collar = '交领开襟款式，无立领，领型线条柔和舒展';
  } else if (slimNeck) {
    collar = '青果西装领，领型线条柔和舒展，视觉拉长并显颈部纤细';
  } else if (isUniform) {
    collar = '男款暗门襟海派小立领 / 驳领；女款改良一字弧立领';
  } else if (isGown && !shortNeck) {
    collar = '改良海派立体低立领，贴合颈线（具体领高由版师量体核实）';
  }

  // 4. 面料
  let fabric = '优选垂感适中、手感柔和的醋酸或薄款提花锦，挺而不硬，穿着舒适不易贴身';
  if (isTwoPieceStage) {
    fabric = '外套：暗纹宋锦 + 真丝里布，穿着舒适；连衣裙：高垂感亮面缎面，顺滑有光泽';
  } else if (isUniform) {
    fabric = '澳洲 Super 130s 精纺羊毛 / 羊毛桑蚕丝混纺（静态模拟资产），抗皱回弹挺括';
  } else if (broadBackOrTall || hasAny(text, ['真丝暗纹', '织花'])) {
    fabric = '优选真丝暗纹织花面料，垂感适中，手感柔和，挺而不硬，自带适度骨感不软塌压肩';
  } else if (hasAny(text, ['香云纱']) || (hasAny(text, ['低调', '内敛']) && hasAny(text, ['溜肩', '简约']))) {
    fabric = '香云纱面料，自带自然肌理，哑光温润，挺而不硬，垂感柔和';
  } else if (hasAny(text, ['梅花', '宋锦', '暗纹'])) {
    fabric = '优选垂感适中、手感柔和的提花宋锦面料，垂感顺滑，自带柔和光泽，挺而不硬';
  } else if (text.includes('丝绒')) {
    fabric = '非遗香云纱真丝丝绒，深邃微光垂坠显贵';
  }

  // Use the same sourced color decisions for the offline summary and catalog filtering.
  const observations = constraints ?? extractRevisionConstraints({ id: 'brief-1', text: input.rawNarrative }, 'initial');
  const colorSpec = buildColorSpec(observations);
  const colorSpecifiedByUser = colorSpec.provenance === 'user_explicit';

  // 6. 装饰纹样
  let motif = '无特殊需求（待顾问核实是否保留素面或小巧暗花）';
  let motifProvenance: OfficialSpecItem['provenance'] = 'needs_human_verification';
  if (broadBackOrTall && !hasAny(text, ['梅花', '玉兰', '盘扣'])) {
    motif = '暗花小巧，低调含蓄，无外露纽扣装饰';
    motifProvenance = 'system_suggested';
  } else if (hasAny(text, ['梅花', '星光'])) {
    motif = '衣身植物梅花暗花纹样，点缀细碎点状星光装饰，含蓄富有层次';
    motifProvenance = 'user_explicit';
  } else if (hasAny(text, ['玉兰', '刺绣', '盘扣'])) {
    motif = '领口斜襟手工琵琶盘扣 + 局部劈丝白玉兰暗纹苏绣';
    motifProvenance = 'user_explicit';
  } else if (isUniform) {
    motif = '袖口末粒企业定制色真丝锁眼 + 内里专属暗纹织标';
    motifProvenance = 'user_explicit';
  }

  // 7. 长度比例
  const lengthRatio = isTwoPieceStage
    ? '外套衣长至臀中位置；连衣裙裙长至脚踝（须结合鞋跟与坐姿实测）'
    : isGown
      ? '曳地晚宴长款比例，预留优雅侧开衩（具体高度待量体核实）'
      : '衣长至臀中位置（具体衣长须按客户身高实测核定）';

  // 8. 松弛余量（关键原则：给放量方向建议，绝不凭空报具体厘米数！）
  let easeAllowance =
    '整体围度宽松，前片及活动区域预留充足松量，穿着舒展无束缚（具体放量数值待版师量体与试身核定，AI 不凭空报数）';
  if (isTwoPieceStage) {
    easeAllowance =
      '外套袖管放量充足，抬臂演奏无束缚；连衣裙腰部适度收束，裙摆放量大，坐奏舒展不紧绷（具体松量待演奏试身核实）';
  } else if (broadBackOrTall) {
    easeAllowance =
      '整体围度宽松，肩背、袖管放量充足，抬手、站立活动自在无紧绷（具体放量数值待版师量体与试身核定，AI 不凭空报数）';
  } else if (hasBelly) {
    easeAllowance =
      '前片腹部区域预留充足松量，整体围度宽松，穿着无束缚（具体放量数值待版师量体核实）';
  } else if (needLayering) {
    easeAllowance =
      '整体围度宽松，预留内搭层叠空间，活动自在无紧绷感（具体松量须带实穿内搭试身核实）';
  } else if (isUniform) {
    easeAllowance =
      '按团单归码体系，针对久坐与高频礼宾接待预留后背及袖笼活动余量（具体套码尺寸由团装版师量体核定）';
  } else if (isGown) {
    easeAllowance = '腰省立体贴合，侧开衩与下摆预留从容步幅余量（具体尺寸待量体核实）';
  }

  const officialSpecs: OfficialSpecItem[] = [
    {
      key: 'category',
      label: '品类',
      value: category,
      provenance: 'user_explicit',
      sourceNote: '提取自客户明确品类诉求',
    },
    {
      key: 'patternStructure',
      label: '版型结构',
      value: patternStructure,
      provenance: 'system_suggested',
      sourceNote: '系统结合体态与风格给出的版型方向建议',
      ergonomicCue: broadBackOrTall
        ? '不压肩 · 宽厚肩背'
        : slopedShoulder
          ? '修饰溜肩'
          : hasBelly
            ? '修饰肚腩'
            : isTwoPieceStage
              ? '兼顾坐奏'
              : undefined,
    },
    {
      key: 'collar',
      label: '领型',
      value: collar,
      provenance: 'system_suggested',
      sourceNote: '系统结合颈部与正式感诉求给出的领型建议',
      ergonomicCue:
        broadBackOrTall && !shortNeck && !slimNeck
          ? '无立领束缚'
          : shortNeck
            ? '对应「脖子短」'
            : slimNeck
              ? '窄领显脖细'
              : undefined,
    },
    {
      key: 'fabric',
      label: '面料',
      value: fabric,
      provenance: 'system_suggested',
      sourceNote: '匹配静态模拟面料库（须线下核验米样手感）',
    },
    {
      ...colorSpec,
      ergonomicCue: !colorSpecifiedByUser ? '待线下核色' : isTwoPieceStage ? '明快上镜' : undefined,
    },
    {
      key: 'motif',
      label: '装饰纹样',
      value: motif,
      provenance: motifProvenance,
      ergonomicCue: hasAny(text, ['梅花']) ? '对应「梅花暗纹」' : undefined,
    },
    {
      key: 'lengthRatio',
      label: '长度比例',
      value: lengthRatio,
      provenance: 'system_suggested',
    },
    {
      key: 'easeAllowance',
      label: '松弛余量',
      value: easeAllowance,
      provenance: 'needs_human_verification',
      sourceNote: '仅输出放量方向，具体厘米数须由版师量体与试穿核定',
      ergonomicCue: broadBackOrTall
        ? '肩背/袖管放量方向'
        : needArmLift
          ? '抬手/坐奏放量'
          : hasBelly
            ? '腹部舒适放量'
            : needLayering
              ? '预留内搭松量'
              : undefined,
    },
  ];

  const threeBuckets = buildFallbackThreeBuckets(
    input,
    officialSpecs,
    bodyErgonomics
  );

  return { officialSpecs, bodyErgonomics, threeBuckets, colorSpecifiedByUser };
}

export function deconstructLocally(input: RequirementInput, constraints?: readonly Constraint[]): DeconstructedRequirement {
  const text = `${input.projectName} ${input.clientName} ${input.rawNarrative}`.toLowerCase();
  const scene = SCENES.find((s) => s.id === input.targetSceneId) ?? SCENES[0];
  const isUniform = input.businessType === 'corporate_uniform';
  const { officialSpecs, bodyErgonomics, threeBuckets, colorSpecifiedByUser } =
    buildOfficialEightSpecs(input, constraints);

  const emotionTags = new Set<string>();
  const extractedKeywords = new Set<string>();

  if (hasAny(text, ['端庄', '正式', '气质', '大气'])) emotionTags.add('简约大气正式');
  if (hasAny(text, ['舒适', '宽松', '不紧绷', '自在', '松弛', '不压肩', '不卡手臂', '不要束缚'])) {
    emotionTags.add('松弛无束缚');
  }
  if (hasAny(text, ['中式', '海派', '香云纱', '宋锦', '梅花', '盘扣', '交领', '新中式'])) {
    emotionTags.add('当代东方韵味');
  }
  if (hasAny(text, ['优雅', '含蓄', '低调', '内敛', '简约', '质感'])) emotionTags.add('克制静奢质感');
  if (hasAny(text, ['舞台', '演出', '明快', '活力', '上镜'])) emotionTags.add('明快舞台张力');
  if (hasAny(text, ['金融', '投行', '权威', '礼宾', '团队', '峰会'])) emotionTags.add('专业权威辨识');
  if (hasAny(text, ['电影', '晚宴', '鎏金'])) emotionTags.add('鎏金晚宴氛围');

  if (emotionTags.size < 3) {
    emotionTags.add(isUniform ? '现代职业识别' : '东方风骨当代演绎');
    emotionTags.add('体态友好剪裁');
    emotionTags.add('场景高适配');
  }

  for (const cue of bodyErgonomics) {
    extractedKeywords.add(cue);
  }

  const specByKey = (k: OfficialSpecItem['key']) =>
    officialSpecs.find((s) => s.key === k)?.value ?? '';

  const sceneFitScore = scene.suitableBusiness.includes(input.businessType) ? 96 : 86;

  const dimensions: DimensionItem[] = [
    {
      key: 'styleTone',
      label: '风格调性',
      value: Array.from(emotionTags).slice(0, 3).join(' · '),
      detail: `结合「${specByKey('category')}」定位，兼顾文化辨识度与当代简约正式审美。`,
      score: 95,
    },
    {
      key: 'silhouetteReq',
      label: '廓形要求',
      value: specByKey('patternStructure'),
      detail: `${specByKey('lengthRatio')}；${specByKey('easeAllowance')}`,
      score: 96,
    },
    {
      key: 'fabricTexture',
      label: '面料质感',
      value: specByKey('fabric'),
      detail: `匹配「${SEASON_LABELS[input.season]}」穿着体感，兼顾垂坠骨感与贴肤舒适度。`,
      score: input.season === 'summer' ? 90 : 95,
    },
    {
      key: 'craftDetail',
      label: '工艺细节',
      value: `${specByKey('collar')}｜${specByKey('motif')}`,
      detail:
        bodyErgonomics.length > 0
          ? `重点落实人体工学方向：${bodyErgonomics.slice(0, 2).join('；')}。`
          : '以克制精工细节强化成衣品质与近赏记忆点。',
      score: 94,
    },
    {
      key: 'colorSystem',
      label: '色彩体系',
      value: specByKey('color'),
      detail: colorSpecifiedByUser
        ? `适配 ${scene.lighting.colorTempLabel}，实物色泽以工坊米样核色为准。`
        : '成衣用色待顾问与客户核对实物色卡。',
      score: colorSpecifiedByUser ? 92 : 85,
    },
    {
      key: 'sceneFit',
      label: '场景适配度',
      value: `${scene.name}（${scene.formality}）`,
      detail: scene.backdropHint,
      score: sceneFitScore,
    },
  ];

  const aestheticArchetype = hasAny(text, ['舞台', '演出'])
    ? '「明快华彩 · 舞台演奏两件式东方美学」'
    : hasAny(text, ['肩背', '宽厚', '交领', '不压肩', '不卡手臂'])
      ? '「简约大气 · 高个宽厚肩背交领新中式正装」'
      : hasAny(text, ['香云纱', '低调', '内敛'])
        ? '「素雅本真 · 香云纱松弛静奢美学」'
        : hasAny(text, ['梅花', '青果'])
          ? '「疏影雅韵 · 宋锦暗花柔和静奢」'
          : isUniform
            ? '「摩登金融海派 · 建筑秩序美学」'
            : '「端庄海派 · 体型友好现代中式正装」';

  const targetAudienceInsight =
    bodyErgonomics.length > 0
      ? `已自动识别体态与动作诉求：${bodyErgonomics.join('；')}。${colorSpecifiedByUser ? '' : '（成衣用色待核）'}`
      : `面向「${input.clientName || '定制客户'}」，聚焦「${Array.from(emotionTags).slice(0, 3).join('、')}」核心情绪诉求。`;

  return {
    engineUsed: 'local_semantic',
    summary:
      '已将原始需求拆解为 8 项专业语言与 6 维结构化审美参数，并严格区分「用户明确说的 / 系统建议的 / 还要人工核实的」。',
    officialSpecs,
    threeBuckets,
    colorSpecifiedByUser,
    bodyErgonomics,
    dimensions,
    emotionTags: Array.from(emotionTags).slice(0, 5),
    aestheticArchetype,
    targetAudienceInsight,
    extractedKeywords: Array.from(extractedKeywords),
    timestamp: new Date().toISOString(),
  };
}

interface WorkerStructuredSpec {
  key: OfficialSpecItem['key'];
  label: string;
  value: string;
  infoStatus: 'explicit' | 'suggested' | 'unknown';
  constraintKind: 'hard' | 'soft' | 'excluded' | 'pending';
  sourceQuote: string | null;
  rationale: string;
  ergonomicCue: string | null;
}

interface WorkerDeconstructSuccessPayload {
  ok: true;
  result: {
    schemaVersion: string;
    aestheticArchetype: string;
    emotionTags: string[];
    colorSpecifiedByUser: boolean;
    bodyErgonomics: string[];
    followUpQuestions: string[];
    officialSpecs: WorkerStructuredSpec[];
    threeBuckets: ThreeBucketBreakdown;
  };
  warnings?: string[];
  meta?: {
    model?: string;
    reasoningEffort?: string;
    schemaVersion?: string;
    usage?: {
      inputTokens: number;
      cachedTokens: number;
      outputTokens: number;
      reasoningTokens: number;
    } | null;
    costUsd?: number;
    conservativeCostApplied?: boolean;
  };
  quota?: WorkerQuotaSnapshot;
}

interface WorkerErrorPayload {
  ok: false;
  errorCode?: string;
  message?: string;
  quota?: WorkerQuotaSnapshot;
}

export type DeconstructCallOutcome =
  | {
      ok: true;
      data: DeconstructedRequirement;
      quota?: WorkerQuotaSnapshot;
    }
  | {
      ok: false;
      error: DeconstructErrorInfo;
      quota?: WorkerQuotaSnapshot;
    };

function mapInfoStatusToProvenance(status: WorkerStructuredSpec['infoStatus']): SpecProvenance {
  if (status === 'explicit') return 'user_explicit';
  if (status === 'unknown') return 'needs_human_verification';
  return 'system_suggested';
}

export async function fetchWorkerLlmStatus(): Promise<WorkerLlmStatus | null> {
  try {
    const res = await fetch('/api/llm/status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<WorkerLlmStatus> & { ok?: boolean };
    if (!data.ok || !data.quota) return null;
    return {
      configured: Boolean(data.configured),
      model: data.model ?? 'gpt-6.2-astra',
      reasoningEffort: data.reasoningEffort ?? 'low',
      schemaVersion: data.schemaVersion ?? 'sartoria_requirement_v1',
      quota: data.quota,
    };
  } catch {
    return null;
  }
}

export async function deconstructRequirement(
  input: RequirementInput,
  mode: EngineMode
): Promise<DeconstructCallOutcome> {
  const localBaseline = deconstructLocally(input);

  if (mode === 'local_rules') {
    return { ok: true, data: localBaseline };
  }

  try {
    const response = await fetch('/api/deconstruct', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawNarrative: input.rawNarrative,
        projectName: input.projectName,
        clientName: input.clientName,
        businessType: input.businessType,
        season: input.season,
        targetSceneId: input.targetSceneId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | WorkerDeconstructSuccessPayload
      | WorkerErrorPayload
      | null;

    if (!response.ok || !payload || !payload.ok) {
      const errPayload = payload && !payload.ok ? payload : null;
      return {
        ok: false,
        error: {
          errorCode: errPayload?.errorCode ?? `HTTP_${response.status}`,
          message:
            errPayload?.message ??
            '在线 AI 代理服务暂不可用，可切换本地规则引擎继续完成拆解与选配。',
          resetAt: errPayload?.quota?.resetAt,
        },
        quota: errPayload?.quota,
      };
    }

    const r = payload.result;
    const mappedSpecs: OfficialSpecItem[] = r.officialSpecs.map((s) => ({
      key: s.key,
      label: s.label,
      value: s.value,
      provenance: mapInfoStatusToProvenance(s.infoStatus),
      constraintKind: s.constraintKind,
      sourceQuote: s.sourceQuote,
      sourceNote: s.rationale || undefined,
      ergonomicCue: s.ergonomicCue || undefined,
    }));

    const specByKey = (k: OfficialSpecItem['key']) =>
      mappedSpecs.find((s) => s.key === k)?.value ?? '';
    const scene = SCENES.find((s) => s.id === input.targetSceneId) ?? SCENES[0];

    const dimensions: DimensionItem[] = [
      {
        key: 'styleTone',
        label: '风格调性',
        value: r.emotionTags.slice(0, 3).join(' · ') || localBaseline.dimensions[0].value,
        detail: `结合「${specByKey('category')}」定位，由 GPT-6.2 Astra 结构化提取。`,
        score: 95,
      },
      {
        key: 'silhouetteReq',
        label: '廓形要求',
        value: specByKey('patternStructure'),
        detail: `${specByKey('lengthRatio')}；${specByKey('easeAllowance')}`,
        score: 96,
      },
      {
        key: 'fabricTexture',
        label: '面料质感',
        value: specByKey('fabric'),
        detail: `匹配「${SEASON_LABELS[input.season]}」穿着体感，实物手感须线下米样核验。`,
        score: input.season === 'summer' ? 90 : 95,
      },
      {
        key: 'craftDetail',
        label: '工艺细节',
        value: `${specByKey('collar')}｜${specByKey('motif')}`,
        detail:
          r.bodyErgonomics.length > 0
            ? r.bodyErgonomics.slice(0, 2).join('；')
            : localBaseline.dimensions[3].detail,
        score: 94,
      },
      {
        key: 'colorSystem',
        label: '色彩体系',
        value: specByKey('color'),
        detail: r.colorSpecifiedByUser
          ? `适配 ${scene.lighting.colorTempLabel}，最终以线下实物米样核色为准。`
          : '客户未指定颜色，系统不代客定色，留待顾问线下核对实物色卡。',
        score: r.colorSpecifiedByUser ? 92 : 85,
      },
      {
        key: 'sceneFit',
        label: '场景适配度',
        value: `${scene.name}（${scene.formality}）`,
        detail: scene.backdropHint,
        score: scene.suitableBusiness.includes(input.businessType) ? 96 : 86,
      },
    ];

    const usageMeta: DeconstructUsageMeta | null = payload.meta?.usage
      ? {
          inputTokens: payload.meta.usage.inputTokens,
          cachedTokens: payload.meta.usage.cachedTokens,
          outputTokens: payload.meta.usage.outputTokens,
          reasoningTokens: payload.meta.usage.reasoningTokens,
          costUsd: payload.meta.costUsd ?? 0,
          conservativeCostApplied: payload.meta.conservativeCostApplied,
        }
      : null;

    return {
      ok: true,
      quota: payload.quota,
      data: {
        engineUsed: 'llm_api',
        modelUsed: payload.meta?.model ?? 'gpt-6.2-astra',
        schemaVersion: payload.meta?.schemaVersion ?? r.schemaVersion,
        summary: '已通过服务端 GPT-6.2 Astra Structured Outputs 完成 8 项专业参数与三类信息边界拆解。',
        officialSpecs: mappedSpecs,
        threeBuckets: r.threeBuckets,
        colorSpecifiedByUser: r.colorSpecifiedByUser,
        bodyErgonomics: r.bodyErgonomics,
        followUpQuestions: r.followUpQuestions,
        validationWarnings: payload.warnings,
        usageMeta,
        dimensions,
        emotionTags: r.emotionTags.slice(0, 5),
        aestheticArchetype: r.aestheticArchetype,
        targetAudienceInsight:
          r.bodyErgonomics.length > 0
            ? r.bodyErgonomics.join('；')
            : localBaseline.targetAudienceInsight,
        extractedKeywords: r.bodyErgonomics,
        timestamp: new Date().toISOString(),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        errorCode: 'NETWORK_ERROR',
        message: '无法连接本站 Worker API，请检查网络或切换本地规则引擎离线运行。',
      },
    };
  }
}
