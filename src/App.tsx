import { useEffect, useMemo, useState } from 'react';
import { BoundaryModal } from './components/BoundaryModal';
import { LlmConfigModal } from './components/LlmConfigModal';
import { TopNav, type WorkspaceTab } from './components/TopNav';
import { HISTORICAL_CASES } from './data/cases';
import { CRAFTS } from './data/crafts';
import { FABRICS } from './data/fabrics';
import { PATTERNS } from './data/patterns';
import { PRESET_DEMO_CASES } from './data/presetDemos';
import { SCENES } from './data/scenes';
import { deconstructLocally, deconstructRequirement } from './engine/deconstructEngine';
import {
  buildLedgerRecordFromSession,
  loadLedgerRecords,
  saveLedgerRecords,
} from './engine/ledgerStore';
import { evaluateFeasibility, evaluateMatch, recommendInitialConfig } from './engine/matchingEngine';
import { generateVisualPromptPack } from './engine/promptEngine';
import { generateProposalDraft } from './engine/proposalEngine';
import { resolveStageVisual } from './engine/visualResolver';
import { AssetKnowledgeBase } from './pages/AssetKnowledgeBase';
import { BusinessLedger } from './pages/BusinessLedger';
import { ConfiguratorStudio } from './pages/ConfiguratorStudio';
import { ProposalAndPrompts } from './pages/ProposalAndPrompts';
import { RequirementStudio } from './pages/RequirementStudio';
import type {
  AuditLogEntry,
  ConfigurationState,
  DeconstructedRequirement,
  LedgerRecord,
  LedgerReviewStatus,
  LlmSettings,
  PresetDemoCase,
  RequirementInput,
  StylePackId,
} from './types/sartoria';

const LLM_STORAGE_KEY = 'sartoria_ai_llm_settings_v1';

