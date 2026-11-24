import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Printer,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ProposalDraft,
  PromptToolFormat,
  SpecProvenance,
  VisualPromptPack,
} from '../types/sartoria';
import {
  buildPromptPackMarkdown,
  buildProposalMarkdown,
  downloadTextFile,
} from '../utils/exporters';

interface ProposalAndPromptsProps {
  proposal: ProposalDraft;
  promptPack: VisualPromptPack;
  heroPreviewImage: string;
  craftPreviewImage: string;
  isArchived: boolean;
  onBackToConfigurator: () => void;
  onSaveToLedger: () => void;
  onArchiveAndOpenLedger: () => void;
}

const FORMAT_LABELS: Record<PromptToolFormat, string> = {
  jimeng_cn: '中文描述',
  midjourney: 'Midjourney',
  flux_sd: 'Flux',
};

const PROVENANCE_LABEL: Record<SpecProvenance, { label: string; dotClass: string }> = {
  user_explicit: { label: '用户明确', dotClass: 'dot-pass' },
  system_suggested: { label: '系统建议', dotClass: 'dot-info' },
  needs_human_verification: { label: '人工核实', dotClass: 'dot-caution' },
};

export function ProposalAndPrompts({
  proposal,
  promptPack,
  heroPreviewImage,
  craftPreviewImage,
  isArchived,
  onBackToConfigurator,
  onSaveToLedger,
  onArchiveAndOpenLedger,
}: ProposalAndPromptsProps) {
  const [toolFormat, setToolFormat] = useState<PromptToolFormat>('jimeng_cn');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="page-wrap">
      <div className="page-head no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h1 className="page-h1">定制方案</h1>
          <button type="button" className="btn-text" onClick={onBackToConfigurator}>
            <ArrowLeft size={14} />
            <span>返回调整选配</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                `${proposal.projectName}-定制方案初稿.md`,
                buildProposalMarkdown(proposal),
                'text/markdown;charset=utf-8'
              )
            }
          >
            <FileText size={14} />
            <span>导出方案</span>
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={14} />
            <span>打印</span>
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              onSaveToLedger();
              setSavedToast(true);
              window.setTimeout(() => setSavedToast(false), 1800);
            }}
          >
            <Archive size={14} />
            <span>{savedToast ? '已暂存' : '暂存档案'}</span>
          </button>
        </div>
      </div>

      <div className="proposal-grid">
        {/* Left: Unified Editorial Proposal Sheet */}
        <article className="dossier-sheet" aria-label="定制方案初稿">
          <div className="dossier-top">
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600 }}>
                {proposal.projectName}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>
                {proposal.clientName}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr',
              gap: 10,
              marginBottom: 24,
            }}
          >
            <img
              src={heroPreviewImage}
              alt="方案场景意向"
              style={{ width: '100%', height: 184, objectFit: 'cover', borderRadius: 10 }}
            />
            <img
              src={craftPreviewImage}
              alt="工艺细节意向"
              style={{ width: '100%', height: 184, objectFit: 'cover', borderRadius: 10 }}
            />
          </div>

          {/* Unified 3-Bucket Separation */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">需求来源拆分</h3>
            <div className="bucket-3-grid">
              <div className="bucket-col">
                <div className="bucket-head">
                  <span className="status-dot dot-pass" />
                  <span>用户明确</span>
                </div>
                <ul className="bucket-list">
                  {proposal.threeBuckets.userExplicit.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bucket-col">
                <div className="bucket-head">
                  <span className="status-dot dot-info" />
                  <span>系统建议</span>
                </div>
                <ul className="bucket-list">
                  {proposal.threeBuckets.systemSuggested.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bucket-col">
                <div className="bucket-head">
                  <span className="status-dot dot-caution" />
                  <span>人工核实</span>
                </div>
                <ul className="bucket-list">
                  {proposal.threeBuckets.needsHumanVerification.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Unified 8-Spec Soft Cards */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">8 项定制参数</h3>
            <div className="spec-8-grid">
              {proposal.officialSpecs.map((spec) => {
                const prov = PROVENANCE_LABEL[spec.provenance ?? 'system_suggested'];
                return (
                  <div key={spec.key} className="spec-cell">
                    <div className="spec-cell-head">
                      <span className="spec-label">{spec.label}</span>
                      <span className="meta-badge">
                        <span className={`status-dot ${prov.dotClass}`} />
                        <span>{prov.label}</span>
                      </span>
                    </div>
                    <span className="spec-value" style={{ fontSize: 13 }}>
                      {spec.value}
                    </span>
                    {spec.key === 'color' && spec.sourceQuote && (
                      <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>客户原话「{spec.sourceQuote}」</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Unified Asset Match Basis + 3-Dimension Rationale */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">搭配依据</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
              {proposal.resourceBasis.map((res) => (
                <div key={`${res.assetType}-${res.code}`} className="sub-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ fontSize: 13.5, fontWeight: 510 }}>
                      {res.assetType} · {res.name}
                    </strong>
                  </div>
                  <div style={{ color: 'var(--ink-secondary)', fontSize: 13, marginTop: 4, lineHeight: 1.55 }}>
                    {res.rationale}
                  </div>
                </div>
              ))}
            </div>

            <div className="fabric-3d-rationale">
              <div className="sub-card" style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: 4 }}>风格适配</strong>
                {proposal.fabricRationale.styleFit}
              </div>
              <div className="sub-card" style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: 4 }}>体感适配</strong>
                {proposal.fabricRationale.comfortFit}
              </div>
              <div className="sub-card" style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: 4 }}>体型适配</strong>
                {proposal.fabricRationale.bodyFit}
              </div>
            </div>
          </section>

          {/* Progressive Disclosure */}
          <details className="disclosure">
            <summary>
              <span>协同与复核清单</span>
              <ChevronDown size={14} />
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <div className="workflow-ribbon">
                {proposal.workflowStages.map((st) => (
                  <div key={st.step} className="workflow-step-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                        0{st.step} {st.title}
                      </span>
                      <span className="meta-badge">
                        <span
                          className={`status-dot ${
                            st.owner === 'AI 企划辅助'
                              ? 'dot-info'
                              : st.owner === '人机协同核实'
                                ? 'dot-pass'
                                : 'dot-caution'
                          }`}
                        />
                        <span>{st.owner}</span>
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.55 }}>
                      {st.detail}
                    </div>
                  </div>
                ))}
              </div>

              {proposal.feasibilityNotices.map((n) => (
                <div key={n.id} className="notice-row">
                  <span className={`status-dot dot-${n.level}`} />
                  <span>
                    <strong style={{ color: 'var(--ink-primary)' }}>{n.title}：</strong>
                    {n.detail}
                  </span>
                </div>
              ))}

              <ol
                style={{
                  margin: '4px 0 0 18px',
                  padding: 0,
                  fontSize: 12.5,
                  color: 'var(--ink-secondary)',
                  lineHeight: 1.7,
                }}
              >
                {proposal.humanReviewChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </details>
        </article>

        {/* Right: Integrated 3-Shot Visual Direction */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '2px 2px 0',
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 590 }}>三镜头视觉意向</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="no-print">
              <div className="segmented segmented-solid">
                {(Object.keys(FORMAT_LABELS) as PromptToolFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`seg-btn ${toolFormat === fmt ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setToolFormat(fmt)}
                  >
                    {FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn-outline"
                style={{ padding: '5px 11px', fontSize: 12 }}
                onClick={() =>
                  downloadTextFile(
                    `${proposal.projectName}-视觉意向提示词.md`,
                    buildPromptPackMarkdown(promptPack),
                    'text/markdown;charset=utf-8'
                  )
                }
              >
                <Download size={13} />
                <span>导出</span>
              </button>
            </div>
          </div>

          {promptPack.shots.map((shot) => {
            const activePrompt = shot.prompts[toolFormat];
            const copyKey = `${shot.shotType}-${toolFormat}`;
            return (
              <div key={shot.shotType} className="surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{shot.shotTitle}</div>
                  <button
                    type="button"
                    className="btn-outline no-print"
                    style={{ padding: '5px 12px', fontSize: 12.5 }}
                    onClick={() => handleCopy(copyKey, activePrompt)}
                  >
                    {copiedId === copyKey ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedId === copyKey ? '已复制' : '复制'}</span>
                  </button>
                </div>

                <div className="prompt-box">{activePrompt}</div>

                <details className="disclosure" style={{ marginTop: 10, paddingTop: 8 }}>
                  <summary>
                    <span>镜头与负向参数</span>
                    <ChevronDown size={13} />
                  </summary>
                  <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.6 }}>
                    <div>
                      {shot.aspectRatio} · {shot.cameraSpec}
                    </div>
                    <div style={{ marginTop: 3 }}>Negative：{shot.negativePrompt}</div>
                  </div>
                </details>
              </div>
            );
          })}
        </section>
      </div>

      {/* Step 3 -> Step 4 Handoff Bar */}
      <div className="flow-handoff-bar no-print">
        <div className="flow-handoff-summary">
          <span className="status-dot dot-pass" />
          <span>
            {isArchived
              ? '当前方案已存入项目档案，可前往复核、编辑或导出。'
              : '确认方案初稿后，存入项目档案以留存变更轨迹并支持导出。'}
          </span>
        </div>
        <div className="flow-handoff-actions">
          <button type="button" className="btn-outline" onClick={onBackToConfigurator}>
            <ArrowLeft size={14} />
            <span>返回调整选配</span>
          </button>
          <button type="button" className="btn-black" onClick={onArchiveAndOpenLedger}>
            <span>下一步：存入项目档案</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
