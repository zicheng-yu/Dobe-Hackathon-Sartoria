export type BusinessType = 'private_couture' | 'corporate_uniform';
export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter' | 'all_season';
export type StylePackId = 'shanghai-haipai' | 'minimal-executive';

export interface StylePack {
  id: StylePackId;
  name: string;
  enterprise: string;
  tagline: string;
  description: string;
  signatureElements: string[];
  accentHex: string;
  isDefault?: boolean;
}

export interface BlueprintConfig {
  silhouetteType:
    | 'jacket_h_cross_collar'
    | 'jacket_h_low_collar'
    | 'jacket_h_shawl'
    | 'stage_two_piece'
    | 'jacket_h_dropped'
    | 'gown_column'
    | 'gown_cape'
    | 'suit_woman_stand'
    | 'suit_man_double'
    | 'suit_ensemble';
  collarStyle:
    | 'cross_open_no_stand'
    | 'mandarin_low_3cm'
    | 'mandarin_high'
    | 'mandarin_hidden'
    | 'shawl_narrow'
    | 'diagonal_cn'
    | 'peak_lapel'
    | 'notch_lapel'
    | 'shawl_cape';
  closureStyle:
    | 'open_no_buttons'
    | 'pipa_frog'
    | 'hidden_placket'
    | 'cn_buttons'
    | 'double_breasted'
    | 'single_two_btn';
  hemLength: 'mid_hip' | 'ankle_two_piece' | 'floor' | 'midi' | 'tailored_suit';
  shoulderLine: 'micro_drop_flat' | 'natural_dropped' | 'sculpted_soft' | 'architectural' | 'natural_sloped';
  slitHeight?: 'subtle' | 'medium' | 'none';
  easeHighlight?: string;
  accentTrimHex?: string;
  innerDressHex?: string;
}

export interface PatternAsset {
  id: string;
  code: string;
  name: string;
  shortSpec: string;
  stylePackId: StylePackId;
  businessType: BusinessType;
  category: string;
  silhouette: string;
  collarType: string;
  shoulderType: string;
  lengthRatio: string;
  easeAllowance: string;
  fitGuidance: string;
  suitableScenes: string[];
  styleTags: string[];
  seasonFit: SeasonType[];
  usageStandard: string;
  baseLeadDays: number;
  blueprintConfig: BlueprintConfig;
  description: string;
}

export interface FabricPBRConfig {
  baseColor: string;
  accentColor: string;
  sheenColor: string;
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  metalness: number;
  weaveType:
    | 'silk_subtle_jacquard'
    | 'song_brocade'
    | 'silk_damask'
    | 'velvet_jacquard'
    | 'worsted_twill'
    | 'wool_silk'
    | 'satin_drape'
    | 'xiangyun_matte'
    | 'acetate_jacquard';
  patternDensity: number;
}

export interface FabricAsset {
  id: string;
  code: string;
  name: string;
  shortName: string;
  stylePackId: StylePackId;
  colorName: string;
  colorFamily:
    | 'neutral_silk'
    | 'obsidian'
    | 'ivory'
    | 'crimson'
    | 'navy'
    | 'stone_gray'
    | 'pine_green'
    | 'champagne'
    | 'mist_blue'
    | 'ivory_rose'
    | 'earth_brown';
  composition: string;
  gsm: number;
  weave: string;
  luster: '高雅丝光' | '微闪织金' | '丝绒深光' | '高级哑光' | '柔润微光' | '温润哑光';
  drape: '流畅垂坠' | '挺括有骨' | '挺而不硬' | '轻盈飘逸' | '厚实立体';
  seasons: SeasonType[];
  suitableBusiness: BusinessType[];
  suitableScenes: string[];
  styleTags: string[];
  careAndMoqNote: string;
  isDelicateForUniform?: boolean;
  pbr: FabricPBRConfig;
  description: string;
}

export interface CraftHotspot {
  x: number;
  y: number;
  zoomScale: number;
  label: string;
}

export interface CraftAsset {
  id: string;
  code: string;
  name: string;
  shortName: string;
  stylePackId: StylePackId;
  heritageLevel: '非遗技艺' | '海派精工' | '团装标准';
  placement: string;
  extraLeadDays: number;
  compatibleFabrics: string[];
  incompatibleNotes?: string;
  suitableBusiness: BusinessType[];
  styleTags: string[];
  usageStandard: string;
  highlightCopy: string;
  hotspot: CraftHotspot;
  closeupImage: string;
}

export interface HistoricalCaseAsset {
  id: string;
  code: string;
  title: string;
  stylePackId: StylePackId;
  businessType: BusinessType;
  clientProfile: string;
  sceneId: string;
  patternId: string;
  fabricId: string;
  craftIds: string[];
  groupSize: string;
  referenceCycle: string;
  styleTags: string[];
  reviewSummary: string;
  heroImage: string;
}

export interface SceneLightingPreset {
  ambientColor: string;
  ambientIntensity: number;
  keyLightColor: string;
  keyLightIntensity: number;
  rimLightColor: string;
  cssFilter: string;
  overlayGradient: string;
  colorTempLabel: string;
}

export interface SceneEnvironment {
  id: string;
  name: string;
  shortName: string;
  locationTag: string;
  formality: string;
  suitableBusiness: BusinessType[];
  recommendedColorFamilies: FabricAsset['colorFamily'][];
  atmosphereKeywords: string[];
  backdropHint: string;
  accentSwatch: string;
  lighting: SceneLightingPreset;
  fallbackImage: string;
}

export interface RequirementInput {
  projectName: string;
  clientName: string;
  businessType: BusinessType;
  season: SeasonType;
  groupSize: string;
  targetSceneId: string;
  rawNarrative: string;
  presetDemoId?: string;
}