function loadLlmSettings(): LlmSettings {
  try {
    const raw = window.localStorage.getItem(LLM_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LlmSettings;
  } catch {
    // ignore
  }
  return {
    enabled: false,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
  };
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

export default function App() {
  const initialDemo = PRESET_DEMO_CASES[0];

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('requirements');
  const [activeStylePackId, setActiveStylePackId] = useState<StylePackId>('shanghai-haipai');
  const [input, setInput] = useState<RequirementInput>(initialDemo.input);
  const [deconstructed, setDeconstructed] = useState<DeconstructedRequirement>(() =>
    deconstructLocally(initialDemo.input)
  );
  const [config, setConfig] = useState<ConfigurationState>(initialDemo.recommendedConfig);
  const [isDeconstructing, setIsDeconstructing] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<AuditLogEntry[]>(() => [
    {
      id: 'init-log-1',
      timestamp: new Date().toISOString(),
      stage: '需求解构',
      action: `初始化载入「${initialDemo.title}」`,
      detail: '完成 8 项专业参数、6 维审美标签与三分栏边界拆解',
      actor: 'Sartoria AI 助手',
    },
  ]);

  const [ledgerRecords, setLedgerRecords] = useState<LedgerRecord[]>(() => loadLedgerRecords());
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() => loadLlmSettings());
  const [showLlmModal, setShowLlmModal] = useState(false);
  const [showBoundaryModal, setShowBoundaryModal] = useState(false);

  useEffect(() => {
    saveLedgerRecords(ledgerRecords);
  }, [ledgerRecords]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

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

  const match = useMemo(() => evaluateMatch(input, deconstructed, config), [input, deconstructed, config]);
  const feasibility = useMemo(
    () => evaluateFeasibility(input, config, deconstructed),
    [input, config, deconstructed]
  );
  const visual = useMemo(() => resolveStageVisual(config), [config]);
  const proposal = useMemo(
    () => generateProposalDraft(input, deconstructed, config, feasibility, match),
    [input, deconstructed, config, feasibility, match]
  );
  const promptPack = useMemo(
    () => generateVisualPromptPack(input, deconstructed, config),
    [input, deconstructed, config]
  );

  const handleSelectPresetDemo = (demo: PresetDemoCase) => {
    setInput(demo.input);
    const nextDeconstructed = deconstructLocally(demo.input);
    setDeconstructed(nextDeconstructed);
    setConfig(demo.recommendedConfig);
    setSessionLogs([
      {
        id: `slog-preset-${Date.now()}`,
        timestamp: new Date().toISOString(),
        stage: '需求解构',
        action: `载入「${demo.title}」`,
        detail: '完成 8 项专业转译、三类信息分离并匹配默认静态资产',
        actor: 'Sartoria AI 助手',
      },
    ]);
  };

  const handleRunDeconstruct = async () => {
    setIsDeconstructing(true);
    try {
      const nextDeconstructed = await deconstructRequirement(input, llmSettings);
      setDeconstructed(nextDeconstructed);
      const nextConfig = recommendInitialConfig(input, nextDeconstructed);
      const diffSummary = summarizeConfigDiff(config, nextConfig);
      setConfig(nextConfig);
      appendSessionLog(
        '需求解构',
        '执行自然语言需求智能拆解',
        `输出 8 项专业参数与 6 维审美标签（${nextDeconstructed.colorSpecifiedByUser ? '已识别色彩倾向' : '未指定颜色·留待人工核色'}）`,
        'Sartoria AI 助手',
        diffSummary
      );
    } finally {
      setIsDeconstructing(false);
    }
  };

  const handleUpdateConfig = (
    updater: (prev: ConfigurationState) => ConfigurationState,
    auditNote?: string
  ) => {
    setConfig((prev) => {
      const next = updater(prev);
      if (auditNote) {
        const diffSummary = summarizeConfigDiff(prev, next);
        appendSessionLog(
          '资源选配',
          auditNote,
          '已同步更新实景舞台、3D面料、可行性校验与三镜头提示词包',
          '定制业务专员（人工）',
          diffSummary
        );
      }
      return next;
    });
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
    setActiveTab('configurator');
  };

  const upsertCurrentSessionToLedger = () => {
    const existing = ledgerRecords.find((r) => r.projectName === input.projectName);
    const configDiff = existing ? summarizeConfigDiff(existing.config, config) : undefined;
    const nextRec = buildLedgerRecordFromSession({
      id: existing?.id,
      projectCode: existing?.projectCode,
      createdAt: existing?.createdAt,
      stylePackId: activeStylePackId,
      input,
      deconstructed,
      config,
      specialistNotes: existing?.specialistNotes ?? '',
      status: existing?.status ?? '待业务专员复核',
      existingLogs: [...(existing?.auditLogs ?? []), ...sessionLogs].slice(-20),
      actionNote: existing ? '同步更新方案初稿与视觉需求包' : '新建台账并完成首轮方案归档',
      actionDiff: configDiff,
    });

    setLedgerRecords((prev) => {
      const filtered = prev.filter((r) => r.id !== nextRec.id);
      return [nextRec, ...filtered];
    });
  };

  const handleSaveAndOpenProposal = () => {
    appendSessionLog('方案初稿', '生成方案初稿与三镜头视觉需求包', `方案编号 ${proposal.id}`);
    upsertCurrentSessionToLedger();
    setActiveTab('proposal');
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
    setInput(record.requirementInput);
    setDeconstructed(record.deconstructed);
    setConfig(record.config);
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
    setActiveTab('configurator');
  };

  const handleSaveLlmSettings = (next: LlmSettings) => {
    setLlmSettings(next);
    try {
      window.localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <>
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        llmSettings={llmSettings}
        ledgerCount={ledgerRecords.length}
        onOpenLlmModal={() => setShowLlmModal(true)}
        onOpenBoundaryModal={() => setShowBoundaryModal(true)}
      />

      <main className="app-main">
        {activeTab === 'requirements' && (
          <RequirementStudio
            input={input}
            deconstructed={deconstructed}
            isDeconstructing={isDeconstructing}
            onChangeInput={setInput}
            onSelectPresetDemo={handleSelectPresetDemo}
            onRunDeconstruct={handleRunDeconstruct}
            onProceedToConfigurator={() => setActiveTab('configurator')}
          />
        )}

        {activeTab === 'configurator' && (
          <ConfiguratorStudio
            input={input}
            deconstructed={deconstructed}
            config={config}
            match={match}
            feasibility={feasibility}
            visual={visual}
            promptPack={promptPack}
            onUpdateConfig={handleUpdateConfig}
            onApplyCasePreset={handleApplyCasePreset}
            onSaveAndOpenProposal={handleSaveAndOpenProposal}
          />
        )}

        {activeTab === 'proposal' && (
          <ProposalAndPrompts
            proposal={proposal}
            promptPack={promptPack}
            heroPreviewImage={visual.heroImage}
            craftPreviewImage={visual.craftCloseupImage}
            onSaveToLedger={upsertCurrentSessionToLedger}
            onOpenLedger={() => setActiveTab('ledger')}
          />
        )}

        {activeTab === 'knowledge' && (
          <AssetKnowledgeBase
            activeStylePackId={activeStylePackId}
            onChangeStylePack={setActiveStylePackId}
            onTryPatternInStudio={(patternId) => {
              handleUpdateConfig(
                (prev) => ({ ...prev, patternId, activeView: 'blueprint', focusedHotspotId: null }),
                `从资产库载入版型 ${patternId}`
              );
              setActiveTab('configurator');
            }}
            onTryFabricInStudio={(fabricId) => {
              handleUpdateConfig(
                (prev) => ({ ...prev, fabricId, activeView: 'craft_3d', focusedHotspotId: null }),
                `从资产库载入面料 ${fabricId}`
              );
              setActiveTab('configurator');
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
              setActiveTab('configurator');
            }}
            onTryCaseInStudio={handleApplyCasePreset}
          />
        )}

        {activeTab === 'ledger' && (
          <BusinessLedger
            records={ledgerRecords}
            onUpdateRecord={handleUpdateLedgerRecord}
            onLoadRecordIntoStudio={handleLoadRecordIntoStudio}
          />
        )}
      </main>

      <LlmConfigModal
        open={showLlmModal}
        settings={llmSettings}
        onSave={handleSaveLlmSettings}
        onClose={() => setShowLlmModal(false)}
      />

      <BoundaryModal open={showBoundaryModal} onClose={() => setShowBoundaryModal(false)} />
    </>
  );
}
