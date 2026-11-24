import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CandidateComparison, RevisionWorkspace } from './components/DecisionPanels';
import { LlmConfigModal } from './components/LlmConfigModal';
import {
  TopNav,
  type CompletedSteps,
  type FlowStepTab,
  type WorkspaceTab,
} from './components/TopNav';
import { HISTORICAL_CASES } from './data/cases';
import { CRAFTS } from './data/crafts';
import { FABRICS } from './data/fabrics';
import { PATTERNS } from './data/patterns';
import { PRESET_DEMO_CASES } from './data/presetDemos';
import { SCENES } from './data/scenes';
import { deconstructRequirement, fetchWorkerLlmStatus } from './engine/deconstructEngine';
import { applyOnlineRequirementReview } from './engine/onlineRequirementReview';
import { evaluateDecisionConfiguration, matchDecision } from './engine/decisionMatching';
import {
  appendDecisionVersion,
  emptyDecisionHistory,
  findConstraintChanges,
  previewDecisionRevision,
  recordDecisionRevision,
  refreshDecisionRequirement,
  type RevisionPreview,
} from './engine/decisionRevisions';
import { buildDecisionVersion, decisionInput, decisionPresentation } from './engine/decisionVersion';
import {
  buildLedgerRecordFromSession,
  loadLedgerRecords,
  saveLedgerRecords,
} from './engine/ledgerStore';
import { evaluateFeasibility } from './engine/matchingEngine';
import { buildClarificationQuestions, buildLocalDecisionRequirement } from './engine/requirementInterview';
import { resolveStageVisual } from './engine/visualResolver';
import { AssetKnowledgeBase } from './pages/AssetKnowledgeBase';
import { BusinessLedger } from './pages/BusinessLedger';
import { ConfiguratorStudio } from './pages/ConfiguratorStudio';
import { LandingHome } from './pages/LandingHome';
import { OnlineDocsPage } from './pages/OnlineDocsPage';
import { ProposalAndPrompts } from './pages/ProposalAndPrompts';
import { RequirementStudio, type DeconstructStatus } from './pages/RequirementStudio';
import { VideoShowcase } from './pages/VideoShowcase';
import type { CandidateCombination, Constraint, DecisionRequirement, Revision, RevisionOption, Version } from './types/decisions';
import type {
  AuditLogEntry,
  ConfigurationState,
  DeconstructErrorInfo,
  DeconstructedRequirement,
  EngineMode,
  LedgerRecord,
  LedgerReviewStatus,
  PresetDemoCase,
  RequirementInput,
  StylePackId,
  WorkerLlmStatus,
} from './types/sartoria';
import { buildPathname, parsePathname, type AppRoute, type PortalSection } from './utils/router';

const LEGACY_LLM_KEY = 'sartoria_ai_llm_settings_v1';
const ENGINE_MODE_KEY = 'sartoria_ai_engine_mode_v2';
const ACTIVE_PROJECT_KEY = 'sartoria_active_decision_project_v1';

