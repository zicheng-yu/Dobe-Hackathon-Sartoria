import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RadarChartSVG } from '../components/RadarChartSVG';
import { RequirementConstraints } from '../components/RequirementConstraints';
import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SCENES } from '../data/scenes';
import { describeRequirementValue } from '../engine/requirementInterview';
import type { Constraint, ConstraintField, DecisionRequirement } from '../types/decisions';
import type {
  DeconstructErrorInfo,
  DeconstructedRequirement,
  EngineMode,
  PresetDemoCase,
  RequirementInput,
  SpecProvenance,
  WorkerLlmStatus,
} from '../types/sartoria';

export type DeconstructStatus = 'idle' | 'analyzing' | 'ready' | 'stale';

interface RequirementStudioProps {
  input: RequirementInput;
  deconstructed: DeconstructedRequirement;
  status: DeconstructStatus;
  analysisStage: number;
  runId: number;
  decisionRequirement?: DecisionRequirement;
  onEditConstraints?: (constraints: Constraint[]) => void;
  onStartNewRequirement?: () => void;
  engineMode: EngineMode;
  workerStatus: WorkerLlmStatus | null;
  deconstructError: DeconstructErrorInfo | null;
  onChangeInput: (next: RequirementInput) => void;
  onSelectPresetDemo: (demo: PresetDemoCase) => void;
  onRunDeconstruct: (forceMode?: EngineMode) => void;
  onOpenLlmModal: () => void;
  onProceedToConfigurator: () => void;
}

const PROVENANCE_META: Record<SpecProvenance, { label: string; dotClass: string }> = {
  user_explicit: { label: '用户明确', dotClass: 'dot-pass' },
  system_suggested: { label: '系统建议', dotClass: 'dot-info' },
  needs_human_verification: { label: '人工核实', dotClass: 'dot-caution' },
};

const SPEC_STATE_META: Record<Constraint['state'], { label: string; dotClass: string }> = {
  explicit: PROVENANCE_META.user_explicit,
  suggested: PROVENANCE_META.system_suggested,
  unknown: { label: '待确认', dotClass: 'dot-caution' },
  confirmed: { label: '人工确认', dotClass: 'dot-pass' },
};

function specText(items: Constraint[]): string {
  return items.map(({ field, value, op }) => `${op === 'neq' ? '排除 · ' : ''}${describeRequirementValue(field, value)}`).join('、');
}

const ANALYSIS_STAGES = [
  '识别品类、体态特征与穿着痛点',
  '转译 8 项专业参数与 6 维审美',
  '整理硬约束、偏好建议与待确认项',
];

