import { Archive, Check, ChevronDown, Copy, Download, FileText, Printer } from 'lucide-react';
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
  onSaveToLedger: () => void;
  onOpenLedger: () => void;
}

const FORMAT_LABELS: Record<PromptToolFormat, string> = {
  midjourney: 'Midjourney',
  flux_sd: 'Flux / SD',
  jimeng_cn: '即梦中文',
};

const PROVENANCE_LABEL: Record<SpecProvenance, { label: string; className: string }> = {
  user_explicit: { label: '用户明确', className: 'prov-user' },
  system_suggested: { label: '系统建议', className: 'prov-ai' },
  needs_human_verification: { label: '待人工核实', className: 'prov-human' },
};

export function ProposalAndPrompts({
  proposal,
  promptPack,
  heroPreviewImage,
  craftPreviewImage,
  onSaveToLedger,
  onOpenLedger,
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
        <div>
          <h1 className="page-h1">方案初稿与视觉需求包</h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
            带四类静态资产依据与可行性提示的方案初稿 + 成衣 / 细节 / 上身氛围三镜头绘图提示词包
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                `${proposal.projectName}-企划方案初稿.md`,
                buildProposalMarkdown(proposal),
                'text/markdown;charset=utf-8'
              )
            }
          >
            <FileText size={14} />
            <span>导出方案 MD</span>
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={14} />
            <span>打印 / PDF</span>
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              onSaveToLedger();
              setSavedToast(true);
              window.setTimeout(() => setSavedToast(false), 2000);
            }}
          >
            <Archive size={14} />
            <span>{savedToast ? '已写入台账 ✓' : '写入台账'}</span>
          </button>
          <button type="button" className="btn-black" onClick={onOpenLedger}>
            查看业务台账
          </button>
        </div>
      </div>

      <div className="proposal-grid">
        {/* Left: Clean Editorial Proposal Sheet */}
        <article className="dossier-sheet" aria-label="海派定制整体方案初稿">
          <div className="dossier-top">
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 21, fontWeight: 600 }}>
                {proposal.projectName}
              </h2>
              <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
                {proposal.clientName} · {proposal.id}
              </div>
            </div>
            <span className="tag-minimal" style={{ fontWeight: 500 }}>
              AI 企划初稿 · 人工终审
            </span>
          </div>

          <div
            style={{
              marginBottom: 18,
              padding: '10px 13px',
              borderRadius: 10,
              background: 'var(--bg-canvas)',
              fontSize: 12,
              color: 'var(--ink-secondary)',
              lineHeight: 1.55,
            }}
          >
            {proposal.dataSourceStatement}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr',
              gap: 12,
              marginBottom: 22,
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

          {/* 3-Bucket Epistemic Separation */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">一、三类信息分离（事实 / 系统建议 / 待人工核实）</h3>
            <div className="bucket-3-grid compact">
              <div className="bucket-col bucket-user">
                <div className="bucket-head">用户明确说的</div>
                <ul className="bucket-list">
                  {proposal.threeBuckets.userExplicit.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bucket-col bucket-ai">
                <div className="bucket-head">系统建议的</div>
                <ul className="bucket-list">
                  {proposal.threeBuckets.systemSuggested.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bucket-col bucket-human">
                <div className="bucket-head">还要人工核实的</div>
                <ul className="bucket-list">
                  {proposal.threeBuckets.needsHumanVerification.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Official 8-Field Structured Tailoring Sheet */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">二、8 项专业定制参数转化清单</h3>
            <div className="spec-8-grid">
              {proposal.officialSpecs.map((spec) => {
                const prov = PROVENANCE_LABEL[spec.provenance ?? 'system_suggested'];
                return (
                  <div key={spec.key} className="spec-cell" style={{ padding: '11px 13px' }}>
                    <div className="spec-cell-head">
                      <span className="spec-label">【{spec.label}】</span>
                      <span className={`prov-pill ${prov.className}`}>{prov.label}</span>
                    </div>
                    <span className="spec-value" style={{ fontSize: 12.5 }}>
                      {spec.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4-Category Static Asset Basis + 3-Dimension Fabric Rationale */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">三、四类静态模拟资产匹配依据与选料三维判断</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {proposal.resourceBasis.map((res) => (
                <div
                  key={`${res.assetType}-${res.code}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-hairline)',
                    background: 'var(--bg-subtle)',
                    fontSize: 12.5,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>
                      [{res.assetType}] {res.name}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      {res.code} · {res.sourceTag}
                    </span>
                  </div>
                  <div style={{ color: 'var(--ink-secondary)', marginTop: 4, lineHeight: 1.55 }}>
                    {res.rationale}
                  </div>
                </div>
              ))}
            </div>

            <div className="fabric-3d-rationale">
              <div>
                <strong>风格适配：</strong>
                {proposal.fabricRationale.styleFit}
              </div>
              <div>
                <strong>体感适配：</strong>
                {proposal.fabricRationale.comfortFit}
              </div>
              <div>
                <strong>体型适配：</strong>
                {proposal.fabricRationale.bodyFit}
              </div>
            </div>
          </section>

          {/* 6-Step Official Workflow Alignment with Human/AI Boundary */}
          <section className="dossier-sec">
            <h3 className="dossier-sec-h3">四、定制全流程人机分工（对齐官方六步流程与合规边界）</h3>
            <div className="workflow-ribbon">
              {proposal.workflowStages.map((st) => (
                <div key={st.step} className="workflow-step-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                      0{st.step} {st.title}
                    </span>
                    <span
                      className={`prov-pill ${
                        st.owner === 'AI 企划辅助'
                          ? 'prov-ai'
                          : st.owner === '人机协同核实'
                            ? 'prov-user'
                            : 'prov-human'
                      }`}
                    >
                      {st.owner}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    {st.detail}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 10 }}>
              {proposal.estimatedLeadTimeNote}
            </div>
          </section>

          {/* Progressive Disclosure: Full Feasibility & Human Review Checklist */}
          <details className="disclosure" open>
            <summary>
              <span>可行性提示与人工终审清单</span>
              <ChevronDown size={14} />
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {proposal.feasibilityNotices.map((n) => (
                <div key={n.id} className={`feas-bar feas-${n.level}`}>
                  <span className={`status-dot dot-${n.level}`} />
                  <span>
                    <strong>{n.title}：</strong>
                    {n.detail}
                  </span>
                </div>
              ))}
              <ol
                style={{
                  margin: '8px 0 0 18px',
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

          <div
            style={{
              marginTop: 22,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--bg-canvas)',
              fontSize: 12,
              color: 'var(--ink-muted)',
              lineHeight: 1.6,
            }}
          >
            {proposal.boundaryDisclaimer}
          </div>
        </article>

        {/* Right: Clean 3-Shot AI Visual Prompt Pack & Brief */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="surface-card" style={{ padding: '18px 20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div className="segmented segmented-solid no-print">
                {(Object.keys(FORMAT_LABELS) as PromptToolFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`seg-btn ${toolFormat === fmt ? 'active' : ''}`}
                    onClick={() => setToolFormat(fmt)}
                  >
                    {FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn-outline no-print"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() =>
                  downloadTextFile(
                    `${proposal.projectName}-视觉需求与提示词包.md`,
                    buildPromptPackMarkdown(promptPack),
                    'text/markdown;charset=utf-8'
                  )
                }
              >
                <Download size={13} />
                <span>导出视觉包 MD</span>
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--bg-canvas)',
                fontSize: 12,
                color: 'var(--ink-secondary)',
                lineHeight: 1.55,
              }}
            >
              <div>{promptPack.apiBoundaryNote}</div>
              <div style={{ marginTop: 4, color: 'var(--accent-warm)' }}>{promptPack.colorDisclaimer}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>视觉需求包必保结构约束</div>
              <ul
                style={{
                  margin: '0 0 0 16px',
                  padding: 0,
                  fontSize: 12,
                  color: 'var(--ink-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {promptPack.mustPreserveConstraints.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          {promptPack.shots.map((shot) => {
            const activePrompt = shot.prompts[toolFormat];
            const copyKey = `${shot.shotType}-${toolFormat}`;
            return (
              <div key={shot.shotType} className="surface-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{shot.shotTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                      {shot.aspectRatio} · {shot.lightingSpec}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-outline no-print"
                    style={{ padding: '5px 11px', fontSize: 12 }}
                    onClick={() => handleCopy(copyKey, activePrompt)}
                  >
                    {copiedId === copyKey ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedId === copyKey ? '已复制' : '复制'}</span>
                  </button>
                </div>

                <div className="prompt-box">{activePrompt}</div>

                <details className="disclosure" style={{ marginTop: 10, paddingTop: 8 }}>
                  <summary>
                    <span>镜头参数与负向提示词（Negative）</span>
                    <ChevronDown size={13} />
                  </summary>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.55 }}>
                    <div>镜头：{shot.cameraSpec}</div>
                    <div style={{ marginTop: 3 }}>Negative：{shot.negativePrompt}</div>
                  </div>
                </details>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
