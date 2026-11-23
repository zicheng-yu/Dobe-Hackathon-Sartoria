import { PRESET_DEMO_CASES } from '../data/presetDemos';
import type {
  AuditLogEntry,
  ConfigurationState,
  DeconstructedRequirement,
  LedgerRecord,
  LedgerReviewStatus,
  RequirementInput,
  StylePackId,
} from '../types/sartoria';
import { deconstructLocally } from './deconstructEngine';
import { evaluateFeasibility, evaluateMatch } from './matchingEngine';
import { generateVisualPromptPack } from './promptEngine';
import { generateProposalDraft } from './proposalEngine';

const STORAGE_KEY = 'sartoria_ai_ledger_v3';

function dedupeAuditLogs(logs: AuditLogEntry[]): AuditLogEntry[] {
  const seen = new Set<string>();
  const out: AuditLogEntry[] = [];
  for (const log of logs) {
    if (!seen.has(log.id)) {
      seen.add(log.id);
      out.push(log);
    }
  }
  return out;
}

export function buildLedgerRecordFromSession(params: {
  id?: string;
  projectCode?: string;
  stylePackId: StylePackId;
  input: RequirementInput;
  deconstructed: DeconstructedRequirement;
  config: ConfigurationState;
  specialistNotes?: string;
  status?: LedgerReviewStatus;
  existingLogs?: AuditLogEntry[];
  actionNote?: string;
  actionDiff?: string;
  createdAt?: string;
}): LedgerRecord {
  const now = new Date().toISOString();
  const match = evaluateMatch(params.input, params.deconstructed, params.config);
  const feasibility = evaluateFeasibility(params.input, params.config, params.deconstructed);
  const proposal = generateProposalDraft(
    params.input,
    params.deconstructed,
    params.config,
    feasibility,
    match
  );
  const promptPack = generateVisualPromptPack(params.input, params.deconstructed, params.config);

  const seedTime = params.createdAt ?? now;
  const baseLogs: AuditLogEntry[] =
    params.existingLogs && params.existingLogs.length > 0
      ? dedupeAuditLogs(params.existingLogs)
      : [
          {
            id: `log-${params.id ?? 'new'}-1`,
            timestamp: seedTime,
            stage: '需求解构',
            action: '完成 8 项专业参数、6 维审美标签与三分栏边界拆解',
            detail: `明确诉求 ${params.deconstructed.threeBuckets.userExplicit.length} 条 · 系统建议 ${params.deconstructed.threeBuckets.systemSuggested.length} 条 · 待人工核实 ${params.deconstructed.threeBuckets.needsHumanVerification.length} 条`,
            actor: 'Sartoria AI 助手',
          },
          {
            id: `log-${params.id ?? 'new'}-2`,
            timestamp: seedTime,
            stage: '资源选配',
            action: '检索版型/面料/工艺/历史案例四类静态模拟资产',
            detail: `综合契合 ${match.overallScore}% · 版型 ${params.config.patternId} · 面料 ${params.config.fabricId} · 相似案例 ${match.similarCaseIds.length} 项`,
            actor: 'Sartoria AI 助手',
          },
          {
            id: `log-${params.id ?? 'new'}-3`,
            timestamp: now,
            stage: '方案初稿',
            action: '输出带资源依据与可行性提示的方案初稿及三镜头视觉需求包',
            detail: `方案编号 ${proposal.id}（AI 参考初稿 · 不做报价/定版/下单）`,
            actor: 'Sartoria AI 助手',
          },
        ];

  const logs = params.actionNote
    ? dedupeAuditLogs([
        ...baseLogs,
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          stage: '人工复核' as const,
          action: params.actionNote,
          detail: `当前状态：${params.status ?? '待业务专员复核'}`,
          diffSummary: params.actionDiff,
          actor: '定制业务专员（人工）' as const,
        },
      ])
    : baseLogs;

  return {
    id: params.id ?? `rec-${Date.now().toString(36)}`,
    projectCode:
      params.projectCode ??
      `SFG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
    projectName: params.input.projectName || '未命名定制企划',
    clientName: params.input.clientName || '待补充客户',
    businessType: params.input.businessType,
    stylePackId: params.stylePackId,
    createdAt: seedTime,
    updatedAt: now,
    status: params.status ?? '待业务专员复核',
    matchScore: match.overallScore,
    matchedCaseIds: match.similarCaseIds,
    requirementInput: params.input,
    deconstructed: params.deconstructed,
    config: params.config,
    proposal,
    promptPack,
    specialistNotes: params.specialistNotes ?? '',
    auditLogs: logs,
  };
}

export function createSeedLedgerRecords(): LedgerRecord[] {
  const seedIds = ['official-case-6', 'official-case-3', 'demo-corporate-haipai-uniform'];
  const selectedDemos = seedIds
    .map((id) => PRESET_DEMO_CASES.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return selectedDemos.map((demo, idx) => {
    const deconstructed = deconstructLocally(demo.input);
    const seedTime = new Date(Date.now() - (3 - idx) * 3600 * 1000 * 5).toISOString();
    return buildLedgerRecordFromSession({
      id: `seed-${demo.id}`,
      projectCode: `SFG-2026-00${idx + 1}`,
      stylePackId: 'shanghai-haipai',
      input: demo.input,
      deconstructed,
      config: demo.recommendedConfig,
      specialistNotes: demo.specialistNoteSeed,
      status: idx === 0 ? '待业务专员复核' : idx === 1 ? 'AI草稿' : '待版师/报价终审',
      createdAt: seedTime,
    });
  });
}

export function loadLedgerRecords(): LedgerRecord[] {
  if (typeof window === 'undefined') {
    return createSeedLedgerRecords();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeds = createSeedLedgerRecords();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    const parsed = JSON.parse(raw) as LedgerRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createSeedLedgerRecords();
  } catch {
    return createSeedLedgerRecords();
  }
}

export function saveLedgerRecords(records: LedgerRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}
