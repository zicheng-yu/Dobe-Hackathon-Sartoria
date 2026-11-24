import { PRESET_DEMO_CASES } from '../data/presetDemos';
import type { Version } from '../types/decisions';
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

const STORAGE_KEY = 'sartoria_ai_ledger_v4';

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
  config: ConfigurationState | null;
  decisionVersion?: Version;
  specialistNotes?: string;
  status?: LedgerReviewStatus;
  existingLogs?: AuditLogEntry[];
  actionNote?: string;
  actionDiff?: string;
  createdAt?: string;
}): LedgerRecord {
  const now = new Date().toISOString();
  const { config, decisionVersion, deconstructed, input } = params;
  const legacyMatch = config && !decisionVersion ? evaluateMatch(input, deconstructed, config) : null;
  const proposal = config && legacyMatch
    ? generateProposalDraft(input, deconstructed, config, evaluateFeasibility(input, config, deconstructed), legacyMatch)
    : decisionVersion?.proposal ?? null;
  const promptPack = config && !decisionVersion ? generateVisualPromptPack(input, deconstructed, config)
    : decisionVersion?.promptPack ?? null;
  const score = decisionVersion?.candidate?.ruleScore ?? legacyMatch?.overallScore ?? 0;
  const caseIds = decisionVersion?.candidate?.referenceCaseIds ?? legacyMatch?.similarCaseIds ?? [];

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
            detail: config
              ? `${decisionVersion ? '规则匹配分' : '综合契合'} ${score} · 版型 ${config.patternId} · 面料 ${config.fabricId} · 相似案例 ${caseIds.length} 项`
              : '暂无通过硬筛的组合，保留约束和目录核查记录。',
            actor: 'Sartoria AI 助手',
          },
          {
            id: `log-${params.id ?? 'new'}-3`,
            timestamp: now,
            stage: '方案初稿',
            action: proposal ? '输出带资源依据与可行性提示的方案初稿及三镜头视觉需求包' : '记录待核决策',
            detail: proposal ? `方案编号 ${proposal.id}（AI 参考初稿 · 不做报价/定版/下单）` : '等待业务顾问复核需求和可用资产。',
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
    matchScore: score,
    matchedCaseIds: caseIds,
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

const LEGACY_SEED_CLIENT_NAMES: Record<string, string> = {
  '正式场合私定客户（身形偏高、肩背宽厚）': '陈先生',
  '舞台演奏艺术家（户外演出、抬手坐奏）': '苏女士 · 演奏家',
  '正式场合定制客户（短颈、微有肚腩）': '周先生',
  '正式社交定制客户（需叠穿内搭、显脖细）': '沈女士',
  '私享定制客户（短颈、轻微溜肩、小肚腩）': '许先生',
  '浦江国际资管集团（60 人高管及涉外礼宾团队）': '浦江国际资管',
  '林女士（外滩艺术基金联合创始人）': '林女士 · 外滩艺术基金',
};

function mapLegacyClientName(name: string): string {
  return LEGACY_SEED_CLIENT_NAMES[name] ?? name;
}

function normalizeLegacySeedClientName(record: LedgerRecord): LedgerRecord {
  const nextClientName = mapLegacyClientName(record.clientName);
  const nextInputClientName = mapLegacyClientName(record.requirementInput.clientName);
  const nextProposalClientName = record.proposal ? mapLegacyClientName(record.proposal.clientName) : null;
  const hasLegacyVersion = record.decisionHistory?.versions.some(
    (v) =>
      v.requirement.input.clientName in LEGACY_SEED_CLIENT_NAMES ||
      (v.proposal ? v.proposal.clientName in LEGACY_SEED_CLIENT_NAMES : false)
  );
  if (
    nextClientName === record.clientName &&
    nextInputClientName === record.requirementInput.clientName &&
    (!record.proposal || nextProposalClientName === record.proposal.clientName) &&
    !hasLegacyVersion
  ) {
    return record;
  }
  return {
    ...record,
    clientName: nextClientName,
    requirementInput: {
      ...record.requirementInput,
      clientName: nextInputClientName,
    },
    proposal: record.proposal
      ? {
          ...record.proposal,
          clientName: nextProposalClientName ?? record.proposal.clientName,
        }
      : null,
    decisionHistory: record.decisionHistory
      ? {
          ...record.decisionHistory,
          versions: record.decisionHistory.versions.map((v) => ({
            ...v,
            requirement: {
              ...v.requirement,
              input: {
                ...v.requirement.input,
                clientName: mapLegacyClientName(v.requirement.input.clientName),
              },
            },
            proposal: v.proposal
              ? {
                  ...v.proposal,
                  clientName: mapLegacyClientName(v.proposal.clientName),
                }
              : null,
          })),
        }
      : undefined,
  };
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
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map(normalizeLegacySeedClientName)
      : createSeedLedgerRecords();
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
