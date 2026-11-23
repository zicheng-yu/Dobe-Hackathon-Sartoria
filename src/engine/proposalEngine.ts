import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type {
  ConfigurationState,
  DeconstructedRequirement,
  FeasibilityNotice,
  MatchExplanation,
  ProposalDraft,
  RequirementInput,
  ResourceBasisItem,
  WorkflowStageSummary,
} from '../types/sartoria';
import { evaluateMatch } from './matchingEngine';

export function generateProposalDraft(
  input: RequirementInput,
  deconstructed: DeconstructedRequirement,
  config: ConfigurationState,
  feasibilityNotices: FeasibilityNotice[],
  matchOverride?: MatchExplanation
): ProposalDraft {
  const pattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const fabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const scene = SCENES.find((s) => s.id === config.sceneId) ?? SCENES[0];
  const crafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));
  const match = matchOverride ?? evaluateMatch(input, deconstructed, config);
  const similarCases = HISTORICAL_CASES.filter((hc) => match.similarCaseIds.includes(hc.id));

  const extraDays = crafts.reduce((sum, c) => sum + c.extraLeadDays, 0);
  const totalRefDays = pattern.baseLeadDays + extraDays;
  const isUniform = input.businessType === 'corporate_uniform';

  const resourceBasis: ResourceBasisItem[] = [
    {
      assetType: '版型',
      code: pattern.code,
      name: pattern.name,
      sourceTag: '模拟静态资产 · 海派版型库',
      rationale: `${pattern.silhouette}；${pattern.collarType}；适配说明：${pattern.fitGuidance}`,
    },
    {
      assetType: '面料',
      code: fabric.code,
      name: fabric.name,
      sourceTag: '模拟静态资产 · 特色面料库',
      rationale: `风格：${match.fabricRationale.styleFit} 体感：${match.fabricRationale.comfortFit} 体型：${match.fabricRationale.bodyFit}`,
    },
    ...crafts.map((c) => ({
      assetType: '工艺' as const,
      code: c.code,
      name: c.name,
      sourceTag: `模拟静态资产 · ${c.heritageLevel}`,
      rationale: `${c.placement}；${c.usageStandard}`,
    })),
    ...similarCases.map((hc) => ({
      assetType: '历史案例' as const,
      code: hc.code,
      name: hc.title,
      sourceTag: '模拟静态资产 · 历史案例库',
      rationale: hc.reviewSummary,
    })),
  ];

  const workflowStages: WorkflowStageSummary[] = [
    {
      step: 1,
      title: '设计语言转化',
      owner: 'AI 企划辅助',
      status: '已完成初稿',
      detail: '将客户口述拆解为 8 项专业语言 + 6 维审美标签，严格分离用户明确诉求、系统建议与待人工核实项。',
    },
    {
      step: 2,
      title: '设计图与视觉需求包',
      owner: 'AI 企划辅助',
      status: '已生成提示词包',
      detail: '输出成衣/细节/上身氛围三镜头标准化绘图提示词与结构约束（不接外部绘图 API，不做现场出图）。',
    },
    {
      step: 3,
      title: '面料选型与米样核色',
      owner: '人机协同核实',
      status: deconstructed.colorSpecifiedByUser ? '待实物米样核色' : '未定色 · 待人工核色',
      detail: 'AI 给出风格/体感/体型三维选料依据；实物色卡、克重手感与暗纹尺度须顾问线下与客户核定。',
    },
    {
      step: 4,
      title: '版型参考与 CAD 定版',
      owner: '人工终审执行',
      status: '待版师人工接手',
      detail: 'AI 仅提供廓形结构与放量方向参考，不做 CAD 定版；净体量体、具体松量数值与 CAD（富怡/ET）制版均由版师人工完成。',
    },
    {
      step: 5,
      title: '线下初样打样与试身',
      owner: '人工终审执行',
      status: '线下工坊执行',
      detail: '不在 Agent 能力范围内；初样制作与试穿核对（压肩、袖笼活动量、领型弧度、衣长比例）均由人工执行。',
    },
    {
      step: 6,
      title: '正式报价、签约与成衣交付',
      owner: '人工终审执行',
      status: '严禁 AI 越界',
      detail: '正式报价、合同签署、复样裁剪、成衣品控与客户交付 100% 由人工业务与工坊团队完成。',
    },
  ];

  const designHighlights: string[] = [
    `廓形与体态修饰：选用「${pattern.name}」（${pattern.code}），${pattern.silhouette}；${pattern.easeAllowance}。`,
    `领型与比例：${pattern.collarType}，${pattern.lengthRatio}。`,
    `核心面料与三维依据：推荐「${fabric.name}」（${fabric.code}，${fabric.composition}，参考 ${fabric.gsm}g/m²）——${match.fabricRationale.bodyFit}`,
    crafts.length > 0
      ? `工艺细节组合：叠加${crafts.map((c) => `「${c.name}」`).join('、')}，${crafts[0].highlightCopy}`
      : '克制极简：保留净面立体剪裁与内里包边精工，突出面料自然肌理。',
    !deconstructed.colorSpecifiedByUser
      ? '色彩留白声明：客户原话未指定颜色，本方案不代客定色，待线下实物色卡核定。'
      : `色彩与场景适配：适配「${scene.name}（${scene.lighting.colorTempLabel}）」，最终显色以工坊米样为准。`,
  ];

  const humanReviewChecklist = isUniform
    ? [
        '业务专员与客户品牌部现场核对实物面料米样与自然光显色',
        '团装版师复核分级号型套码量体方案及男女领型微调（不凭空定放量数）',
        '商务团队独立出具正式团单报价、交付节点与合同条款（AI 不介入报价与签约）',
        '样衣经客户终审签字后由业务人员线下安排生产（AI 不对接生产系统）',
      ]
    : [
        deconstructed.colorSpecifiedByUser
          ? '定制顾问邀约客户在工坊高显色光源下触感比对实物面料米样与色泽'
          : '【必核项】客户未指定颜色，须由顾问携多组实物面料色卡线下与客户确认颜色（AI 不代客定色）',
        '【必核项】资深版师实测净体尺寸并核定肩宽/背宽/袖笼/腰腹具体松量厘米数，完成人工 CAD 定版与试身',
        '手工工坊人工确认工艺位点、暗花对位与制作排期（不做自动打样与排产）',
        '由定制专员与客户完成正式报价确认、合同签署与下单流程（AI 不介入商务决策）',
      ];

  return {
    id: `PROP-${Date.now().toString().slice(-6)}`,
    generatedAt: new Date().toISOString(),
    projectName: input.projectName || pattern.name,
    clientName: input.clientName || '待补充客户名称',
    businessType: input.businessType,
    stylePositioning: `${deconstructed.aestheticArchetype} · ${pattern.category}`,
    emotionAlignment: deconstructed.targetAudienceInsight,
    officialSpecs: deconstructed.officialSpecs,
    threeBuckets: deconstructed.threeBuckets,
    colorSpecifiedByUser: deconstructed.colorSpecifiedByUser,
    resourceBasis,
    fabricRationale: match.fabricRationale,
    workflowStages,
    patternSummary: `${pattern.name}（${pattern.code}）｜${pattern.silhouette}｜${pattern.collarType}`,
    fabricSummary: `${fabric.name}（${fabric.code}）｜${fabric.composition}｜参考 ${fabric.gsm}g/m²｜${fabric.careAndMoqNote}`,
    craftSummary:
      crafts.length > 0
        ? crafts.map((c) => `${c.name}（${c.code} · ${c.heritageLevel}，${c.placement}）`).join('；')
        : '净面基准精工工艺',
    sceneAdaptation: `${scene.name}（${scene.formality} · ${scene.lighting.colorTempLabel}）`,
    designHighlights,
    estimatedLeadTimeNote: `参考企划周期约 ${totalRefDays} 个工作日（基准 ${pattern.baseLeadDays} 天 + 工艺 ${extraDays} 天，仅为静态库估算参考，非正式交期承诺）。`,
    feasibilityNotices,
    humanReviewChecklist,
    dataSourceStatement:
      '【数据来源与模拟状态声明】本方案引用的版型、面料、工艺与历史案例均来自系统内置「模拟静态定制资产库」（源自上海服装集团海派定制公开案例结构化整理），不接入真实 ERP/PLM/MES 生产系统或真实客户业务 API。',
    boundaryDisclaimer:
      '【能力边界声明】本方案仅为 Sartoria AI 企划辅助初稿。色彩确认、净体量体与具体放量数值、CAD 定版、实物打样试身、正式报价、商务签约及生产下单全部由专业人工团队执行。',
  };
}
