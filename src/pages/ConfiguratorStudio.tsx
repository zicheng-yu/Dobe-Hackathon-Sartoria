import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { StageViewport } from '../components/StageViewport';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { DECISION_CATALOG } from '../data/decisionCatalog';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import { colorReviewText } from '../engine/colorPresentation';
import { evaluateDecisionConfiguration } from '../engine/decisionMatching';
import type { ResolvedStageVisual } from '../engine/visualResolver';
import type { CandidateCombination, DecisionRequirement, MatchResult } from '../types/decisions';
import type {
  ConfigurationState,
  DeconstructedRequirement,
  FeasibilityNotice,
  RequirementInput,
  VisualPromptPack,
} from '../types/sartoria';

interface ConfiguratorStudioProps {
  input: RequirementInput;
  requirement: DecisionRequirement;
  deconstructed: DeconstructedRequirement;
  config: ConfigurationState;
  decisionMatch: MatchResult;
  selectedCandidate: CandidateCombination;
  feasibility: FeasibilityNotice[];
  visual: ResolvedStageVisual;
  promptPack: VisualPromptPack;
  onUpdateConfig: (updater: (prev: ConfigurationState) => ConfigurationState, auditNote?: string) => boolean;
  onApplyCasePreset: (caseId: string) => void;
  onBackToRequirements: () => void;
  onSaveAndOpenProposal: () => void;
}

