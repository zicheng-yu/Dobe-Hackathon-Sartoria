import { ArrowRight, CheckCircle2, ChevronDown, HelpCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { RadarChartSVG } from '../components/RadarChartSVG';
import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SCENES } from '../data/scenes';
import type {
  DeconstructedRequirement,
  PresetDemoCase,
  RequirementInput,
  SpecProvenance,
} from '../types/sartoria';

interface RequirementStudioProps {
  input: RequirementInput;
  deconstructed: DeconstructedRequirement;
  isDeconstructing: boolean;
  onChangeInput: (next: RequirementInput) => void;
  onSelectPresetDemo: (demo: PresetDemoCase) => void;
  onRunDeconstruct: () => void;
  onProceedToConfigurator: () => void;
}

const PROVENANCE_META: Record<SpecProvenance, { label: string; className: string }> = {
  user_explicit: { label: '用户明确', className: 'prov-user' },
  system_suggested: { label: '系统建议', className: 'prov-ai' },
  needs_human_verification: { label: '待人工核实', className: 'prov-human' },
};

export function RequirementStudio({
  input,
  deconstructed,
  isDeconstructing,
  onChangeInput,
  onSelectPresetDemo,
  onRunDeconstruct,
  onProceedToConfigurator,
}: RequirementStudioProps) {
  const [outputTab, setOutputTab] = useState<'official8' | 'radar6'>('official8');

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1 className="page-h1">定制需求拆解</h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
            自然语言需求 → 8 项专业转译 + 6 维审美标签 · 严格区分「用户明确 / 系统建议 / 人工核实」
          </div>
        </div>
        <button type="button" className="btn-black" onClick={onProceedToConfigurator}>
          <span>进入场景选配</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Quick Case Selector Pills — Primary Demo Case 6 + Case 3 Two-Piece + Additional Cases */}
      <div className="case-chip-row" role="group" aria-label="快速体验案例">
        {PRESET_DEMO_CASES.map((demo) => (
          <button
            key={demo.id}
            type="button"
            className={`case-pill ${input.presetDemoId === demo.id ? 'active' : ''}`}
            onClick={() => onSelectPresetDemo(demo)}
          >
            {demo.shortLabel}
          </button>
        ))}
      </div>

      <div className="deconstruct-grid">
        {/* Left: Ultra-clean Natural Language Input */}
        <section className="surface-card" aria-label="客户需求录入">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>客户原始需求</h2>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>支持自然语言直接输入</span>
          </div>

          <textarea
            id="req-narrative"
            className="clean-textarea"
            style={{ minHeight: 164, fontSize: 14 }}
            value={input.rawNarrative}
            onChange={(e) =>
              onChangeInput({ ...input, rawNarrative: e.target.value, presetDemoId: undefined })
            }
            placeholder="例如：想要定制一件简约大气的新中式外套，正式一些，身形偏高肩背宽厚，希望不压肩不卡手臂，宽松有质感..."
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              {deconstructed.engineUsed === 'llm_api' ? 'LLM 增强模式' : '本地领域语义实时解析'}
            </span>
            <button
              type="button"
              className="btn-black"
              disabled={isDeconstructing || !input.rawNarrative.trim()}
              onClick={onRunDeconstruct}
            >
              <Sparkles size={14} />
              <span>{isDeconstructing ? '拆解中…' : '智能拆解需求'}</span>
            </button>
          </div>

          {/* Progressive Disclosure: Optional Context & Project Fields */}
          <details className="disclosure">
            <summary>
              <span>补充项目信息与场景（可选）</span>
              <ChevronDown size={14} />
            </summary>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    项目名称
                  </label>
                  <input
                    className="clean-input"
                    value={input.projectName}
                    onChange={(e) =>
                      onChangeInput({ ...input, projectName: e.target.value, presetDemoId: undefined })
                    }
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    客户称呼
                  </label>
                  <input
                    className="clean-input"
                    value={input.clientName}
                    onChange={(e) =>
                      onChangeInput({ ...input, clientName: e.target.value, presetDemoId: undefined })
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    业务类型
                  </label>
                  <select
                    className="clean-select"
                    value={input.businessType}
                    onChange={(e) =>
                      onChangeInput({
                        ...input,
                        businessType: e.target.value as RequirementInput['businessType'],
                        presetDemoId: undefined,
                      })
                    }
                  >
                    <option value="private_couture">个人高级定制</option>
                    <option value="corporate_uniform">团体职业服</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    主穿季候
                  </label>
                  <select
                    className="clean-select"
                    value={input.season}
                    onChange={(e) =>
                      onChangeInput({
                        ...input,
                        season: e.target.value as RequirementInput['season'],
                        presetDemoId: undefined,
                      })
                    }
                  >
                    <option value="spring">春季</option>
                    <option value="summer">夏季</option>
                    <option value="autumn">秋季</option>
                    <option value="winter">冬季</option>
                    <option value="all_season">四季通用</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    穿搭场景
                  </label>
                  <select
                    className="clean-select"
                    value={input.targetSceneId}
                    onChange={(e) => onChangeInput({ ...input, targetSceneId: e.target.value })}
                  >
                    {SCENES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shortName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </details>
        </section>

        {/* Right: Clean Structured Translation Card (Official 8-Spec + 6-Dimension Toggle) */}
        <section className="surface-card" aria-label="专业语言转化结果">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>专业语言转化与六维审美</h2>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                {deconstructed.aestheticArchetype}
              </div>
            </div>

            <div className="segmented segmented-solid" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={outputTab === 'official8'}
                className={`seg-btn ${outputTab === 'official8' ? 'active' : ''}`}
                onClick={() => setOutputTab('official8')}
              >
                8 项专业拆解
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={outputTab === 'radar6'}
                className={`seg-btn ${outputTab === 'radar6' ? 'active' : ''}`}
                onClick={() => setOutputTab('radar6')}
              >
                6 维情绪雷达
              </button>
            </div>
          </div>

          {outputTab === 'official8' ? (
            <>
              <div className="spec-8-grid">
                {deconstructed.officialSpecs.map((item) => {
                  const prov = PROVENANCE_META[item.provenance ?? 'system_suggested'];
                  return (
                    <div key={item.key} className="spec-cell">
                      <div className="spec-cell-head">
                        <span className="spec-label">【{item.label}】</span>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span className={`prov-pill ${prov.className}`}>{prov.label}</span>
                          {item.ergonomicCue && <span className="spec-cue">{item.ergonomicCue}</span>}
                        </div>
                      </div>
                      <div className="spec-value">{item.value}</div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 18,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {deconstructed.emotionTags.slice(0, 4).map((tag) => (
                    <span key={tag} className="tag-minimal">
                      #{tag}
                    </span>
                  ))}
                </div>
                <button type="button" className="btn-outline" onClick={onProceedToConfigurator}>
                  <span>检索四类资产并选配</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <RadarChartSVG dimensions={deconstructed.dimensions} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{deconstructed.aestheticArchetype}</div>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                    {deconstructed.targetAudienceInsight}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {deconstructed.emotionTags.map((tag) => (
                      <span key={tag} className="tag-minimal">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="spec-8-grid">
                {deconstructed.dimensions.map((d) => (
                  <div key={d.key} className="spec-cell">
                    <div className="spec-cell-head">
                      <span className="spec-label">{d.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                        {d.score}
                      </span>
                    </div>
                    <div className="spec-value" style={{ fontSize: 12.5 }}>
                      {d.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Explicit 3-Bucket Epistemic Boundary Separation Panel */}
      <section className="surface-card" style={{ marginTop: 24 }} aria-label="需求归属与人工核实边界">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>三类信息分离（事实 / 建议 / 人工核实）</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
              严格避免 AI 越界替客户拍板：颜色未指定不代客确定，松弛余量不凭空报具体厘米数
            </div>
          </div>
          {!deconstructed.colorSpecifiedByUser && (
            <span className="prov-pill prov-human">客户未指定色彩 · 保留人工核色</span>
          )}
        </div>

        <div className="bucket-3-grid">
          <div className="bucket-col bucket-user">
            <div className="bucket-head">
              <CheckCircle2 size={14} />
              <span>用户明确说的</span>
              <span className="bucket-count">{deconstructed.threeBuckets.userExplicit.length}</span>
            </div>
            <ul className="bucket-list">
              {deconstructed.threeBuckets.userExplicit.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="bucket-col bucket-ai">
            <div className="bucket-head">
              <Sparkles size={14} />
              <span>系统建议的（企划参考）</span>
              <span className="bucket-count">{deconstructed.threeBuckets.systemSuggested.length}</span>
            </div>
            <ul className="bucket-list">
              {deconstructed.threeBuckets.systemSuggested.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="bucket-col bucket-human">
            <div className="bucket-head">
              <HelpCircle size={14} />
              <span>还要人工核实的（不可越界）</span>
              <span className="bucket-count">{deconstructed.threeBuckets.needsHumanVerification.length}</span>
            </div>
            <ul className="bucket-list">
              {deconstructed.threeBuckets.needsHumanVerification.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