function loadActiveProject(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function loadSavedEngineMode(): EngineMode | null {
  try {
    window.localStorage.removeItem(LEGACY_LLM_KEY);
    const value = window.localStorage.getItem(ENGINE_MODE_KEY);
    if (value === 'online_worker' || value === 'local_rules') return value;
  } catch {
    // Use local rules when browser storage is unavailable.
  }
  return null;
}

function summarizeConfigDiff(prev: ConfigurationState, next: ConfigurationState): string | undefined {
  const diffs: string[] = [];
  if (prev.patternId !== next.patternId) {
    const p1 = PATTERNS.find((p) => p.id === prev.patternId)?.code ?? prev.patternId;
    const p2 = PATTERNS.find((p) => p.id === next.patternId)?.code ?? next.patternId;
    diffs.push(`版型：${p1} → ${p2}`);
  }
  if (prev.fabricId !== next.fabricId) {
    const f1 = FABRICS.find((f) => f.id === prev.fabricId)?.shortName ?? prev.fabricId;
    const f2 = FABRICS.find((f) => f.id === next.fabricId)?.shortName ?? next.fabricId;
    diffs.push(`面料：${f1} → ${f2}`);
  }
  if (prev.sceneId !== next.sceneId) {
    const s1 = SCENES.find((s) => s.id === prev.sceneId)?.shortName ?? prev.sceneId;
    const s2 = SCENES.find((s) => s.id === next.sceneId)?.shortName ?? next.sceneId;
    diffs.push(`场景：${s1} → ${s2}`);
  }
  const prevC = [...prev.craftIds].sort().join(',');
  const nextC = [...next.craftIds].sort().join(',');
  if (prevC !== nextC) {
    const added = next.craftIds.filter((id) => !prev.craftIds.includes(id));
    const removed = prev.craftIds.filter((id) => !next.craftIds.includes(id));
    if (added.length > 0) {
      const names = added.map((id) => CRAFTS.find((c) => c.id === id)?.shortName ?? id).join('、');
      diffs.push(`新增工艺：${names}`);
    }
    if (removed.length > 0) {
      const names = removed.map((id) => CRAFTS.find((c) => c.id === id)?.shortName ?? id).join('、');
      diffs.push(`移除工艺：${names}`);
    }
  }
  return diffs.length > 0 ? diffs.join('；') : undefined;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function App() {
  const initialDemo = PRESET_DEMO_CASES[0];
  const [ledgerRecords, setLedgerRecords] = useState<LedgerRecord[]>(() => loadLedgerRecords());
  const [initialRecord] = useState(() => {
    const id = loadActiveProject();
    return ledgerRecords.find((record) => record.id === id);
  });
  const initialVersion = initialRecord?.decisionHistory?.versions.at(-1);
  const [projectId, setProjectId] = useState(() => initialRecord?.id ?? crypto.randomUUID());

  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined'
      ? parsePathname(window.location.pathname)
      : { section: 'home', demoTab: 'requirements' }
  );

  const startedBeyondStep1 = Boolean(initialVersion) ||
    route.section === 'demo' &&
    (route.demoTab === 'configurator' || route.demoTab === 'proposal' || route.demoTab === 'ledger');

  const [lastFlowTab, setLastFlowTab] = useState<FlowStepTab>('requirements');
  const [activeStylePackId, setActiveStylePackId] = useState<StylePackId>(initialRecord?.stylePackId ?? 'shanghai-haipai');
  const [input, setInput] = useState<RequirementInput>(initialVersion?.requirement.input ?? initialDemo.input);
  const [requirement, setRequirement] = useState<DecisionRequirement>(() =>
    initialVersion?.requirement ?? buildLocalDecisionRequirement(input));
  const [deconstructed, setDeconstructed] = useState<DeconstructedRequirement>(() => decisionPresentation(requirement));
  const [deconstructStatus, setDeconstructStatus] = useState<DeconstructStatus>(
    startedBeyondStep1 ? 'ready' : 'idle'
  );
  const [analysisStage, setAnalysisStage] = useState<number>(0);
  const [deconstructRunId, setDeconstructRunId] = useState<number>(0);
  const [deconstructError, setDeconstructError] = useState<DeconstructErrorInfo | null>(null);

  const [config, setConfig] = useState<ConfigurationState>(() =>
    initialVersion?.candidate?.config ?? matchDecision(requirement).recommended?.config ?? initialDemo.recommendedConfig);
  const [completedSteps, setCompletedSteps] = useState<CompletedSteps>({
    requirements: startedBeyondStep1,
    configurator: route.section === 'demo' && (route.demoTab === 'proposal' || route.demoTab === 'ledger'),
    proposal: route.section === 'demo' && route.demoTab === 'ledger',
    ledger: Boolean(initialVersion),
  });

  const [sessionLogs, setSessionLogs] = useState<AuditLogEntry[]>([]);
  const [lastArchivedRecordId, setLastArchivedRecordId] = useState<string | null>(initialRecord?.id ?? null);
  const [revisionPreview, setRevisionPreview] = useState<RevisionPreview | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const [initialEngineMode] = useState(loadSavedEngineMode);
  const savedModeRef = useRef(initialEngineMode);
  const [engineMode, setEngineMode] = useState<EngineMode>(initialEngineMode ?? 'local_rules');
  const [workerStatus, setWorkerStatus] = useState<WorkerLlmStatus | null>(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [showLlmModal, setShowLlmModal] = useState(false);

  const deconstructTokenRef = useRef(0);
  const confirmedPreviewRef = useRef<string | null>(null);

  const activeSection = route.section;
  const activeTab = route.demoTab;
  const currentRecord = ledgerRecords.find((record) => record.id === projectId);
  const history = currentRecord?.decisionHistory ?? emptyDecisionHistory();
  const latestVersion = history.versions.at(-1) ?? null;

  const runLocalInterview = useCallback((
    nextInput: RequirementInput, previous?: DecisionRequirement, presentation?: DeconstructedRequirement,
  ) => {
    const result = applyOnlineRequirementReview(refreshDecisionRequirement(nextInput, previous), presentation);
    const candidate = matchDecision(result).recommended;
    setRequirement(result);
    setDeconstructed(decisionPresentation(result, presentation));
    if (candidate) setConfig(candidate.config);
    setRevisionPreview(null);
    setDecisionNotice(null);
    setDeconstructStatus('ready');
    setDeconstructRunId((n) => n + 1);
    setCompletedSteps((prev) => ({ ...prev, requirements: true }));
    return result;
  }, []);

  const refreshWorkerStatus = useCallback(async () => {
    setIsRefreshingStatus(true);
    try {
      setWorkerStatus(await fetchWorkerLlmStatus());
    } finally {
      setIsRefreshingStatus(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchWorkerLlmStatus().then((status) => {
      if (!active) return;
      setWorkerStatus(status);
      if (!savedModeRef.current && status?.configured && !status.quota.budget.exhausted &&
          status.quota.visitor.remaining > 0 && status.quota.site.remaining > 0) {
        setEngineMode('online_worker');
      }
    });
    return () => { active = false; };
  }, []);

  const handleChangeEngineMode = (mode: EngineMode) => {
    savedModeRef.current = mode;
    setEngineMode(mode);
    setDeconstructError(null);
    try {
      window.localStorage.setItem(ENGINE_MODE_KEY, mode);
    } catch {
      // The selected mode still applies to this session.
    }
  };

  const handleOpenLlmSettings = () => {
    setShowLlmModal(true);
    void refreshWorkerStatus();
  };

  const syncIfNeededBeforeLeavingStep1 = useCallback(
    (targetTab: WorkspaceTab) => {
      if (
        (targetTab === 'configurator' || targetTab === 'proposal') &&
        (deconstructStatus === 'idle' || deconstructStatus === 'stale') && input.rawNarrative.trim()
      ) {
        runLocalInterview(input, requirement);
      }
    },
    [deconstructStatus, input, requirement, runLocalInterview]
  );

  const navigate = useCallback(
    (section: PortalSection, demoTab?: WorkspaceTab, prepareInterview = true) => {
      const resolvedTab = demoTab ?? route.demoTab;
      if (section === 'demo') {
        if (resolvedTab !== 'knowledge') setLastFlowTab(resolvedTab);
        if (prepareInterview) syncIfNeededBeforeLeavingStep1(resolvedTab);
        if (resolvedTab === 'proposal') {
          setCompletedSteps((prev) => ({ ...prev, requirements: true, configurator: true }));
        } else if (resolvedTab === 'ledger') {
          setCompletedSteps((prev) => ({ ...prev, requirements: true, configurator: true, proposal: true }));
        }
      }
      const next = { section, demoTab: resolvedTab };
      if (typeof window !== 'undefined') {
        const nextPath = buildPathname(next);
        if (window.location.pathname !== nextPath) {
          window.history.pushState(null, '', nextPath);
        }
      }
      setRoute(next);
    },
    [route.demoTab, syncIfNeededBeforeLeavingStep1]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.toLowerCase() === '/vedio') {
      window.history.replaceState(null, '', '/video');
    }
    const handlePop = () => {
      setRoute(parsePathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    saveLedgerRecords(ledgerRecords);
  }, [ledgerRecords]);

  useEffect(() => {
    try {
      if (latestVersion) window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
      else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } catch {
      // The session can still be used when storage is disabled.
    }
  }, [latestVersion, projectId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeSection, activeTab]);

  const appendSessionLog = (
    stage: AuditLogEntry['stage'],
    action: string,
    detail: string,
    actor: AuditLogEntry['actor'] = 'Sartoria AI 助手',
    diffSummary?: string
  ) => {
    setSessionLogs((prev) => [
      ...prev.slice(-18),
      {
        id: `slog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        stage,
        action,
        detail,
        diffSummary,
        actor,
      },
    ]);
  };

  const decisionMatch = useMemo(() => matchDecision(requirement), [requirement]);
  const selectedCandidate = useMemo(() => {
    if (deconstructStatus !== 'ready' || decisionMatch.status === 'no_match') return null;
    const candidate = evaluateDecisionConfiguration(requirement, config);
    return candidate.status === 'eligible' ? candidate : null;
  }, [config, decisionMatch.status, deconstructStatus, requirement]);
  const effectiveInput = useMemo(() => decisionInput(requirement, selectedCandidate), [requirement, selectedCandidate]);
  const feasibility = useMemo(
    () => evaluateFeasibility(effectiveInput, config, deconstructed),
    [effectiveInput, config, deconstructed]
  );
  const visual = useMemo(() => resolveStageVisual(config), [config]);
  const draftVersion = useMemo(() => {
    if (deconstructStatus !== 'ready' || (!selectedCandidate && decisionMatch.status !== 'no_match')) return null;
    if (latestVersion && latestVersion.candidate?.id === selectedCandidate?.id &&
        JSON.stringify(latestVersion.requirement) === JSON.stringify(requirement)) {
      return latestVersion;
    }
    const revision: Revision | null = latestVersion ? {
      id: `${latestVersion.id}:manual`, baseVersionId: latestVersion.id,
      turn: { id: `${latestVersion.id}:manual`, text: '定制业务专员在工作台确认并保存了手工调整。' },
      requestedPatch: findConstraintChanges(latestVersion.requirement.constraints, requirement.constraints),
      impacts: [{ area: 'requirements', detail: '按当前约束和已选组合生成对应的方案和三镜头提示词。' }],
      selectedOption: 'accept', humanDecision: 'confirmed', savedAt: deconstructed.timestamp,
    } : null;
    return buildDecisionVersion({
      projectId, previous: latestVersion, requirement, match: decisionMatch,
      candidate: selectedCandidate, revision, now: deconstructed.timestamp,
    });
  }, [decisionMatch, deconstructed.timestamp, deconstructStatus, latestVersion, projectId, requirement, selectedCandidate]);

  const handleChangeInput = (next: RequirementInput) => {
    setInput(next);
    setDeconstructError(null);
    if (deconstructStatus === 'ready' || deconstructStatus === 'analyzing') {
      deconstructTokenRef.current += 1;
      setDeconstructStatus('stale');
      setAnalysisStage(0);
      setCompletedSteps((prev) => ({ ...prev, requirements: false, configurator: false, proposal: false, ledger: false }));
    }
  };

  const resetProject = (brief: RequirementInput) => {
    deconstructTokenRef.current += 1;
    setProjectId(crypto.randomUUID());
    setInput(brief);
    setRequirement(buildLocalDecisionRequirement(brief));
    setDeconstructStatus('idle');
    setDeconstructError(null);
    setAnalysisStage(0);
    setCompletedSteps({
      requirements: false,
      configurator: false,
      proposal: false,
      ledger: false,
    });
    setLastArchivedRecordId(null);
    setSessionLogs([]);
    setRevisionPreview(null);
    setDecisionNotice(null);
  };

  const handleSelectPresetDemo = (demo: PresetDemoCase) => resetProject(demo.input);

  const handleLaunchPresetById = (presetId: string) => {
    const demo = PRESET_DEMO_CASES.find((d) => d.id === presetId);
    if (demo) {
      handleSelectPresetDemo(demo);
    }
    navigate('demo', 'requirements');
  };

  const handleRunDeconstruct = async (forceMode?: EngineMode) => {
    if (!input.rawNarrative.trim()) return;
    if (forceMode) handleChangeEngineMode(forceMode);
    const token = ++deconstructTokenRef.current;

    setDeconstructError(null);
    setDeconstructStatus('analyzing');
    setAnalysisStage(1);

    const enginePromise = deconstructRequirement(input, forceMode ?? engineMode);

    await waitMs(220);
    if (deconstructTokenRef.current !== token) return;
    setAnalysisStage(2);

    await waitMs(240);
    if (deconstructTokenRef.current !== token) return;
    setAnalysisStage(3);

    const [outcome] = await Promise.all([enginePromise, waitMs(240)]);
    if (deconstructTokenRef.current !== token) return;
    const quota = outcome.quota;
    if (quota) setWorkerStatus((prev) => prev ? { ...prev, quota }
      : { configured: true, model: quota.model, reasoningEffort: 'low', schemaVersion: 'sartoria_requirement_v1', quota });
    if (!outcome.ok) {
      setDeconstructError(outcome.error);
      setDeconstructStatus(deconstructRunId > 0 ? 'stale' : 'idle');
      setAnalysisStage(0);
      return;
    }
    const next = runLocalInterview(input, requirement, outcome.data);

    appendSessionLog(
      '需求解构',
      outcome.data.engineUsed === 'llm_api'
        ? '在线智能引擎拆解并完成目录约束整理'
        : '完成需求访谈与目录约束整理',
      `记录 ${next.constraints.filter((constraint) => constraint.level === 'hard').length} 条硬条件，附八项定制信息与六维审美摘要。`
    );

  };

  const handleEditConstraints = (constraints: Constraint[]) => {
    const next = applyOnlineRequirementReview({ ...requirement, constraints, questions: buildClarificationQuestions(constraints) });
    const candidate = matchDecision(next).recommended;
    setRequirement(next);
    setDeconstructed(
      decisionPresentation(next, deconstructed.engineUsed === 'llm_api' ? deconstructed : undefined)
    );
    if (candidate) setConfig(candidate.config);
    setRevisionPreview(null);
    setDecisionNotice(null);
    setCompletedSteps((prev) => ({ ...prev, configurator: false, proposal: false, ledger: false }));
  };

  const handleUpdateConfig = (
    updater: (prev: ConfigurationState) => ConfigurationState,
    auditNote?: string
  ): boolean => {
    if (!input.rawNarrative.trim() || deconstructStatus === 'analyzing') return false;
    const current = deconstructStatus === 'ready' ? requirement : runLocalInterview(input, requirement);
    const base = deconstructStatus === 'ready' ? config : matchDecision(current).recommended?.config ?? config;
    const next = updater(base);
    const candidate = evaluateDecisionConfiguration(current, next);
    if (candidate.status !== 'eligible') {
      setDecisionNotice(`该组合暂不能选用。${candidate.decisionReasons.join('；')}`);
      return false;
    }
    setConfig(next);
    setDecisionNotice(null);
    const diff = summarizeConfigDiff(base, next);
    if (diff) {
      setRevisionPreview(null);
      setCompletedSteps((prev) => ({ ...prev, proposal: false, ledger: false }));
      if (auditNote) appendSessionLog('资源选配', auditNote, '已按当前硬条件核对选配。', '定制业务专员（人工）', diff);
    }
    return true;
  };

  const handleApplyCasePreset = (caseId: string) => {
    const hc = HISTORICAL_CASES.find((c) => c.id === caseId);
    if (!hc) return;
    handleUpdateConfig(
      (prev) => ({
        ...prev,
        patternId: hc.patternId,
        fabricId: hc.fabricId,
        craftIds: [...hc.craftIds],
        sceneId: hc.sceneId,
        focusedHotspotId: null,
      }),
      `复用历史案例「${hc.code}」`
    );
    navigate('demo', 'configurator', false);
  };

  const saveVersionToLedger = (version: Version) => {
    const { candidate } = version;
    const latestInput = decisionInput(version.requirement, candidate);
    const latestPresentation = decisionPresentation(version.requirement);
    const existing = currentRecord;
    const nextRec = buildLedgerRecordFromSession({
      id: version.projectId,
      projectCode: existing?.projectCode,
      createdAt: existing?.createdAt,
      stylePackId: activeStylePackId,
      input: latestInput,
      deconstructed: latestPresentation,
      config: candidate?.config ?? null,
      decisionVersion: version,
      specialistNotes: existing?.specialistNotes ?? '',
      status: existing?.status ?? '待业务专员复核',
      existingLogs: [...(existing?.auditLogs ?? []), ...sessionLogs].slice(-20),
      actionNote: candidate ? `保存决策 V${version.number} 和交接快照` : `保存待核决策 V${version.number}`,
      actionDiff: existing?.config && candidate ? summarizeConfigDiff(existing.config, candidate.config) : undefined,
    });
    setLedgerRecords((prev) => {
      const stored = prev.find((record) => record.id === version.projectId)?.decisionHistory ?? emptyDecisionHistory();
      const decisionHistory = appendDecisionVersion(stored, version);
      if (decisionHistory === stored) return prev;
      return [{ ...nextRec, decisionHistory },
        ...prev.filter((record) => record.id !== version.projectId)];
    });
    setLastArchivedRecordId(nextRec.id);
    setSessionLogs([]);
    setCompletedSteps((prev) => ({
      ...prev,
      requirements: true,
      configurator: true,
      proposal: Boolean(version.proposal),
      ledger: true,
    }));
  };

  const upsertCurrentSessionToLedger = () => {
    if (!draftVersion) return;
    if (draftVersion.id === latestVersion?.id) {
      setLastArchivedRecordId(projectId);
      return;
    }
    saveVersionToLedger(draftVersion);
  };

  const handleSaveAndOpenProposal = () => {
    if (!draftVersion?.proposal) return;
    appendSessionLog('方案初稿', '生成方案初稿与三镜头视觉需求包', `方案编号 ${draftVersion.id}`);
    setCompletedSteps((prev) => ({ ...prev, requirements: true, configurator: true }));
    navigate('demo', 'proposal');
  };

  const handleArchiveAndOpenLedger = () => {
    if (!draftVersion) return;
    upsertCurrentSessionToLedger();
    navigate('demo', 'ledger');
  };

  const handleChangeFeedback = (feedbackDraft: string) => {
    setRevisionPreview(null);
    setLedgerRecords((prev) => prev.map((record) => record.id === projectId && record.decisionHistory
      ? { ...record, decisionHistory: { ...record.decisionHistory, feedbackDraft } } : record));
  };

  const handleConfirmFeedback = (option: RevisionOption) => {
    if (!latestVersion || !revisionPreview || revisionPreview.baseVersionId !== latestVersion.id ||
        confirmedPreviewRef.current === revisionPreview.id || draftVersion?.id !== latestVersion.id) return;
    const branch = revisionPreview.branches.find((item) => item.option === option);
    if (!branch?.canConfirm) return;
    confirmedPreviewRef.current = revisionPreview.id;
    setRevisionPreview(null);
    const revision = recordDecisionRevision(revisionPreview, branch, new Date().toISOString());
    if (option === 'defer') {
      setLedgerRecords((prev) => prev.map((record) => record.id === projectId && record.decisionHistory
        ? { ...record, decisionHistory: {
          ...record.decisionHistory, rejectedRevisions: [...record.decisionHistory.rejectedRevisions, revision],
        } } : record));
      setDecisionNotice('已记录本次挂起，原版本和反馈草稿均可继续使用。');
      return;
    }
    const updated = buildDecisionVersion({
      projectId, previous: latestVersion, requirement: branch.requirement,
      match: branch.match, candidate: branch.candidate, revision,
    });
    setRequirement(branch.requirement);
    setInput(branch.requirement.input);
    setDeconstructed(decisionPresentation(branch.requirement));
    if (branch.candidate) setConfig(branch.candidate.config);
    setDecisionNotice(branch.candidate
      ? `已确认并保存 V${updated.number}。可在台账中对比和导出。`
      : `已保存待核 V${updated.number}。当前无合格组合，可在台账中导出复核依据。`);
    saveVersionToLedger(updated);
  };

  const handleUpdateLedgerRecord = (
    id: string,
    patch: {
      projectName?: string;
      clientName?: string;
      status?: LedgerReviewStatus;
      specialistNotes?: string;
    },
    auditAction: string,
    diffSummary?: string
  ) => {
    setLedgerRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== id) return rec;
        const now = new Date().toISOString();
        return {
          ...rec,
          ...patch,
          updatedAt: now,
          auditLogs: [
            ...rec.auditLogs,
            {
              id: `log-h-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              timestamp: now,
              stage: '人工复核',
              action: auditAction,
              detail: `当前状态：${patch.status ?? rec.status}`,
              diffSummary,
              actor: '定制业务专员（人工）',
            },
          ],
        };
      })
    );
  };

  const handleLoadRecordIntoStudio = (record: LedgerRecord) => {
    deconstructTokenRef.current += 1;
    const savedVersion = record.decisionHistory?.versions.at(-1);
    const next = savedVersion?.requirement ?? buildLocalDecisionRequirement(record.requirementInput);
    const storedConfig = savedVersion?.candidate?.config ?? record.config;
    const candidate = storedConfig ? evaluateDecisionConfiguration(next, storedConfig) : null;
    const selected = candidate?.status === 'eligible' ? storedConfig : matchDecision(next).recommended?.config;
    setProjectId(record.id);
    setActiveStylePackId(record.stylePackId);
    setInput(next.input);
    setRequirement(next);
    setDeconstructed(decisionPresentation(next));
    if (selected) setConfig(selected);
    setLastArchivedRecordId(record.id);
    setRevisionPreview(null);
    setDecisionNotice(null);
    setDeconstructStatus('ready');
    setDeconstructError(null);
    setDeconstructRunId((n) => n + 1);
    setCompletedSteps({
      requirements: true,
      configurator: false,
      proposal: false,
      ledger: false,
    });
    setSessionLogs([
      {
        id: `slog-reload-${Date.now()}`,
        timestamp: new Date().toISOString(),
        stage: '资源选配',
        action: `从台账回载项目「${record.projectCode}」`,
        detail: '继续调整静态模拟资源并同步追踪变更轨迹',
        actor: '定制业务专员（人工）',
      },
    ]);
    navigate('demo', 'configurator', false);
  };

  const handleStartNewRequirement = () => {
    resetProject({
      projectName: '', clientName: '', businessType: 'corporate_uniform', season: 'all_season',
      groupSize: '', targetSceneId: 'scene-lujiazui-summit', rawNarrative: '',
    });
    navigate('demo', 'requirements');
  };

  return (
    <>
      <TopNav
        activeSection={activeSection}
        activeTab={activeTab}
        completedSteps={completedSteps}
        onNavigate={navigate}
        engineMode={engineMode}
        workerStatus={workerStatus}
        ledgerCount={ledgerRecords.length}
        onOpenLlmModal={handleOpenLlmSettings}
      />

      <main className="app-main">
        {activeSection === 'demo' && decisionNotice && (
          <div className="page-wrap"><p className="decision-alert" role="status">{decisionNotice}</p></div>
        )}
        {activeSection === 'home' && (
          <LandingHome
            onNavigate={navigate}
            onLaunchPresetDemo={handleLaunchPresetById}
          />
        )}

        {activeSection === 'video' && <VideoShowcase onNavigate={navigate} />}

        {activeSection === 'docs' && <OnlineDocsPage onNavigate={navigate} />}

        {activeSection === 'demo' && activeTab === 'requirements' && (
          <RequirementStudio
            input={input}
            deconstructed={deconstructed}
            status={deconstructStatus}
            analysisStage={analysisStage}
            runId={deconstructRunId}
            engineMode={engineMode}
            workerStatus={workerStatus}
            deconstructError={deconstructError}
            decisionRequirement={deconstructStatus === 'ready' ? requirement : undefined}
            onChangeInput={handleChangeInput}
            onEditConstraints={handleEditConstraints}
            onStartNewRequirement={handleStartNewRequirement}
            onSelectPresetDemo={handleSelectPresetDemo}
            onRunDeconstruct={(mode) => { void handleRunDeconstruct(mode); }}
            onOpenLlmModal={handleOpenLlmSettings}
            onProceedToConfigurator={() => navigate('demo', 'configurator')}
          />
        )}

        {activeSection === 'demo' && activeTab === 'configurator' && deconstructStatus === 'ready' && (
          <div className="page-wrap">
            <CandidateComparison
              result={decisionMatch}
              selected={selectedCandidate}
              onSelectCandidate={(candidate: CandidateCombination) => handleUpdateConfig(() => candidate.config, '选择对比组合')}
            />
            {draftVersion && (
              <RevisionWorkspace
                version={latestVersion?.id === draftVersion?.id ? latestVersion : null}
                feedbackDraft={history.feedbackDraft}
                preview={revisionPreview}
                onSaveBase={upsertCurrentSessionToLedger}
                onChangeDraft={handleChangeFeedback}
                onPreview={() => latestVersion && setRevisionPreview(previewDecisionRevision(latestVersion, history.feedbackDraft))}
                onCancelPreview={() => setRevisionPreview(null)}
                onConfirm={handleConfirmFeedback}
                canSaveBase
                pendingBase={!draftVersion.candidate}
              />
            )}
          </div>
        )}

        {activeSection === 'demo' && activeTab === 'configurator' && selectedCandidate && draftVersion?.promptPack && (
          <ConfiguratorStudio
            input={effectiveInput}
            deconstructed={deconstructed}
            config={config}
            decisionMatch={decisionMatch}
            selectedCandidate={selectedCandidate}
            feasibility={feasibility}
            visual={visual}
            promptPack={draftVersion.promptPack}
            onUpdateConfig={handleUpdateConfig}
            onApplyCasePreset={handleApplyCasePreset}
            onBackToRequirements={() => navigate('demo', 'requirements')}
            onSaveAndOpenProposal={handleSaveAndOpenProposal}
          />
        )}

        {activeSection === 'demo' && activeTab === 'proposal' && draftVersion?.proposal && draftVersion.promptPack && (
          <ProposalAndPrompts
            proposal={draftVersion.proposal}
            promptPack={draftVersion.promptPack}
            heroPreviewImage={visual.heroImage}
            craftPreviewImage={visual.craftCloseupImage}
            isArchived={completedSteps.ledger}
            onBackToConfigurator={() => navigate('demo', 'configurator')}
            onSaveToLedger={upsertCurrentSessionToLedger}
            onArchiveAndOpenLedger={handleArchiveAndOpenLedger}
          />
        )}

        {activeSection === 'demo' && (
          (activeTab === 'configurator' && deconstructStatus !== 'ready') ||
          (activeTab === 'proposal' && !draftVersion?.proposal)
        ) && (
          <div className="page-wrap">
            <h1 className="page-h1">{deconstructStatus === 'ready' ? '暂无可交接方案' : '先完成需求访谈'}</h1>
            <p>{deconstructStatus === 'ready' ? '当前硬条件在目录中暂无合格组合。请回到选配查看待核与拒绝依据。' : '输入简报并核对来源，再进入选配。'}</p>
            <button type="button" className="btn-outline" onClick={() => navigate('demo', deconstructStatus === 'ready' ? 'configurator' : 'requirements')}>
              {deconstructStatus === 'ready' ? '查看选配依据' : '返回需求访谈'}
            </button>
            {draftVersion && <button type="button" className="btn-black" onClick={handleArchiveAndOpenLedger}>保存待核档案</button>}
          </div>
        )}

        {activeSection === 'demo' && activeTab === 'knowledge' && (
          <AssetKnowledgeBase
            activeStylePackId={activeStylePackId}
            onChangeStylePack={setActiveStylePackId}
            onBackToFlow={() => navigate('demo', lastFlowTab)}
            onTryPatternInStudio={(patternId) => {
              handleUpdateConfig(
                (prev) => ({ ...prev, patternId, activeView: 'blueprint', focusedHotspotId: null }),
                `从资产库载入版型 ${patternId}`
              );
              navigate('demo', 'configurator', false);
            }}
            onTryFabricInStudio={(fabricId) => {
              handleUpdateConfig(
                (prev) => ({ ...prev, fabricId, activeView: 'craft_3d', focusedHotspotId: null }),
                `从资产库载入面料 ${fabricId}`
              );
              navigate('demo', 'configurator', false);
            }}
            onTryCraftInStudio={(craftId) => {
              handleUpdateConfig(
                (prev) => ({
                  ...prev,
                  craftIds: prev.craftIds.includes(craftId)
                    ? prev.craftIds
                    : [...prev.craftIds, craftId],
                  focusedHotspotId: null,
                }),
                `从资产库叠加细节 ${craftId}`
              );
              navigate('demo', 'configurator', false);
            }}
            onTryCaseInStudio={handleApplyCasePreset}
          />
        )}

        {activeSection === 'demo' && activeTab === 'ledger' && (
          <BusinessLedger
            records={ledgerRecords}
            highlightedRecordId={lastArchivedRecordId}
            onUpdateRecord={handleUpdateLedgerRecord}
            onLoadRecordIntoStudio={handleLoadRecordIntoStudio}
            onStartNewRequirement={handleStartNewRequirement}
          />
        )}
      </main>

      <LlmConfigModal
        open={showLlmModal}
        engineMode={engineMode}
        workerStatus={workerStatus}
        isRefreshing={isRefreshingStatus}
        onChangeMode={handleChangeEngineMode}
        onRefreshStatus={() => { void refreshWorkerStatus(); }}
        onClose={() => setShowLlmModal(false)}
      />
    </>
  );
}