export function RequirementStudio({
  input,
  deconstructed,
  status,
  analysisStage,
  runId,
  decisionRequirement,
  onEditConstraints,
  onStartNewRequirement,
  engineMode,
  workerStatus,
  deconstructError,
  onChangeInput,
  onSelectPresetDemo,
  onRunDeconstruct,
  onOpenLlmModal,
  onProceedToConfigurator,
}: RequirementStudioProps) {
  const [outputTab, setOutputTab] = useState<'official8' | 'radar6'>('official8');
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const casePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!caseMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (casePickerRef.current && !casePickerRef.current.contains(event.target as Node)) {
        setCaseMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCaseMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [caseMenuOpen]);

  const activePreset = PRESET_DEMO_CASES.find((demo) => demo.id === input.presetDemoId) ?? null;

  const isAnalyzing = status === 'analyzing';
  const hasResult = status === 'ready' || status === 'stale';
  const isOnlineLlm = deconstructed.engineUsed === 'llm_api';
  const byField = (field: ConstraintField) => decisionRequirement?.constraints.filter((item) => item.field === field) ?? [];
  const dimensions = decisionRequirement ? deconstructed.dimensions.map((dimension) => {
    const fieldsByDimension: Partial<Record<typeof dimension.key, ConstraintField[]>> = {
      silhouetteReq: ['patternStructure', 'easeAllowance'], fabricTexture: ['fabric', 'luster'],
      craftDetail: ['collar', 'motif', 'closure', 'craft'], colorSystem: ['color'], sceneFit: ['scene'],
    };
    const fields = fieldsByDimension[dimension.key];
    if (!fields) return dimension;
    const values = fields.flatMap(byField).filter(({ value }) => value !== null);
    if (values.length) return { ...dimension, value: specText(values) };
    const keepOnlineDimension = isOnlineLlm && (dimension.key !== 'colorSystem' || deconstructed.colorSpecifiedByUser);
    return { ...dimension, value: keepOnlineDimension ? dimension.value : '待确认' };
  }) : deconstructed.dimensions;
  const quota = workerStatus?.quota;

  return (
    <div className="page-wrap">
      <div className="page-head">
        <h1 className="page-h1">需求拆解</h1>
        <button type="button" className="meta-badge" onClick={onOpenLlmModal} style={{ cursor: 'pointer' }}>
          <span
            className={`status-dot ${
              engineMode === 'online_worker' && workerStatus?.configured
                ? quota && (quota.budget.exhausted || quota.visitor.remaining === 0 || quota.site.remaining === 0)
                  ? 'dot-caution'
                  : 'dot-pass'
                : 'dot-info'
            }`}
          />
          <span>
            {engineMode === 'online_worker' && workerStatus?.configured && quota
              ? `GPT-6.2 · 今日剩 ${quota.visitor.remaining}/${quota.visitor.limit}`
              : '本地规则'}
          </span>
        </button>
      </div>

      {/* Clean Single-Row Toolbar: New Brief + Collapsible Reference Case Picker */}
      <div className="case-toolbar" role="group" aria-label="预设案例">
        {onStartNewRequirement && (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: '7px 14px', fontSize: 13 }}
            onClick={() => {
              setCaseMenuOpen(false);
              onStartNewRequirement();
            }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>新建简报</span>
          </button>
        )}

        <div className="case-picker" ref={casePickerRef}>
          <button
            type="button"
            className="case-picker-trigger"
            aria-haspopup="listbox"
            aria-expanded={caseMenuOpen}
            onClick={() => setCaseMenuOpen((open) => !open)}
          >
            <span className="case-picker-label">示例简报</span>
            <span>{activePreset ? activePreset.shortLabel : '选择参考案例'}</span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--ink-muted)',
                transform: caseMenuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 160ms',
              }}
            />
          </button>

          {caseMenuOpen && (
            <div className="case-picker-menu" role="listbox" aria-label="示例简报列表">
              {PRESET_DEMO_CASES.map((demo) => {
                const selected = input.presetDemoId === demo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`case-picker-item ${selected ? 'active' : ''}`}
                    onClick={() => {
                      onSelectPresetDemo(demo);
                      setCaseMenuOpen(false);
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="case-picker-item-title">{demo.shortLabel}</div>
                      <div className="case-picker-item-sub">{demo.title}</div>
                    </div>
                    {selected && <Check size={14} style={{ flexShrink: 0, color: 'var(--ink-primary)' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clear Server Quota / Budget / Error Feedback with 1-Click Offline Fallback */}
      {deconstructError && (
        <div className="notice-row" style={{ marginBottom: 20, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <span
              className={`status-dot ${
                deconstructError.errorCode === 'BUDGET_EXHAUSTED' ? 'dot-risk' : 'dot-caution'
              }`}
            />
            <div>
              <div style={{ fontWeight: 500, color: 'var(--ink-primary)' }}>{deconstructError.message}</div>
              {deconstructError.resetAt && deconstructError.errorCode !== 'BUDGET_EXHAUSTED' && (
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                  重置时间：{deconstructError.resetAt}（Asia/Shanghai）
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn-outline"
            style={{ padding: '6px 14px', fontSize: 12.5 }}
            onClick={() => onRunDeconstruct('local_rules')}
          >
            使用本地规则引擎拆解
          </button>
        </div>
      )}

      <div className="deconstruct-grid">
        {/* Left: Clean Natural Language Input */}
        <section className="surface-card" aria-label="客户需求录入">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>客户需求</h2>

          <textarea
            id="req-narrative"
            aria-label="客户原话"
            className="clean-textarea"
            style={{ minHeight: 176 }}
            value={input.rawNarrative}
            onChange={(e) =>
              onChangeInput({ ...input, rawNarrative: e.target.value, presetDemoId: undefined })
            }
            placeholder="输入客户的口语化定制需求，例如风格、场合、身形特征与穿着体感..."
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: 16,
              gap: 10,
            }}
          >
            <button
              type="button"
              className={status === 'ready' ? 'btn-outline' : 'btn-black'}
              disabled={isAnalyzing || !input.rawNarrative.trim()}
              onClick={() => onRunDeconstruct()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  <span>正在拆解…</span>
                </>
              ) : status === 'ready' ? (
                <>
                  <RefreshCw size={14} />
                  <span>重新拆解</span>
                </>
              ) : status === 'stale' ? (
                <>
                  <Sparkles size={14} />
                  <span>重新拆解需求</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>拆解需求</span>
                </>
              )}
            </button>
          </div>

          <details className="disclosure">
            <summary>
              <span>补充项目与场景信息</span>
              <ChevronDown size={14} />
            </summary>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label
                    htmlFor="req-project-name"
                    style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 5 }}
                  >
                    项目名称
                  </label>
                  <input
                    id="req-project-name"
                    className="clean-input"
                    value={input.projectName}
                    onChange={(e) =>
                      onChangeInput({ ...input, projectName: e.target.value, presetDemoId: undefined })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="req-client-name"
                    style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 5 }}
                  >
                    客户称呼
                  </label>
                  <input
                    id="req-client-name"
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
                  <label
                    htmlFor="req-business-type"
                    style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 5 }}
                  >
                    业务类型
                  </label>
                  <select
                    id="req-business-type"
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
                    <option value="private_couture">个人高定</option>
                    <option value="corporate_uniform">团体职业服</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="req-season"
                    style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 5 }}
                  >
                    主穿季候
                  </label>
                  <select
                    id="req-season"
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
                  <label
                    htmlFor="req-scene"
                    style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 5 }}
                  >
                    穿搭场景
                  </label>
                  <select
                    id="req-scene"
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

        {/* Right: Idle -> Analyzing -> Result */}
        <section aria-label="拆解结果">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="analysis-placeholder"
              >
                <div className="analysis-placeholder-icon">
                  <Sparkles size={18} strokeWidth={1.7} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>等待拆解需求</div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', maxWidth: 340 }}>
                  拆解客户原话，查看硬约束、偏好和需要确认的内容。
                </p>
                <div className="analysis-steps-list">
                  {ANALYSIS_STAGES.map((label, idx) => (
                    <div key={label} className="analysis-step-row">
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: '1px solid var(--border-medium)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {status === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="analysis-placeholder"
                role="status"
                aria-live="polite"
              >
                <div className="analysis-placeholder-icon">
                  <Loader2 size={18} className="spin-icon" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {engineMode === 'online_worker' ? 'GPT-6.2 Astra 解析中…' : '正在拆解需求…'}
                </div>
                <div className="analysis-steps-list">
                  {ANALYSIS_STAGES.map((label, idx) => {
                    const stepNum = idx + 1;
                    const isDone = analysisStage > stepNum;
                    const isActive = analysisStage === stepNum;
                    return (
                      <div
                        key={label}
                        className={`analysis-step-row ${isDone ? 'done' : isActive ? 'active' : ''}`}
                      >
                        {isDone ? (
                          <Check size={15} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                        ) : isActive ? (
                          <Loader2 size={15} className="spin-icon" style={{ flexShrink: 0 }} />
                        ) : (
                          <span
                            style={{
                              width: 15,
                              height: 15,
                              borderRadius: '50%',
                              border: '1px solid var(--border-medium)',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {hasResult && (
              <motion.div
                key={`result-${runId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1] }}
                className="surface-card"
              >
                {status === 'stale' && (
                  <div className="stale-banner">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="status-dot dot-caution" />
                      需求内容已更改，重新拆解以更新结果
                    </span>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => onRunDeconstruct()}
                    >
                      立即更新
                    </button>
                  </div>
                )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="status-dot dot-pass" />
                    <h2 style={{ fontSize: 15, fontWeight: 600 }}>拆解结果</h2>
                    <span className="meta-badge">
                      {deconstructed.engineUsed === 'llm_api'
                        ? deconstructed.modelUsed ?? 'gpt-6.2-astra'
                        : '本地规则引擎'}
                    </span>
                  </div>

                  <div className="segmented segmented-solid" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={outputTab === 'official8'}
                      className={`seg-btn ${outputTab === 'official8' ? 'active' : ''}`}
                      onClick={() => setOutputTab('official8')}
                    >
                      8 项参数
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={outputTab === 'radar6'}
                      className={`seg-btn ${outputTab === 'radar6' ? 'active' : ''}`}
                      onClick={() => setOutputTab('radar6')}
                    >
                      6 维雷达
                    </button>
                  </div>
                </div>

                {outputTab === 'official8' ? (
                  <div className="spec-8-grid">
                    {deconstructed.officialSpecs.map((item) => {
                      const constraints = byField(item.key);
                      const constraint = constraints[0];
                      const prov = constraint ? SPEC_STATE_META[constraint.state] : PROVENANCE_META[item.provenance ?? 'system_suggested'];
                      const hasHardOrUnknown = constraints.some(
                        (c) => c.level === 'hard' || c.state === 'confirmed' || c.state === 'unknown' || c.blocking
                      );
                      const preserveReferenceCopy = decisionRequirement?.input.presetDemoId === 'official-case-6' && constraint?.state === 'suggested';
                      const preserveOnlineCopy = isOnlineLlm && !hasHardOrUnknown && (item.key !== 'color' || deconstructed.colorSpecifiedByUser);
                      const value = decisionRequirement && !preserveReferenceCopy && !preserveOnlineCopy ? specText(constraints) || '待确认' : item.value;
                      return (
                        <div key={item.key} className="spec-cell">
                          <div className="spec-cell-head">
                            <span className="spec-label">{item.label}</span>
                            <span className="meta-badge">
                              <span className={`status-dot ${prov.dotClass}`} />
                              <span>{prov.label}</span>
                            </span>
                          </div>
                          <div className="spec-value">{value}</div>
                          {(!decisionRequirement || preserveOnlineCopy) && item.sourceQuote && (
                            <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                              依据：「{item.sourceQuote}」
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                      <RadarChartSVG dimensions={dimensions} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {deconstructed.aestheticArchetype}
                        </div>
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
                      {dimensions.map((d) => (
                        <div key={d.key} className="spec-cell">
                          <div className="spec-cell-head">
                            <span className="spec-label">{d.label}</span>
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--ink-muted)',
                                fontFamily: 'var(--font-mono)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {d.score}
                            </span>
                          </div>
                          <div className="spec-value" style={{ fontSize: 13 }}>
                            {d.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Revealed after clicking Smart Deconstruct */}
      <AnimatePresence>
        {hasResult && (
          <motion.div
            key={`buckets-${runId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {decisionRequirement ? (
              <RequirementConstraints
                key={runId}
                requirement={decisionRequirement}
                onEdit={status === 'ready' ? onEditConstraints : undefined}
              />
            ) : (
            <section className="surface-card" style={{ marginTop: 20 }} aria-label="信息边界划分">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                  flexWrap: 'wrap',
                }}
              >
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>信息边界划分</h2>
                {!deconstructed.colorSpecifiedByUser && (
                  <span className="meta-badge">
                    <span className="status-dot dot-caution" />
                    <span>未指定色彩 · 待人工核色</span>
                  </span>
                )}
              </div>

              <div className="bucket-3-grid">
                <div className="bucket-col">
                  <div className="bucket-head">
                    <span className="status-dot dot-pass" />
                    <span>用户明确</span>
                    <span className="bucket-count">
                      {deconstructed.threeBuckets.userExplicit.length}
                    </span>
                  </div>
                  <ul className="bucket-list">
                    {deconstructed.threeBuckets.userExplicit.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="bucket-col">
                  <div className="bucket-head">
                    <span className="status-dot dot-info" />
                    <span>系统建议</span>
                    <span className="bucket-count">
                      {deconstructed.threeBuckets.systemSuggested.length}
                    </span>
                  </div>
                  <ul className="bucket-list">
                    {deconstructed.threeBuckets.systemSuggested.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="bucket-col">
                  <div className="bucket-head">
                    <span className="status-dot dot-caution" />
                    <span>人工核实</span>
                    <span className="bucket-count">
                      {deconstructed.threeBuckets.needsHumanVerification.length}
                    </span>
                  </div>
                  <ul className="bucket-list">
                    {deconstructed.threeBuckets.needsHumanVerification.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {!decisionRequirement && deconstructed.followUpQuestions && deconstructed.followUpQuestions.length > 0 && (
                <div className="sub-card" style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>建议追问</div>
                  <ul className="bucket-list">
                    {deconstructed.followUpQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            )}

            {/* Step 1 -> Step 2 Handoff Bar */}
            <div className="flow-handoff-bar">
              <div className="flow-handoff-summary">
                <span className="status-dot dot-pass" />
                <span>按需求约束查看在库版型、面料与工艺组合。</span>
              </div>
              <div className="flow-handoff-actions">
                <button type="button" className="btn-black" disabled={status === 'stale'} onClick={onProceedToConfigurator}>
                  <span>下一步：进入场景选配</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
