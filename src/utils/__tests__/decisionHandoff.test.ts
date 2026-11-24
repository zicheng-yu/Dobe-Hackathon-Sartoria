import { describe, expect, it } from 'vitest';
import { PRESET_DEMO_CASES } from '../../data/presetDemos';
import { matchDecision } from '../../engine/decisionMatching';
import { previewDecisionRevision, recordDecisionRevision } from '../../engine/decisionRevisions';
import { buildDecisionVersion } from '../../engine/decisionVersion';
import { buildLocalDecisionRequirement } from '../../engine/requirementInterview';
import { buildDecisionExport, buildDecisionMarkdown, summarizeConstraintChanges } from '../decisionHandoff';

describe('decisionHandoff formatting and Case 6 V1 -> V2 export audit', () => {
  it('merges same-field replacement + exclusion into one readable diff row and exports complete V2 handoff fields', () => {
    const case6 = PRESET_DEMO_CASES[0];
    const req1 = buildLocalDecisionRequirement(case6.input);
    const match1 = matchDecision(req1);
    const v1 = buildDecisionVersion({
      projectId: 'audit-case-6',
      previous: null,
      requirement: req1,
      match: match1,
      candidate: match1.recommended,
      revision: null,
      now: '2026-11-24T08:00:00.000Z',
    });

    const feedback = '这次不要真丝，换成醋酸，交领和宽松要求都不变。';
    const preview = previewDecisionRevision(v1, feedback);
    expect(preview).not.toBeNull();
    expect(preview!.conflicts).toEqual([]);

    // Preview requestedPatch has 2 fabric entries (neq silk + eq acetate), summarized into 1 crisp row.
    const summarizedPreview = summarizeConstraintChanges(preview!.requestedPatch);
    expect(summarizedPreview).toEqual([
      {
        field: 'fabric',
        before: '真丝',
        after: '醋酸（排除 真丝）',
        quotes: ['这次不要真丝', '换成醋酸'],
      },
    ]);

    const keepBranch = preview!.branches.find((b) => b.option === 'keep');
    expect(keepBranch?.canConfirm).toBe(true);
    const summarizedBranch = summarizeConstraintChanges(keepBranch!.changes);
    expect(summarizedBranch).toEqual([
      {
        field: 'fabric',
        before: '真丝',
        after: '醋酸（排除 真丝）',
        quotes: ['这次不要真丝', '换成醋酸'],
      },
    ]);

    const revision = recordDecisionRevision(preview!, keepBranch!, '2026-11-24T08:05:00.000Z');
    const v2 = buildDecisionVersion({
      projectId: 'audit-case-6',
      previous: v1,
      requirement: keepBranch!.requirement,
      match: keepBranch!.match,
      candidate: keepBranch!.candidate,
      revision,
      now: '2026-11-24T08:05:00.000Z',
    });

    // Verify A (recommended) and B (alternative) on V2 are genuinely distinct underlying combinations.
    expect(v2.match.recommended?.config.fabricId).toBe('fab-official-acetate-jacquard');
    expect(v2.match.alternative?.config.fabricId).toBe('fab-official-acetate-jacquard');
    expect(v2.match.recommended?.id).not.toBe(v2.match.alternative?.id);
    expect(v2.match.recommended?.config.patternId).toBe('pat-official-cross-collar-silk');
    expect(v2.match.alternative?.config.patternId).toBe('pat-official-xiangyun-dropped');

    // Field-by-field audit of JSON handoff contract
    const handoff = buildDecisionExport(v2, v1);
    expect(handoff.schemaVersion).toBe('sartoria_handoff_v1');
    expect(handoff.simulated).toBe(true);
    expect(handoff.previousVersionId).toBe(v1.id);
    expect(handoff.version.number).toBe(2);
    expect(handoff.version.requirement.turns).toHaveLength(2);
    expect(handoff.version.requirement.turns[1].text).toBe(feedback);
    expect(handoff.version.candidate?.config.fabricId).toBe('fab-official-acetate-jacquard');
    expect(handoff.version.candidate?.config.patternId).toBe('pat-official-cross-collar-silk');
    expect(handoff.version.proposal).not.toBeNull();
    expect(handoff.version.promptPack?.shots).toHaveLength(3);
    expect(handoff.versionChanges.filter((c) => c.field === 'fabric')).toHaveLength(2);
    expect(handoff.reviews.length).toBeGreaterThanOrEqual(2);
    expect(handoff.boundaries.length).toBe(3);

    // Field-by-field audit of Markdown handoff document
    const md = buildDecisionMarkdown(v2, v1);
    expect(md).toContain('# 交领开襟真丝暗纹新中式外套 · V2 设计交接');
    expect(md).toContain('- 材质：真丝 → 醋酸（排除 真丝）');
    expect(md).toContain(feedback);
    expect(md).toContain('新中式');
    expect(md).not.toContain('new_chinese');
    expect(md).toContain('pat-official-cross-collar-silk');
    expect(md).toContain('fab-official-acetate-jacquard');
    expect(md).toContain('## 人工接手');
  });
});
