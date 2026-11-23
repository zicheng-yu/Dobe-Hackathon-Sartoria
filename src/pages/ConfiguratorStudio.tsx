import { ArrowRight, Check, ChevronDown, Copy } from 'lucide-react';
import { useState } from 'react';
import { StageViewport } from '../components/StageViewport';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type { ResolvedStageVisual } from '../engine/visualResolver';
import type {
  ConfigurationState,
  DeconstructedRequirement,
  FeasibilityNotice,
  MatchExplanation,
  RequirementInput,
  VisualPromptPack,
} from '../types/sartoria';

interface ConfiguratorStudioProps {
  input: RequirementInput;
  deconstructed: DeconstructedRequirement;
  config: ConfigurationState;
  match: MatchExplanation;
  feasibility: FeasibilityNotice[];
  visual: ResolvedStageVisual;
  promptPack: VisualPromptPack;
  onUpdateConfig: (updater: (prev: ConfigurationState) => ConfigurationState, auditNote?: string) => void;
  onApplyCasePreset: (caseId: string) => void;
  onSaveAndOpenProposal: () => void;
}

export function ConfiguratorStudio({
  deconstructed,
  config,
  match,
  feasibility,
  visual,
  promptPack,
  onUpdateConfig,
  onApplyCasePreset,
  onSaveAndOpenProposal,
}: ConfiguratorStudioProps) {
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [copiedShot, setCopiedShot] = useState(false);

  const selectedPattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const selectedFabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const selectedScene = SCENES.find((s) => s.id === config.sceneId) ?? SCENES[0];
  const selectedCrafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));

  // Keep selected pattern always visible at top of the compact Apple list
  const orderedPatterns = [
    selectedPattern,
    ...PATTERNS.filter((p) => p.id !== selectedPattern.id),
  ];
  const visiblePatterns = showAllPatterns ? orderedPatterns : orderedPatterns.slice(0, 4);

  const topNotice =
    feasibility.find((f) => f.level === 'risk') ??
    feasibility.find((f) => f.id === 'feas-color-unassigned') ??
    feasibility.find((f) => f.level === 'caution' && f.dimension !== '人工边界') ??
    feasibility[0];

  const totalRefDays =
    selectedPattern.baseLeadDays + selectedCrafts.reduce((sum, c) => sum + c.extraLeadDays, 0);

  const handleToggleCraft = (craftId: string, craftName: string) => {
    onUpdateConfig((prev) => {
      const exists = prev.craftIds.includes(craftId);
      return {
        ...prev,
        craftIds: exists ? prev.craftIds.filter((id) => id !== craftId) : [...prev.craftIds, craftId],
      };
    }, `调整工艺：${craftName}`);
  };

  return (
    <div className="configurator-grid">
      {/* Left 65%: Porsche / Apple Sticky Visual Stage */}
      <StageViewport
        pattern={selectedPattern}
        fabric={selectedFabric}
        crafts={selectedCrafts}
        scene={selectedScene}
        config={config}
        match={match}
        visual={visual}
        onChangeView={(view) =>
          onUpdateConfig((prev) => ({ ...prev, activeView: view, focusedHotspotId: null }))
        }
        onSelectScene={(sceneId) => {
          const nextScene = SCENES.find((s) => s.id === sceneId);
          onUpdateConfig(
            (prev) => ({ ...prev, sceneId, focusedHotspotId: null }),
            `切换场景至「${nextScene?.shortName ?? sceneId}」`
          );
        }}
        onFocusHotspot={(hotspotId) =>
          onUpdateConfig((prev) => ({ ...prev, focusedHotspotId: hotspotId }))
        }
      />

      {/* Right 35%: Apple Buy / Porsche Minimal Vertical Configurator Rail */}
      <aside className="rail-pane" aria-label="定制选配栏">
        <div className="rail-scroll">
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-muted)',
              background: 'var(--bg-canvas)',
              padding: '8px 11px',
              borderRadius: 10,
              lineHeight: 1.5,
            }}
          >
            <strong>静态模拟定制资产库</strong> · 检索版型 / 面料 / 工艺 / 历史案例四类资产（非真实生产 API）
          </div>

          {/* Section 1: Circular Tactile Fabric Swatch Selector (Apple Finish Picker Feel) */}
          <section>
            <div className="rail-section-head">
              <h2 className="rail-h2">面料与质感（模拟资产）</h2>
              <span className="rail-meta">
                {selectedFabric.code} · {selectedFabric.shortName}
              </span>
            </div>

            <div className="swatch-circles" role="radiogroup" aria-label="面料色卡">
              {FABRICS.map((fab) => {
                const active = fab.id === config.fabricId;
                return (
                  <button
                    key={fab.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`swatch-circle-btn ${active ? 'active' : ''}`}
                    title={`${fab.code} ${fab.name} · ${fab.gsm}g/m²`}
                    onClick={() =>
                      onUpdateConfig(
                        (prev) => ({ ...prev, fabricId: fab.id, focusedHotspotId: null }),
                        `选配面料：${fab.shortName}`
                      )
                    }
                  >
                    <span
                      className="swatch-fill"
                      style={{
                        background: `linear-gradient(135deg, ${fab.pbr.baseColor} 0%, ${fab.pbr.accentColor} 62%, ${fab.pbr.sheenColor} 100%)`,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
              {selectedFabric.name} · 参考 {selectedFabric.gsm}g/m² · {selectedFabric.drape}
            </div>

            {!deconstructed.colorSpecifiedByUser && (
              <div className="feas-bar feas-caution" style={{ marginTop: 8 }}>
                <span className="status-dot dot-caution" />
                <span>客户未指定颜色：色卡仅作织纹质感示意，不代客定色，最终须携实物米样线下核色。</span>
              </div>
            )}

            <details className="disclosure" style={{ marginTop: 8, paddingTop: 8 }}>
              <summary>
                <span>选料三维判断依据与护理说明</span>
                <ChevronDown size={14} />
              </summary>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8, lineHeight: 1.6 }}>
                <div>
                  <strong>风格适配：</strong>
                  {match.fabricRationale.styleFit}
                </div>
                <div style={{ marginTop: 3 }}>
                  <strong>体感适配：</strong>
                  {match.fabricRationale.comfortFit}
                </div>
                <div style={{ marginTop: 3 }}>
                  <strong>体型适配：</strong>
                  {match.fabricRationale.bodyFit}
                </div>
                <div style={{ marginTop: 6 }}>成分：{selectedFabric.composition}</div>
              </div>
            </details>
          </section>

          {/* Section 2: Pattern & Collar Architecture (Apple Stacked Cards) */}
          <section>
            <div className="rail-section-head">
              <h2 className="rail-h2">版型与领型</h2>
              <span className="rail-meta">{selectedPattern.code}</span>
            </div>

            <div className="option-stack">
              {visiblePatterns.map((pat) => {
                const isSelected = pat.id === config.patternId;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    className={`apple-option ${isSelected ? 'selected' : ''}`}
                    onClick={() =>
                      onUpdateConfig(
                        (prev) => ({ ...prev, patternId: pat.id, focusedHotspotId: null }),
                        `选配版型：${pat.name}`
                      )
                    }
                  >
                    <div>
                      <div className="apple-option-title">{pat.name}</div>
                      <div className="apple-option-sub">{pat.shortSpec}</div>
                    </div>
                    {isSelected && <Check size={15} strokeWidth={2} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {PATTERNS.length > 4 && (
              <button
                type="button"
                className="btn-text"
                style={{ marginTop: 8 }}
                onClick={() => setShowAllPatterns((v) => !v)}
              >
                <span>{showAllPatterns ? '收起更多版型' : `展开全部版型 (${PATTERNS.length})`}</span>
                <ChevronDown
                  size={14}
                  style={{ transform: showAllPatterns ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
                />
              </button>
            )}
          </section>

          {/* Section 3: Minimal Craft Details Toggle Chips */}
          <section>
            <div className="rail-section-head">
              <h2 className="rail-h2">工艺与结构细节</h2>
              <span className="rail-meta">已选 {selectedCrafts.length} 项</span>
            </div>

            <div className="craft-chip-grid">
              {CRAFTS.map((craft) => {
                const active = config.craftIds.includes(craft.id);
                return (
                  <button
                    key={craft.id}
                    type="button"
                    className={`craft-toggle ${active ? 'active' : ''}`}
                    onClick={() => handleToggleCraft(craft.id, craft.shortName)}
                  >
                    {active && <Check size={12} strokeWidth={2.2} />}
                    <span>{craft.shortName}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 4: Default-Open Resource Match, Guardrails & Historical Cases */}
          <section>
            <details className="disclosure" style={{ marginTop: 0 }} open>
              <summary>
                <span>四类资产检索依据、可行性提示与相似案例</span>
                <ChevronDown size={14} />
              </summary>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {feasibility.map((f) => (
                  <div key={f.id} className={`feas-bar feas-${f.level}`}>
                    <span className={`status-dot dot-${f.level}`} />
                    <div>
                      <strong>{f.title}</strong>
                      <div style={{ opacity: 0.85, fontSize: 11.5 }}>{f.detail}</div>
                    </div>
                  </div>
                ))}

                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                  检索到的相似历史案例（模拟静态库）
                </div>
                {HISTORICAL_CASES.filter((hc) => match.similarCaseIds.includes(hc.id)).map((hc) => (
                  <div
                    key={hc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--bg-canvas)',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                        {hc.code}
                      </div>
                      <div>{hc.title}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: '4px 10px', fontSize: 11.5 }}
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
                <span>实时 AI 绘图提示词预览（不调用出图 API）</span>
                <ChevronDown size={14} />
              </summary>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
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
                <div className="prompt-box" style={{ fontSize: 11.5, maxHeight: 110, overflowY: 'auto' }}>
                  {promptPack.shots[2].prompts.jimeng_cn}
                </div>
              </div>
            </details>
          </section>
        </div>

        {/* Sticky Apple-Style Summary Footer */}
        <div className="rail-footer">
          {topNotice && (
            <div className={`feas-bar feas-${topNotice.level}`}>
              <span className={`status-dot dot-${topNotice.level}`} />
              <span>{topNotice.title}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--ink-muted)',
            }}
          >
            <span>参考周期约 {totalRefDays} 工作日 · 静态草稿</span>
            <span>不做报价 / CAD定版 / 下单</span>
          </div>

          <button type="button" className="btn-black" style={{ width: '100%' }} onClick={onSaveAndOpenProposal}>
            <span>生成方案初稿与视觉需求包</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </aside>
    </div>
  );
}