export type SpecProvenance =
  | 'user_explicit'
  | 'system_suggested'
  | 'needs_human_verification';

export interface OfficialSpecItem {
  key:
    | 'category'
    | 'patternStructure'
    | 'collar'
    | 'fabric'
    | 'color'
    | 'motif'
    | 'lengthRatio'
    | 'easeAllowance';
  label: string;
  value: string;
  provenance?: SpecProvenance;
  sourceNote?: string;
  ergonomicCue?: string;
}

export interface ThreeBucketBreakdown {
  userExplicit: string[];
  systemSuggested: string[];
  needsHumanVerification: string[];
}

export interface DimensionItem {
  key: 'styleTone' | 'silhouetteReq' | 'fabricTexture' | 'craftDetail' | 'colorSystem' | 'sceneFit';
  label: string;
  value: string;
  detail: string;
  score: number;
}

export interface DeconstructedRequirement {
  engineUsed: 'local_semantic' | 'llm_api';
  summary: string;
  officialSpecs: OfficialSpecItem[];
  threeBuckets: ThreeBucketBreakdown;
  colorSpecifiedByUser: boolean;
  bodyErgonomics: string[];
  dimensions: DimensionItem[];
  emotionTags: string[];
  aestheticArchetype: string;
  targetAudienceInsight: string;
  extractedKeywords: string[];
  timestamp: string;
}

export interface ConfigurationState {
  patternId: string;
  fabricId: string;
  craftIds: string[];
  sceneId: string;
  activeView: 'scene_look' | 'craft_3d' | 'blueprint';
  focusedHotspotId: string | null;
}

export interface FabricThreeDimRationale {
  styleFit: string;
  comfortFit: string;
  bodyFit: string;
}

export interface MatchExplanation {
  overallScore: number;
  patternScore: number;
  fabricScore: number;
  craftScore: number;
  sceneScore: number;
  reasons: {
    category: '版型适配' | '面料适配' | '工艺组合' | '场景契合';
    title: string;
    detail: string;
    score: number;
  }[];
  fabricRationale: FabricThreeDimRationale;
  similarCaseIds: string[];
}

export interface FeasibilityNotice {
  id: string;
  level: 'pass' | 'caution' | 'risk';
  dimension: '季节克重' | '工艺兼容' | '工期排期' | '团单规范' | '人工边界';
  title: string;
  detail: string;
}

export interface ResourceBasisItem {
  assetType: '版型' | '面料' | '工艺' | '历史案例';
  code: string;
  name: string;
  sourceTag: string;
  rationale: string;
}

export interface WorkflowStageSummary {
  step: number;
  title: string;
  owner: 'AI 企划辅助' | '人机协同核实' | '人工终审执行';
  status: string;
  detail: string;
}

export interface ProposalDraft {
  id: string;
  generatedAt: string;
  projectName: string;
  clientName: string;
  businessType: BusinessType;
  stylePositioning: string;
  emotionAlignment: string;
  officialSpecs: OfficialSpecItem[];
  threeBuckets: ThreeBucketBreakdown;
  colorSpecifiedByUser: boolean;
  resourceBasis: ResourceBasisItem[];
  fabricRationale: FabricThreeDimRationale;
  workflowStages: WorkflowStageSummary[];
  patternSummary: string;
  fabricSummary: string;
  craftSummary: string;
  sceneAdaptation: string;
  designHighlights: string[];
  estimatedLeadTimeNote: string;
  feasibilityNotices: FeasibilityNotice[];
  humanReviewChecklist: string[];
  dataSourceStatement: string;
  boundaryDisclaimer: string;
}

export type PromptToolFormat = 'midjourney' | 'flux_sd' | 'jimeng_cn';

export interface ShotPrompt {
  shotType: 'full_garment' | 'craft_macro' | 'scene_editorial';
  shotTitle: string;
  shotSubtitle: string;
  aspectRatio: string;
  cameraSpec: string;
  lightingSpec: string;
  prompts: Record<PromptToolFormat, string>;
  negativePrompt: string;
}

export interface VisualPromptPack {
  packTitle: string;
  generatedAt: string;
  paletteSummary: string;
  colorDisclaimer: string;
  mustPreserveConstraints: string[];
  apiBoundaryNote: string;
  shots: ShotPrompt[];
  deliveryBrief: string[];
}

export type LedgerReviewStatus = 'AI草稿' | '待业务专员复核' | '待版师/报价终审' | '已归档';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  stage: '需求解构' | '资源选配' | '方案初稿' | '视觉提示词' | '人工复核';
  action: string;
  detail: string;
  diffSummary?: string;
  actor: 'Sartoria AI 助手' | '定制业务专员（人工）';
}

export interface LedgerRecord {
  id: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  businessType: BusinessType;
  stylePackId: StylePackId;
  createdAt: string;
  updatedAt: string;
  status: LedgerReviewStatus;
  matchScore: number;
  matchedCaseIds: string[];
  requirementInput: RequirementInput;
  deconstructed: DeconstructedRequirement;
  config: ConfigurationState;
  proposal: ProposalDraft;
  promptPack: VisualPromptPack;
  specialistNotes: string;
  auditLogs: AuditLogEntry[];
}

export interface LlmSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface PresetDemoCase {
  id: string;
  badge: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  businessType: BusinessType;
  thumbImage: string;
  input: RequirementInput;
  officialSpecOverride?: OfficialSpecItem[];
  threeBucketsOverride?: ThreeBucketBreakdown;
  colorSpecifiedByUser?: boolean;
  recommendedConfig: ConfigurationState;
  specialistNoteSeed: string;
}
