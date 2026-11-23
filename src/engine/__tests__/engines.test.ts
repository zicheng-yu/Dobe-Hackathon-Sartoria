import { describe, expect, it } from 'vitest';
import { PRESET_DEMO_CASES } from '../../data/presetDemos';
import {
  buildAssetCatalogCsv,
  buildLedgerCsv,
  buildPromptPackMarkdown,
  buildProposalMarkdown,
} from '../../utils/exporters';
import { buildPathname, parsePathname } from '../../utils/router';
import { deconstructLocally } from '../deconstructEngine';
import { createSeedLedgerRecords } from '../ledgerStore';
import { evaluateFeasibility, evaluateMatch, recommendInitialConfig } from '../matchingEngine';
import { generateVisualPromptPack } from '../promptEngine';
import { generateProposalDraft } from '../proposalEngine';
import { resolveStageVisual } from '../visualResolver';

describe('Sartoria AI Core Engines (Primary Demo Case 6 + Case 3 + Competition Suite)', () => {
  it('sets Official Case 6 as primary demo and translates all preset cases with 3-bucket separation', () => {
    expect(PRESET_DEMO_CASES).toHaveLength(7);
    expect(PRESET_DEMO_CASES[0].id).toBe('official-case-6');
    expect(PRESET_DEMO_CASES[1].id).toBe('official-case-3');

    for (const demo of PRESET_DEMO_CASES) {
      const result = deconstructLocally(demo.input);
      expect(result.officialSpecs).toHaveLength(8);
      expect(result.dimensions).toHaveLength(6);
      expect(result.emotionTags.length).toBeGreaterThanOrEqual(3);
      expect(result.threeBuckets.userExplicit.length).toBeGreaterThan(0);
      expect(result.threeBuckets.systemSuggested.length).toBeGreaterThan(0);
      expect(result.threeBuckets.needsHumanVerification.length).toBeGreaterThan(0);
    }
  });

  it('keeps unspecified color undecided and never invents ease numbers for Official Case 6', () => {
    const case6 = PRESET_DEMO_CASES[0];
    const deconstructed = deconstructLocally(case6.input);

    expect(deconstructed.colorSpecifiedByUser).toBe(false);
    const colorSpec = deconstructed.officialSpecs.find((s) => s.key === 'color')!;
    const collarSpec = deconstructed.officialSpecs.find((s) => s.key === 'collar')!;
    const easeSpec = deconstructed.officialSpecs.find((s) => s.key === 'easeAllowance')!;

    expect(colorSpec.provenance).toBe('needs_human_verification');
    expect(colorSpec.value).toContain('不代客决定');
    expect(collarSpec.value).toContain('交领开襟');
    expect(easeSpec.provenance).toBe('needs_human_verification');
    expect(easeSpec.value).not.toMatch(/\d+\s*cm/i);

    const config = recommendInitialConfig(case6.input, deconstructed);
    expect(config.patternId).toBe('pat-official-cross-collar-silk');
    expect(config.fabricId).toBe('fab-official-silk-jacquard-subtle');
    expect(config.craftIds).toContain('crf-cross-collar-no-button');

    const match = evaluateMatch(case6.input, deconstructed, config);
    expect(match.overallScore).toBeGreaterThanOrEqual(90);
    expect(match.similarCaseIds).toContain('case-hist-006');
    expect(match.fabricRationale.bodyFit).toContain('肩背宽厚');

    const feasibility = evaluateFeasibility(case6.input, config, deconstructed);
    expect(feasibility.some((n) => n.id === 'feas-color-unassigned')).toBe(true);
    expect(feasibility.some((n) => n.dimension === '人工边界')).toBe(true);

    const visual = resolveStageVisual(config);
    expect(visual.heroImage).toBe('/assets/official1-studio-jacket.jpg');
    expect(visual.hotspots).toHaveLength(3);
  });

  it('dynamically parses spontaneous Case 6 and Case 4 ergonomic free-text accurately', () => {
    const case6FreeText = {
      projectName: '自由输入-宽厚肩背',
      clientName: '测试客户A',
      businessType: 'private_couture' as const,
      season: 'autumn' as const,
      groupSize: '1 套',
      targetSceneId: 'scene-studio-minimal',
      rawNarrative:
        '我想定做一件简约大气正式一点的新中式外套，我身形偏高、肩背比较宽厚，不要压肩也不要卡手臂，整体宽松有质感。',
    };
    const res6 = deconstructLocally(case6FreeText);
    expect(res6.colorSpecifiedByUser).toBe(false);
    expect(res6.officialSpecs.find((s) => s.key === 'collar')?.value).toContain('交领开襟');
    expect(res6.officialSpecs.find((s) => s.key === 'fabric')?.value).toContain('真丝暗纹织花');
    const rec6 = recommendInitialConfig(case6FreeText, res6);
    expect(rec6.patternId).toBe('pat-official-cross-collar-silk');
    expect(rec6.fabricId).toBe('fab-official-silk-jacquard-subtle');

    const case4FreeText = {
      projectName: '自定义测试',
      clientName: '自由输入客户',
      businessType: 'private_couture' as const,
      season: 'autumn' as const,
      groupSize: '1 套',
      targetSceneId: 'scene-studio-minimal',
      rawNarrative: '想要一件低调内敛的中式外套，我脖子比较短而且有点溜肩，还有小肚腩，偏好香云纱面料。',
    };
    const res4 = deconstructLocally(case4FreeText);
    expect(res4.officialSpecs.find((s) => s.key === 'collar')?.value).toContain('低立领');
    expect(res4.officialSpecs.find((s) => s.key === 'patternStructure')?.value).toContain('自然落肩');
    expect(res4.officialSpecs.find((s) => s.key === 'fabric')?.value).toContain('香云纱');
    expect(res4.officialSpecs.find((s) => s.key === 'easeAllowance')?.value).toContain('腹部');
    const rec4 = recommendInitialConfig(case4FreeText, res4);
    expect(rec4.patternId).toBe('pat-official-xiangyun-dropped');
    expect(rec4.fabricId).toBe('fab-official-xiangyun-matte');
  });

  it('triggers feasibility guardrails on summer heavy fabric and corporate uniform delicate silk', () => {
    const corporate = PRESET_DEMO_CASES.find((d) => d.id === 'demo-corporate-haipai-uniform')!;
    const summerHeavy = evaluateFeasibility(
      { ...corporate.input, season: 'summer' },
      { ...corporate.recommendedConfig, fabricId: 'fab-heavy-cashmere-obsidian' }
    );
    expect(summerHeavy.some((n) => n.id === 'feas-summer-heavy-gsm' && n.level === 'risk')).toBe(
      true
    );

    const silkUniform = evaluateFeasibility(corporate.input, {
      ...corporate.recommendedConfig,
      fabricId: 'fab-official-plum-song',
    });
    expect(silkUniform.some((n) => n.id === 'feas-uniform-delicate' && n.level === 'risk')).toBe(
      true
    );
    expect(silkUniform.some((n) => n.dimension === '人工边界')).toBe(true);
  });

  it('generates proposal with 4-asset basis, compiles 3-shot prompt pack, and exports traceable CSV/MD', () => {
    const case6 = PRESET_DEMO_CASES[0];
    const deconstructed6 = deconstructLocally(case6.input);
    const match6 = evaluateMatch(case6.input, deconstructed6, case6.recommendedConfig);
    const feas6 = evaluateFeasibility(case6.input, case6.recommendedConfig, deconstructed6);
    const proposal6 = generateProposalDraft(
      case6.input,
      deconstructed6,
      case6.recommendedConfig,
      feas6,
      match6
    );
    const pack6 = generateVisualPromptPack(case6.input, deconstructed6, case6.recommendedConfig);

    expect(proposal6.officialSpecs).toHaveLength(8);
    expect(proposal6.resourceBasis.some((r) => r.assetType === '版型')).toBe(true);
    expect(proposal6.resourceBasis.some((r) => r.assetType === '面料')).toBe(true);
    expect(proposal6.resourceBasis.some((r) => r.assetType === '工艺')).toBe(true);
    expect(proposal6.resourceBasis.some((r) => r.assetType === '历史案例')).toBe(true);
    expect(proposal6.workflowStages).toHaveLength(6);
    expect(proposal6.dataSourceStatement).toContain('模拟静态定制资产库');

    expect(pack6.shots).toHaveLength(3);
    expect(pack6.shots[0].prompts.midjourney).toContain('--v 6.1');
    expect(pack6.shots[0].prompts.midjourney).not.toMatch(/[\u4e00-\u9fa5]/); // Pure idiomatic English MJ prompt
    expect(pack6.colorDisclaimer).toContain('客户未指定颜色');
    expect(pack6.apiBoundaryNote).toContain('不对接外部生图 API');

    const proposalMd = buildProposalMarkdown(proposal6);
    expect(proposalMd).toContain('三类信息分离');
    expect(proposalMd).toContain('SFG-PT-106');

    const stageCase = PRESET_DEMO_CASES.find((d) => d.id === 'official-case-3')!;
    const pack3 = generateVisualPromptPack(
      stageCase.input,
      deconstructLocally(stageCase.input),
      stageCase.recommendedConfig
    );
    expect(pack3.shots[2].prompts.jimeng_cn).toContain('户外音乐舞台');

    const promptMd = buildPromptPackMarkdown(pack6);
    expect(promptMd).toContain('### Midjourney v6.1');
    expect(promptMd).toContain('视觉必保结构约束');

    const seeds = createSeedLedgerRecords();
    expect(seeds).toHaveLength(3);
    expect(seeds[0].id).toBe('seed-official-case-6');
    expect(seeds[1].id).toBe('seed-official-case-3');
    expect(seeds[0].matchedCaseIds.length).toBeGreaterThan(0);

    const ledgerCsv = buildLedgerCsv(seeds);
    expect(ledgerCsv.startsWith('\uFEFF')).toBe(true);
    expect(ledgerCsv).toContain('SFG-2026-001');
    expect(ledgerCsv).toContain('客户原始需求');
    expect(ledgerCsv).toContain('修改轨迹摘要');
    expect(ledgerCsv).toContain('静态模拟定制资产');

    const catalogCsv = buildAssetCatalogCsv();
    expect(catalogCsv).toContain('SFG-PT-106');
    expect(catalogCsv).toContain('SFG-FB-006');
    expect(catalogCsv).toContain('数据来源与模拟状态');
  });

  it('resolves multi-entry portal routes for Cloudflare Workers SPA (/, /demo, /video, /vedio, /docs)', () => {
    expect(parsePathname('/')).toEqual({ section: 'home', demoTab: 'requirements' });
    expect(parsePathname('/demo')).toEqual({ section: 'demo', demoTab: 'requirements' });
    expect(parsePathname('/demo/ledger')).toEqual({ section: 'demo', demoTab: 'ledger' });
    expect(parsePathname('/video')).toEqual({ section: 'video', demoTab: 'requirements' });
    expect(parsePathname('/vedio')).toEqual({ section: 'video', demoTab: 'requirements' });
    expect(parsePathname('/docs')).toEqual({ section: 'docs', demoTab: 'requirements' });

    expect(buildPathname({ section: 'home', demoTab: 'requirements' })).toBe('/');
    expect(buildPathname({ section: 'demo', demoTab: 'requirements' })).toBe('/demo');
    expect(buildPathname({ section: 'demo', demoTab: 'proposal' })).toBe('/demo/proposal');
    expect(buildPathname({ section: 'video', demoTab: 'requirements' })).toBe('/video');
    expect(buildPathname({ section: 'docs', demoTab: 'requirements' })).toBe('/docs');
  });
});
