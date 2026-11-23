import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type { LedgerRecord, ProposalDraft, VisualPromptPack } from '../types/sartoria';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildLedgerCsv(records: LedgerRecord[]): string {
  const headers = [
    '项目编号',
    '项目名称',
    '客户名称',
    '业务类型',
    '复核状态（人工流转）',
    '综合适配度',
    '客户原始需求',
    '色彩状态',
    '选用版型（静态模拟）',
    '选用面料（静态模拟）',
    '工艺组合（静态模拟）',
    '参考历史案例（静态模拟）',
    '目标场景',
    '情绪审美标签',
    '专员复核备注',
    '修改轨迹摘要（改过什么）',
    '数据状态说明',
    '最近更新时间',
  ];

  const rows = records.map((rec) => {
    const pat = PATTERNS.find((p) => p.id === rec.config.patternId);
    const fab = FABRICS.find((f) => f.id === rec.config.fabricId);
    const scene = SCENES.find((s) => s.id === rec.config.sceneId);
    const craftNames = CRAFTS.filter((c) => rec.config.craftIds.includes(c.id))
      .map((c) => `${c.code} ${c.name}`)
      .join(' / ');
    const caseNames = HISTORICAL_CASES.filter((hc) => (rec.matchedCaseIds ?? []).includes(hc.id))
      .map((hc) => `${hc.code} ${hc.title}`)
      .join(' / ');
    const changeSummary = rec.auditLogs
      .map((l) => (l.diffSummary ? `${l.action}（${l.diffSummary}）` : l.action))
      .join(' → ');

    return [
      rec.projectCode,
      rec.projectName,
      rec.clientName,
      rec.businessType === 'private_couture' ? '高端海派私定' : '团体职业服定制',
      rec.status,
      `${rec.matchScore}%`,
      rec.requirementInput.rawNarrative,
      rec.deconstructed.colorSpecifiedByUser ? '客户已表达色彩倾向（待米样核色）' : '客户未指定颜色（不代客定色）',
      pat ? `${pat.code} ${pat.name}` : rec.config.patternId,
      fab ? `${fab.code} ${fab.name}` : rec.config.fabricId,
      craftNames || '基准工艺',
      caseNames || '—',
      scene?.name ?? rec.config.sceneId,
      rec.deconstructed.emotionTags.join('、'),
      rec.specialistNotes || '（待补充）',
      changeSummary,
      '静态模拟定制资产（非真实生产数据）',
      rec.updatedAt,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  // UTF-8 BOM ensures Excel opens Chinese CSV cleanly without mojibake
  return `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\n')}`;
}

export function buildAssetCatalogCsv(): string {
  const headers = [
    '资产大类',
    '资产编号',
    '资产名称',
    '风格包',
    '核心参数',
    '适用规范与说明',
    '数据来源与模拟状态',
  ];
  const simNote = '模拟静态定制资产（基于上服海派定制案例结构化整理，非真实生产API）';

  const rows: string[][] = [
    ...PATTERNS.map((p) => [
      '海派经典版型',
      p.code,
      p.name,
      p.stylePackId,
      `${p.silhouette} | ${p.collarType}`,
      p.usageStandard,
      simNote,
    ]),
    ...FABRICS.map((f) => [
      '特色定制面料',
      f.code,
      f.name,
      f.stylePackId,
      `${f.composition} | ${f.gsm}g/m² | ${f.luster}`,
      f.careAndMoqNote,
      simNote,
    ]),
    ...CRAFTS.map((c) => [
      '非遗与经典工艺',
      c.code,
      c.name,
      c.stylePackId,
      `${c.heritageLevel} | ${c.placement} | +${c.extraLeadDays}天`,
      c.usageStandard,
      simNote,
    ]),
    ...HISTORICAL_CASES.map((hc) => [
      '历史标杆案例',
      hc.code,
      hc.title,
      hc.stylePackId,
      `${hc.clientProfile} | ${hc.groupSize}`,
      hc.reviewSummary,
      simNote,
    ]),
  ];

  return `\uFEFF${[
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\n')}`;
}

export function buildProposalMarkdown(proposal: ProposalDraft): string {
  const lines: string[] = [
    `# ${proposal.projectName} · 定制企划方案初稿`,
    '',
    `- 方案编号：\`${proposal.id}\``,
    `- 客户：${proposal.clientName}`,
    `- 定位：${proposal.stylePositioning}`,
    `- 生成时间：${proposal.generatedAt}`,
    `- ${proposal.dataSourceStatement}`,
    '',
    '## 一、三类信息分离（边界透明）',
    '',
    '### 1. 用户明确说的',
    ...proposal.threeBuckets.userExplicit.map((x) => `- ${x}`),
    '',
    '### 2. 系统建议的',
    ...proposal.threeBuckets.systemSuggested.map((x) => `- ${x}`),
    '',
    '### 3. 还要人工核实的',
    ...proposal.threeBuckets.needsHumanVerification.map((x) => `- ${x}`),
    '',
    '## 二、8 项专业定制参数转化',
    ...proposal.officialSpecs.map((s) => `- **【${s.label}】** ${s.value}`),
    '',
    '## 三、四类静态模拟资产匹配依据',
    ...proposal.resourceBasis.map(
      (r) => `- **[${r.assetType}] ${r.code} ${r.name}**（${r.sourceTag}）：${r.rationale}`
    ),
    '',
    '### 面料三维判断依据',
    `- **风格适配**：${proposal.fabricRationale.styleFit}`,
    `- **体感适配**：${proposal.fabricRationale.comfortFit}`,
    `- **体型适配**：${proposal.fabricRationale.bodyFit}`,
    '',
    '## 四、可行性提示与人工终审清单',
    ...proposal.feasibilityNotices.map((n) => `- [${n.dimension}] **${n.title}**：${n.detail}`),
    '',
    '### 人工接手与终审核对',
    ...proposal.humanReviewChecklist.map((c, idx) => `${idx + 1}. ${c}`),
    '',
    `> ${proposal.boundaryDisclaimer}`,
    '',
  ];
  return lines.join('\n');
}

export function buildPromptPackMarkdown(pack: VisualPromptPack): string {
  const lines: string[] = [
    `# ${pack.packTitle}`,
    '',
    `- 生成时间：${pack.generatedAt}`,
    `- 色彩与光照基准：${pack.paletteSummary}`,
    `- 色彩边界提示：${pack.colorDisclaimer}`,
    `- ${pack.apiBoundaryNote}`,
    '',
    '## 视觉必保结构约束',
    ...pack.mustPreserveConstraints.map((c) => `- ${c}`),
    '',
  ];

  for (const shot of pack.shots) {
    lines.push(`## ${shot.shotTitle}`);
    lines.push(`> ${shot.shotSubtitle}`);
    lines.push(`- 推荐画幅：\`${shot.aspectRatio}\` ｜ 镜头：${shot.cameraSpec} ｜ 灯光：${shot.lightingSpec}`);
    lines.push('');
    lines.push('### Midjourney v6.1');
    lines.push('```text');
    lines.push(shot.prompts.midjourney);
    lines.push('```');
    lines.push('');
    lines.push('### Flux.1 / Stable Diffusion');
    lines.push('```text');
    lines.push(shot.prompts.flux_sd);
    lines.push('```');
    lines.push('');
    lines.push('### 即梦（中文直出）');
    lines.push('```text');
    lines.push(shot.prompts.jimeng_cn);
    lines.push('```');
    lines.push('');
    lines.push(`- 负向提示词（Negative Prompt）：\`${shot.negativePrompt}\``);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