export function ConfiguratorStudio({
  input,
  requirement,
  deconstructed,
  config,
  decisionMatch,
  selectedCandidate,
  feasibility,
  visual,
  promptPack,
  onUpdateConfig,
  onApplyCasePreset,
  onBackToRequirements,
  onSaveAndOpenProposal,
}: ConfiguratorStudioProps) {
  const [showAllFabrics, setShowAllFabrics] = useState(false);
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [showAllCrafts, setShowAllCrafts] = useState(false);
  const [copiedShot, setCopiedShot] = useState(false);
  const [changeFeedback, setChangeFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const flashFeedback = (accepted: boolean, message: string) => {
    setChangeFeedback(accepted ? message : null);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = accepted ? window.setTimeout(() => setChangeFeedback(null), 1900) : null;
  };

  const selectedPattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const selectedFabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const selectedScene = SCENES.find((s) => s.id === config.sceneId) ?? SCENES[0];
  const selectedCrafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));
  const approvedConfigs = useMemo(
    () => [decisionMatch.recommended, decisionMatch.alternative].flatMap((option) => (option ? [option.config] : [])),
    [decisionMatch]
  );

  // Compute ONLY strictly selectable (eligible) options so no unselectable pill ever appears
  const fabricSelections = useMemo(() => {
    const map = new Map<string, ConfigurationState>();
    const patternMap = new Map(DECISION_CATALOG.patterns.map((entry) => [entry.asset.id, entry]));

    for (const fabricEntry of DECISION_CATALOG.fabrics) {
      const fabId = fabricEntry.asset.id;
      if (fabId === config.fabricId) {
        map.set(fabId, config);
        continue;
      }

      const offered = approvedConfigs.find((option) => option.fabricId === fabId);
      if (offered) {
        const offeredConfig: ConfigurationState = {
          ...config,
          ...offered,
          fabricId: fabId,
          activeView: config.activeView,
          focusedHotspotId: null,
        };
        if (evaluateDecisionConfiguration(requirement, offeredConfig).status === 'eligible') {
          map.set(fabId, offeredConfig);
          continue;
        }
      }

      const directConfig: ConfigurationState = {
        ...config,
        fabricId: fabId,
        activeView: config.activeView,
        focusedHotspotId: null,
      };
      if (evaluateDecisionConfiguration(requirement, directConfig).status === 'eligible') {
        map.set(fabId, directConfig);
        continue;
      }

      let bestConfig: ConfigurationState | null = null;
      let bestScore = -1;
      const candidatePatternIds = [
        config.patternId,
        ...fabricEntry.profile.compatiblePatternIds.filter((pid) => pid !== config.patternId),
      ];

      for (const patId of candidatePatternIds) {
        if (!fabricEntry.profile.compatiblePatternIds.includes(patId)) continue;
        const patEntry = patternMap.get(patId);
        if (!patEntry) continue;
        const sceneCandidates = patEntry.asset.suitableScenes.includes(config.sceneId)
          ? [config.sceneId, ...patEntry.asset.suitableScenes.filter((sid) => sid !== config.sceneId)]
          : [...patEntry.asset.suitableScenes, config.sceneId];

        for (const sceneId of sceneCandidates) {
          for (const craftIds of patEntry.profile.craftPackages) {
            const trial: ConfigurationState = {
              patternId: patId,
              fabricId: fabId,
              craftIds: [...craftIds],
              sceneId,
              activeView: config.activeView,
              focusedHotspotId: null,
            };
            const evaluated = evaluateDecisionConfiguration(requirement, trial);
            if (evaluated.status === 'eligible' && evaluated.ruleScore > bestScore) {
              bestScore = evaluated.ruleScore;
              bestConfig = trial;
            }
          }
        }
      }

      if (bestConfig) {
        map.set(fabId, bestConfig);
      }
    }

    return map;
  }, [approvedConfigs, config, requirement]);

  const patternSelections = useMemo(() => {
    const map = new Map<string, ConfigurationState>();

    for (const patEntry of DECISION_CATALOG.patterns) {
      const patId = patEntry.asset.id;
      if (patId === config.patternId) {
        map.set(patId, config);
        continue;
      }

      const offered = approvedConfigs.find((option) => option.patternId === patId);
      if (offered) {
        const offeredConfig: ConfigurationState = {
          ...config,
          ...offered,
          patternId: patId,
          activeView: config.activeView,
          focusedHotspotId: null,
        };
        if (evaluateDecisionConfiguration(requirement, offeredConfig).status === 'eligible') {
          map.set(patId, offeredConfig);
          continue;
        }
      }

      const preferredSceneId = patEntry.asset.suitableScenes.includes(config.sceneId)
        ? config.sceneId
        : patEntry.asset.suitableScenes[0] ?? config.sceneId;

      const directConfig: ConfigurationState = {
        ...config,
        patternId: patId,
        sceneId: preferredSceneId,
        activeView: config.activeView,
        focusedHotspotId: null,
      };
      if (evaluateDecisionConfiguration(requirement, directConfig).status === 'eligible') {
        map.set(patId, directConfig);
        continue;
      }

      let bestConfig: ConfigurationState | null = null;
      let bestScore = -1;
      const compatibleFabrics = DECISION_CATALOG.fabrics.filter((f) =>
        f.profile.compatiblePatternIds.includes(patId)
      );
      const orderedFabrics = [
        ...compatibleFabrics.filter((f) => f.asset.id === config.fabricId),
        ...compatibleFabrics.filter((f) => f.asset.id !== config.fabricId),
      ];
      const sceneCandidates = patEntry.asset.suitableScenes.includes(config.sceneId)
        ? [config.sceneId, ...patEntry.asset.suitableScenes.filter((sid) => sid !== config.sceneId)]
        : [...patEntry.asset.suitableScenes, config.sceneId];

      for (const fabEntry of orderedFabrics) {
        for (const sceneId of sceneCandidates) {
          for (const craftIds of patEntry.profile.craftPackages) {
            const trial: ConfigurationState = {
              patternId: patId,
              fabricId: fabEntry.asset.id,
              craftIds: [...craftIds],
              sceneId,
              activeView: config.activeView,
              focusedHotspotId: null,
            };
            const evaluated = evaluateDecisionConfiguration(requirement, trial);
            if (evaluated.status === 'eligible' && evaluated.ruleScore > bestScore) {
              bestScore = evaluated.ruleScore;
              bestConfig = trial;
            }
          }
        }
      }

      if (bestConfig) {
        map.set(patId, bestConfig);
      }
    }

    return map;
  }, [approvedConfigs, config, requirement]);

  const eligibleCrafts = useMemo(
    () =>
      DECISION_CATALOG.crafts
        .map(({ asset }) => asset)
        .filter((craft) => {
          if (config.craftIds.includes(craft.id)) return true;
          const trial: ConfigurationState = {
            ...config,
            craftIds: [...config.craftIds, craft.id],
            focusedHotspotId: null,
          };
          return evaluateDecisionConfiguration(requirement, trial).status === 'eligible';
        }),
    [config, requirement]
  );

  const lockedCraftIds = useMemo(() => {
    const locked = new Set<string>();
    for (const craftId of config.craftIds) {
      const trial: ConfigurationState = {
        ...config,
        craftIds: config.craftIds.filter((id) => id !== craftId),
        focusedHotspotId: null,
      };
      if (evaluateDecisionConfiguration(requirement, trial).status !== 'eligible') {
        locked.add(craftId);
      }
    }
    return locked;
  }, [config, requirement]);

  const eligibleFabrics = useMemo(
    () => DECISION_CATALOG.fabrics.map(({ asset }) => asset).filter((fab) => fabricSelections.has(fab.id)),
    [fabricSelections]
  );

  const eligiblePatterns = useMemo(
    () => DECISION_CATALOG.patterns.map(({ asset }) => asset).filter((pat) => patternSelections.has(pat.id)),
    [patternSelections]
  );

  const quickFabricIds = new Set([config.fabricId, ...approvedConfigs.map((option) => option.fabricId)]);
  const quickPatternIds = new Set([config.patternId, ...approvedConfigs.map((option) => option.patternId)]);
  const matchedSceneIds = useMemo(
    () => [...new Set([config.sceneId, ...approvedConfigs.map((option) => option.sceneId)])],
    [approvedConfigs, config.sceneId]
  );

  const orderedScenes = useMemo(
    () =>
      SCENES.filter(
        (scene) =>
          scene.id === config.sceneId ||
          evaluateDecisionConfiguration(requirement, {
            ...config,
            sceneId: scene.id,
            activeView: 'scene_look',
            focusedHotspotId: null,
          }).status === 'eligible'
      ).toSorted(
        (first, second) =>
          Number(matchedSceneIds.includes(second.id)) - Number(matchedSceneIds.includes(first.id))
      ),
    [config, matchedSceneIds, requirement]
  );

  const quickFabrics = eligibleFabrics.filter((fabric) => quickFabricIds.has(fabric.id));
  const hasExtraFabrics = eligibleFabrics.length > 4 && eligibleFabrics.length > quickFabrics.length;
  const visibleFabrics = showAllFabrics || !hasExtraFabrics ? eligibleFabrics : quickFabrics;

  const quickPatterns = eligiblePatterns.filter((pattern) => quickPatternIds.has(pattern.id));
  const hasExtraPatterns = eligiblePatterns.length > 3 && eligiblePatterns.length > quickPatterns.length;
  const visiblePatterns = showAllPatterns || !hasExtraPatterns ? eligiblePatterns : quickPatterns;

  const hasExtraCrafts =
    selectedCrafts.length > 0 && eligibleCrafts.length > 4 && eligibleCrafts.length > selectedCrafts.length;
  const visibleCrafts = showAllCrafts || !hasExtraCrafts ? eligibleCrafts : selectedCrafts;

  const topNotice =
    feasibility.find((f) => f.level === 'risk') ??
    feasibility.find((f) => f.id === 'feas-color-unassigned') ??
    feasibility.find((f) => f.level === 'caution' && f.dimension !== '人工边界') ??
    feasibility[0];

  const totalRefDays =
    selectedPattern.baseLeadDays + selectedCrafts.reduce((sum, c) => sum + c.extraLeadDays, 0);

  const handleSelectFabric = (fab: (typeof FABRICS)[number]) => {
    const target = fabricSelections.get(fab.id);
    if (!target) return;
    const pairedChanged = target.patternId !== config.patternId;
    const accepted = onUpdateConfig(
      (prev) => ({ ...target, activeView: prev.activeView, focusedHotspotId: null }),
      `选配面料：${fab.shortName}`
    );
    flashFeedback(
      accepted,
      pairedChanged ? `已切换面料并匹配兼容版型 · ${fab.shortName}` : `已切换面料 · ${fab.shortName}（${fab.gsm}g/m²）`
    );
  };

  const handleSelectPattern = (pat: (typeof PATTERNS)[number]) => {
    const target = patternSelections.get(pat.id);
    if (!target) return;
    const pairedChanged = target.fabricId !== config.fabricId;
    const accepted = onUpdateConfig(
      (prev) => ({ ...target, activeView: prev.activeView, focusedHotspotId: null }),
      `选配版型：${pat.name}`
    );
    flashFeedback(
      accepted,
      pairedChanged ? `已切换版型并匹配兼容面料 · ${pat.category}` : `已切换版型 · ${pat.category}`
    );
  };

  const handleToggleCraft = (craft: (typeof CRAFTS)[number]) => {
    const exists = config.craftIds.includes(craft.id);
    if (exists && lockedCraftIds.has(craft.id)) {
      flashFeedback(true, `当前需求必选工艺 · ${craft.shortName}`);
      return;
    }
    const accepted = onUpdateConfig((prev) => {
      const has = prev.craftIds.includes(craft.id);
      return {
        ...prev,
        craftIds: has ? prev.craftIds.filter((id) => id !== craft.id) : [...prev.craftIds, craft.id],
      };
    }, `调整工艺：${craft.shortName}`);
    flashFeedback(accepted, exists ? `已移除工艺 · ${craft.shortName}` : `已添加工艺 · ${craft.shortName}`);
  };

  const handleSelectScene = (sceneId: string) => {
    const nextScene = SCENES.find((s) => s.id === sceneId);
    const accepted = onUpdateConfig(
      (prev) => ({ ...prev, sceneId, activeView: 'scene_look', focusedHotspotId: null }),
      `切换场景至「${nextScene?.shortName ?? sceneId}」`
    );
    flashFeedback(accepted, `已切换场景 · ${nextScene?.shortName ?? sceneId}`);
  };

  const handleResetToRecommended = () => {
    const rec = decisionMatch.recommended?.config;
    if (!rec) return;
    const accepted = onUpdateConfig(
      () => ({ ...rec, activeView: config.activeView, focusedHotspotId: null }),
      '恢复按需求推荐的默认搭配'
    );
    flashFeedback(accepted, '已恢复当前需求的推荐搭配');
  };

  const isCustomModified = decisionMatch.recommended && selectedCandidate.id !== decisionMatch.recommended.id;

  const similarCases = HISTORICAL_CASES.filter((hc) => selectedCandidate.referenceCaseIds.includes(hc.id));

  return (
    <div className="configurator-grid">
      {/* Left 65%: Live Interactive Stage */}
      <StageViewport
        pattern={selectedPattern}
        fabric={selectedFabric}
        crafts={selectedCrafts}
        scene={selectedScene}
        scenes={orderedScenes}
        matchedSceneIds={matchedSceneIds}
        config={config}
        ruleScore={selectedCandidate.ruleScore}
        visual={visual}
        changeFeedback={changeFeedback}
        onChangeView={(view) =>
          onUpdateConfig((prev) => ({ ...prev, activeView: view, focusedHotspotId: null }))
        }
        onSelectScene={handleSelectScene}
        onFocusHotspot={(hotspotId) =>
          onUpdateConfig((prev) => ({ ...prev, focusedHotspotId: hotspotId }))
        }
      />

      {/* Right 35%: Requirement-Driven Configurator Rail */}
      <aside className="rail-pane" aria-label="定制选配栏">
        <div className="rail-scroll">
          {/* Step 1 -> Step 2 Requirement Context */}
          <div className="sub-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button type="button" className="btn-text" onClick={onBackToRequirements}>
                <ArrowLeft size={14} />
                <span>返回需求拆解</span>
              </button>
              {isCustomModified && (
                <button type="button" className="btn-text" onClick={handleResetToRecommended}>
                  <Sparkles size={12} />
                  <span>恢复推荐</span>
                </button>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)', marginTop: 6 }}>
              {input.projectName}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
              仅展示符合当前需求的面料、版型与工艺
            </div>
          </div>

          {/* Section 1: Requirement-Matched Fabrics (Labeled Swatch Pills) */}
          <section>
            <div className="rail-section-head">
              <h2 className="rail-h2">适配面料</h2>
              <button
                type="button"
                className="btn-text"
                style={{ fontSize: 12 }}
                onClick={() => {
                  onUpdateConfig((prev) => ({
                    ...prev,
                    activeView: prev.activeView === 'craft_3d' ? 'scene_look' : 'craft_3d',
                    focusedHotspotId: null,
                  }));
                }}
              >
                {config.activeView === 'craft_3d' ? '返回实景' : '查看 3D 织纹'}
              </button>
            </div>

            <div className="fabric-chip-list" role="radiogroup" aria-label="适配面料选择">
              {visibleFabrics.map((fab) => {
                const active = fab.id === config.fabricId;
                const isRec = fab.id === decisionMatch.recommended?.config.fabricId;
                return (
                  <button
                    key={fab.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`fabric-pill ${active ? 'active' : ''}`}
                    onClick={() => handleSelectFabric(fab)}
                  >
                    <span
                      className="fabric-pill-dot"
                      style={{
                        background: `linear-gradient(135deg, ${fab.pbr.baseColor} 0%, ${fab.pbr.accentColor} 65%, ${fab.pbr.sheenColor} 100%)`,
                      }}
                    />
                    <span>{fab.shortName}</span>
                    {isRec && <span className="rec-tag">推荐</span>}
                  </button>
                );
              })}
            </div>

            {hasExtraFabrics && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8, fontSize: 12.5 }}
                onClick={() => setShowAllFabrics((v) => !v)}
              >
                <span>{showAllFabrics ? '收起可选面料' : `展开更多可选面料 (${eligibleFabrics.length - quickFabrics.length})`}</span>
                <ChevronDown
                  size={13}
                  style={{ transform: showAllFabrics ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
                />
              </button>
            )}

            <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginTop: 10 }}>
              {selectedFabric.name} · {selectedFabric.gsm}g/m²
            </div>

            {!deconstructed.colorSpecifiedByUser && (
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
                {colorReviewText(deconstructed) ?? '未指定颜色'}，最终以实物色卡为准
              </div>
            )}

            <details className="disclosure" style={{ marginTop: 10, paddingTop: 10 }}>
              <summary>
                <span>选料依据与成分</span>
                <ChevronDown size={14} />
              </summary>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginTop: 10, lineHeight: 1.65 }}>
                <div>风格：{selectedCandidate.comparison.style}</div>
                <div style={{ marginTop: 4 }}>体感：{selectedCandidate.comparison.comfort}</div>
                <div style={{ marginTop: 4 }}>体型：{selectedCandidate.comparison.fit}</div>
                <div style={{ marginTop: 4 }}>洗护：{selectedCandidate.comparison.care}</div>
                <div style={{ marginTop: 6, color: 'var(--ink-muted)' }}>{selectedFabric.composition}</div>
              </div>
            </details>
          </section>

          {/* Section 2: Requirement-Matched Patterns */}
          <section>
            <div className="rail-section-head">
              <h2 className="rail-h2">适配版型</h2>
              <button
                type="button"
                className="btn-text"
                style={{ fontSize: 12 }}
                onClick={() =>
                  onUpdateConfig((prev) => ({
                    ...prev,
                    activeView: prev.activeView === 'blueprint' ? 'scene_look' : 'blueprint',
                    focusedHotspotId: null,
                  }))
                }
              >
                {config.activeView === 'blueprint' ? '返回实景' : '查看版型图'}
              </button>
            </div>

            <div className="option-stack">
              {visiblePatterns.map((pat) => {
                const isSelected = pat.id === config.patternId;
                const isRecommended = pat.id === decisionMatch.recommended?.config.patternId;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    className={`apple-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectPattern(pat)}
                  >
                    <div>
                      <div className="apple-option-title">
                        <span>{pat.name}</span>
                        {isRecommended && <span className="rec-tag">推荐</span>}
                      </div>
                      <div className="apple-option-sub">{pat.shortSpec}</div>
                    </div>
                    {isSelected && <Check size={15} strokeWidth={2} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {hasExtraPatterns && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8, fontSize: 12.5 }}
                onClick={() => setShowAllPatterns((v) => !v)}
              >
                <span>{showAllPatterns ? '收起可选版型' : `展开更多可选版型 (${eligiblePatterns.length - quickPatterns.length})`}</span>
                <ChevronDown
                  size={13}
                  style={{ transform: showAllPatterns ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
                />
              </button>
            )}
          </section>

          {/* Section 3: Compatible Crafts */}
          <section>
            <div className="rail-section-head">
              <h2 className="rail-h2">适配工艺</h2>
              <span className="rail-meta">已选 {selectedCrafts.length}</span>
            </div>

            <div className="craft-chip-grid">
              {visibleCrafts.map((craft) => {
                const active = config.craftIds.includes(craft.id);
                return (
                  <button
                    key={craft.id}
                    type="button"
                    className={`craft-toggle ${active ? 'active' : ''}`}
                    onClick={() => handleToggleCraft(craft)}
                  >
                    {active && <Check size={12} strokeWidth={2.2} />}
                    <span>{craft.shortName}</span>
                  </button>
                );
              })}
            </div>

            {hasExtraCrafts && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8, fontSize: 12.5 }}
                onClick={() => setShowAllCrafts((v) => !v)}
              >
                <span>{showAllCrafts ? '仅看已选工艺' : `展开更多可选工艺 (${eligibleCrafts.length - selectedCrafts.length})`}</span>
                <ChevronDown
                  size={13}
                  style={{ transform: showAllCrafts ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
                />
              </button>
            )}
          </section>

          {/* Section 4: Progressive Disclosure */}
          <section>
            <details className="disclosure" style={{ marginTop: 0 }}>
              <summary>
                <span>可行性校验与相似案例 ({similarCases.length})</span>
                <ChevronDown size={14} />
              </summary>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {feasibility.map((f) => (
                  <div key={f.id} className="notice-row">
                    <span className={`status-dot dot-${f.level}`} />
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--ink-primary)' }}>{f.title}</div>
                      <div style={{ color: 'var(--ink-secondary)', fontSize: 12, marginTop: 2 }}>{f.detail}</div>
                    </div>
                  </div>
                ))}

                {similarCases.map((hc) => (
                  <div key={hc.id} className="sub-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                        {hc.code}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{hc.title}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => onApplyCasePreset(hc.id)}
                    >
                      复用
                    </button>
                  </div>
                ))}
              </div>
            </details>

            <details className="disclosure">
              <summary>
                <span>实时绘图提示词预览</span>
                <ChevronDown size={14} />
              </summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {promptPack.shots[2].shotTitle}
                  </span>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      navigator.clipboard?.writeText(promptPack.shots[2].prompts.midjourney).catch(() => {});
                      setCopiedShot(true);
                      window.setTimeout(() => setCopiedShot(false), 1600);
                    }}
                  >
                    <Copy size={12} />
                    <span>{copiedShot ? '已复制' : '复制 MJ'}</span>
                  </button>
                </div>
                <div className="prompt-box" style={{ fontSize: 12, maxHeight: 110, overflowY: 'auto' }}>
                  {promptPack.shots[2].prompts.jimeng_cn}
                </div>
              </div>
            </details>
          </section>
        </div>

        {/* Sticky Step 2 -> Step 3 Footer */}
        <div className="rail-footer">
          {topNotice && (
            <div className="notice-row">
              <span className={`status-dot dot-${topNotice.level}`} />
              <span>{topNotice.title}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12.5,
              color: 'var(--ink-muted)',
            }}
          >
            <span>参考周期约 {totalRefDays} 工作日</span>
            <span>规则匹配分 {selectedCandidate.ruleScore}</span>
          </div>

          <button type="button" className="btn-black" style={{ width: '100%' }} onClick={onSaveAndOpenProposal}>
            <span>下一步：生成定制方案</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </aside>
    </div>
  );
}
