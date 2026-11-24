import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { StageViewport } from '../components/StageViewport';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { DECISION_CATALOG } from '../data/decisionCatalog';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type { ResolvedStageVisual } from '../engine/visualResolver';
import type { CandidateCombination, MatchResult } from '../types/decisions';
import type {
  ConfigurationState,
  DeconstructedRequirement,
  FeasibilityNotice,
  RequirementInput,
  VisualPromptPack,
} from '../types/sartoria';

interface ConfiguratorStudioProps {
  input: RequirementInput;
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
  const approvedConfigs = [decisionMatch.recommended, decisionMatch.alternative].flatMap((option) => option ? [option.config] : []);
  const quickFabricIds = new Set([config.fabricId, ...approvedConfigs.map((option) => option.fabricId)]);
  const quickPatternIds = new Set([config.patternId, ...approvedConfigs.map((option) => option.patternId)]);
  const matchedSceneIds = [...new Set([config.sceneId, ...approvedConfigs.map((option) => option.sceneId)])];
  const orderedScenes = SCENES.toSorted((first, second) =>
    Number(matchedSceneIds.includes(second.id)) - Number(matchedSceneIds.includes(first.id)));
  const allFabrics = DECISION_CATALOG.fabrics.map(({ asset }) => asset);
  const allPatterns = DECISION_CATALOG.patterns.map(({ asset }) => asset);
  const allCrafts = DECISION_CATALOG.crafts.map(({ asset }) => asset);
  const visibleFabrics = showAllFabrics ? allFabrics : allFabrics.filter((fabric) => quickFabricIds.has(fabric.id));
  const visiblePatterns = showAllPatterns ? allPatterns : allPatterns.filter((pattern) => quickPatternIds.has(pattern.id));
  const visibleCrafts = showAllCrafts ? allCrafts : selectedCrafts;

  const topNotice =
    feasibility.find((f) => f.level === 'risk') ??
    feasibility.find((f) => f.id === 'feas-color-unassigned') ??
    feasibility.find((f) => f.level === 'caution' && f.dimension !== '人工边界') ??
    feasibility[0];

  const totalRefDays =
    selectedPattern.baseLeadDays + selectedCrafts.reduce((sum, c) => sum + c.extraLeadDays, 0);

  const handleSelectFabric = (fab: (typeof FABRICS)[number]) => {
    const offered = fab.id === config.fabricId ? undefined : approvedConfigs.find((option) => option.fabricId === fab.id);
    const accepted = onUpdateConfig(
      (prev) => ({ ...prev, ...offered, fabricId: fab.id, activeView: prev.activeView, focusedHotspotId: null }),
      `选配面料：${fab.shortName}`
    );
    flashFeedback(accepted, offered ? `已应用配套版型和工艺 · ${fab.shortName}` : `已切换面料 · ${fab.shortName}（${fab.gsm}g/m²）`);
  };

  const handleSelectPattern = (pat: (typeof PATTERNS)[number]) => {
    const offered = pat.id === config.patternId ? undefined : approvedConfigs.find((option) => option.patternId === pat.id);
    const accepted = onUpdateConfig((prev) => {
      const nextSceneId = offered?.sceneId ?? (pat.suitableScenes.includes(prev.sceneId)
        ? prev.sceneId
        : pat.suitableScenes[0] ?? prev.sceneId);
      return { ...prev, ...offered, patternId: pat.id, sceneId: nextSceneId, activeView: prev.activeView, focusedHotspotId: null };
    }, `选配版型：${pat.name}`);
    flashFeedback(accepted, offered ? `已应用配套面料和工艺 · ${pat.category}` : `已切换版型 · ${pat.category}`);
  };

  const handleToggleCraft = (craft: (typeof CRAFTS)[number]) => {
    const exists = config.craftIds.includes(craft.id);
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
              切换候选面料或版型时会一并应用配套组合
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

            {allFabrics.length > quickFabricIds.size && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8, fontSize: 12.5 }}
                onClick={() => setShowAllFabrics((v) => !v)}
              >
                <span>{showAllFabrics ? '仅看候选面料' : `试选更多面料 (${allFabrics.length - quickFabricIds.size})`}</span>
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
                未指定颜色，最终以实物色卡为准
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

            {allPatterns.length > quickPatternIds.size && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8, fontSize: 12.5 }}
                onClick={() => setShowAllPatterns((v) => !v)}
              >
                <span>{showAllPatterns ? '仅看候选版型' : `试选更多版型 (${allPatterns.length - quickPatternIds.size})`}</span>
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

            {allCrafts.length > selectedCrafts.length && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8, fontSize: 12.5 }}
                onClick={() => setShowAllCrafts((v) => !v)}
              >
                <span>{showAllCrafts ? '仅看已选工艺' : `试选更多工艺 (${allCrafts.length - selectedCrafts.length})`}</span>
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
