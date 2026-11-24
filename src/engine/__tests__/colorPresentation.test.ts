import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequirementStudio } from '../../pages/RequirementStudio';
import type { RequirementInput } from '../../types/sartoria';
import { buildDecisionExport, buildDecisionMarkdown } from '../../utils/decisionHandoff';
import { buildLedgerCsv, buildProposalMarkdown } from '../../utils/exporters';
import { matchDecision } from '../decisionMatching';
import { buildDecisionVersion, decisionPresentation } from '../decisionVersion';
import { buildLedgerRecordFromSession } from '../ledgerStore';
import { buildLocalDecisionRequirement } from '../requirementInterview';

function review(rawNarrative: string) {
  const input: RequirementInput = { projectName: '用色复核', clientName: '', rawNarrative,
    businessType: 'private_couture', season: 'all_season', groupSize: '', targetSceneId: '' };
  const requirement = buildLocalDecisionRequirement(input);
  const match = matchDecision(requirement);
  const deconstructed = decisionPresentation(requirement);
  const version = buildDecisionVersion({ projectId: 'color-review', previous: null, requirement, match,
    candidate: match.recommended, revision: null });
  return { input, requirement, match, deconstructed, version };
}

describe('color evidence in the advisor handoff', () => {
  it('shows a specified color that the catalog cannot express without unlocking the match', () => {
    const quote = '颜色就用我发的那张照片里那种蓝色';
    const { input, requirement, match, deconstructed, version } = review(`${quote}。袖长我们到店再聊。`);
    const noop = () => {};
    const page = renderToStaticMarkup(createElement(RequirementStudio, {
      input, decisionRequirement: requirement, deconstructed, status: 'ready', analysisStage: 0, runId: 1,
      engineMode: 'local_rules', workerStatus: null, deconstructError: null,
      onChangeInput: noop, onSelectPresetDemo: noop, onRunDeconstruct: noop,
      onOpenLlmModal: noop, onProceedToConfigurator: noop,
    }));
    expect(page).toContain(`<div class="spec-value">用色要求待核</div>`);
    expect(page).toContain(`依据：「${quote}」`);
    expect(match).toMatchObject({ status: 'no_match', recommended: null, alternative: null });
    expect(buildDecisionExport(version, null).reviews.find(({ field }) => field === 'color')?.nextStep).toContain(quote);
    expect(buildDecisionMarkdown(version, null)).toContain(`待核 · 色系 · 用色要求待核 · brief-1 · 「${quote}」`);
  });

  it('carries an unlisted preference to the proposal, visual brief and ledger without making it a color choice', () => {
    const quote = '颜色上我比较喜欢米色';
    const { input, match, deconstructed, version } = review(`照片上那件酒红色的你看看，腰收得挺舒服，我这回只想要那个腰型。${quote}。`);
    expect(deconstructed.colorSpecifiedByUser).toBe(false);
    expect(match.recommended?.status).toBe('eligible');
    expect(version.promptPack?.colorDisclaimer).toContain(quote);
    expect(version.promptPack?.colorDisclaimer).not.toMatch(/客户未指定颜色|酒红/u);
    expect(version.promptPack?.shots[0].prompts.jimeng_cn).not.toContain('米色');
    expect(buildDecisionMarkdown(version, null)).toContain(`成衣颜色待确认。客户原话「${quote}」`);
    expect(version.proposal).not.toBeNull();
    expect(buildProposalMarkdown(version.proposal!)).toContain(`原话「${quote}」`);
    const record = buildLedgerRecordFromSession({ input, deconstructed, stylePackId: 'shanghai-haipai',
      config: version.candidate?.config ?? null, decisionVersion: version });
    expect(buildLedgerCsv([record])).toContain(`成衣颜色待确认。客户原话「${quote}」`);
  });
});
