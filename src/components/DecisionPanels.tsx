import { Check, Download, FileJson, GitCompareArrows } from 'lucide-react';
import { useId, useState } from 'react';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import type { RevisionBranch, RevisionPreview } from '../engine/decisionRevisions';
import type {
  CandidateCombination, ConstraintChange, DecisionHistory, MatchResult, RevisionOption, Version,
} from '../types/decisions';
import {
  buildDecisionExport, buildDecisionMarkdown, decisionFieldLabel, decisionOutcomeLabel, decisionSourceLabel,
  decisionValueLabel, REVISION_OPTION_LABELS,
} from '../utils/decisionHandoff';
import { downloadTextFile } from '../utils/exporters';
import './DecisionPanels.css';

interface CandidateComparisonProps {
  result: MatchResult;
  selected: CandidateCombination | null;
  onSelectCandidate: (candidate: CandidateCombination) => void;
}

const COMPARE_FIELDS = {
  style: '风格',
  comfort: '体感',
  fit: '版型适配',
  care: '洗护',
} as const;

function candidateNames(candidate: CandidateCombination) {
  return {
    fabric: FABRICS.find((entry) => entry.id === candidate.config.fabricId),
    pattern: PATTERNS.find((entry) => entry.id === candidate.config.patternId),
    crafts: candidate.config.craftIds.map((id) => CRAFTS.find((entry) => entry.id === id)?.shortName ?? id),
  };
}

function candidateTitle(candidate: CandidateCombination | null): string {
  if (!candidate) return '暂无合格组合';
  const { fabric, pattern } = candidateNames(candidate);
  return `${fabric?.shortName ?? candidate.config.fabricId} · ${pattern?.name ?? candidate.config.patternId}`;
}

function MaterialSwatch({ fabricId }: { fabricId: string }) {
  const fabric = FABRICS.find((entry) => entry.id === fabricId);
  if (!fabric) return null;
  const { baseColor, accentColor } = fabric.pbr;
  return (
    <span
      className="decision-swatch"
      style={{
        backgroundColor: baseColor,
        backgroundImage: `repeating-linear-gradient(42deg, transparent 0 3px, ${accentColor} 4px 5px)`,
      }}
      aria-hidden="true"
    />
  );
}

function CandidateMaterial({ candidate }: { candidate: CandidateCombination | null }) {
  return (
    <div className="decision-candidate-header decision-branch-caption">
      {candidate && <MaterialSwatch fabricId={candidate.config.fabricId} />}
      <p>{candidateTitle(candidate)}</p>
    </div>
  );
}

function CandidateEvidence({ candidate }: { candidate: CandidateCombination }) {
  return (
    <details className="decision-evidence">
      <summary>查看匹配依据</summary>
      <p className="decision-id">
        {[candidate.config.patternId, candidate.config.fabricId, ...candidate.config.craftIds, candidate.config.sceneId].join(' / ')}
      </p>
      {candidate.evidence.length > 0 && (
        <ul>
          {candidate.evidence.map((entry, index) => (
            <li key={`${entry.assetId}-${entry.field}-${index}`}>
              <strong>{entry.assetCode} · {decisionFieldLabel(entry.field)} · {decisionOutcomeLabel(entry.outcome)}</strong>
              <div>{entry.detail}</div>
              <small>{decisionSourceLabel(entry.source.kind)} · {entry.source.reference}</small>
            </li>
          ))}
        </ul>
      )}
      {candidate.referenceCaseIds.length > 0 && (
        <p>历史案例参考 {candidate.referenceCaseIds.join(' / ')}</p>
      )}
    </details>
  );
}

export function CandidateComparison({ result, selected, onSelectCandidate }: CandidateComparisonProps) {
  const candidates = [
    ['A · 主推', result.recommended],
    ['B · 替代', result.alternative],
  ] as const;
  const retained = selected?.status === 'eligible' &&
    !candidates.some(([, candidate]) => candidate?.id === selected.id) ? selected : null;
  const proposed = retained ? [...candidates, ['当前选定', retained] as const] : candidates;
  const review = result.review[0];
  const rejection = result.rejected[0];

  return (
    <section className="surface-card decision-panel" aria-label="方案对比">
      <div className="decision-heading">
        <h2>方案对比</h2>
      </div>
      {result.status === 'no_match' && <p role="status" className="decision-alert">暂无满足全部硬条件的组合。请复核下列证据或确认可调整的条件。</p>}
      <div className="decision-candidate-grid">
        {proposed.map(([label, candidate]) => {
          if (!candidate) return null;
          const { fabric, pattern, crafts } = candidateNames(candidate);
          const active = selected?.id === candidate.id;
          return (
            <article className={`decision-candidate${active ? ' decision-candidate-active' : ''}`} key={candidate.id}>
              <header className="decision-candidate-header">
                <MaterialSwatch fabricId={candidate.config.fabricId} />
                <div>
                  <p className="decision-caption">{label}</p>
                  <h3>{fabric?.shortName ?? candidate.config.fabricId}</h3>
                  <p>{pattern?.name ?? candidate.config.patternId}</p>
                </div>
              </header>
              <dl className="decision-factors">
                {Object.entries(COMPARE_FIELDS).map(([key, title]) => (
                  <div key={key}>
                    <dt>{title}</dt>
                    <dd>{candidate.comparison[key as keyof typeof COMPARE_FIELDS]}</dd>
                  </div>
                ))}
                <div>
                  <dt>工艺</dt>
                  <dd>{crafts.length ? crafts.join('、') : '暂无工艺记录'}</dd>
                </div>
              </dl>
              <div className="decision-actions">
                <span className="decision-caption">规则匹配分 {candidate.ruleScore}</span>
                <button
                  type="button"
                  className={active ? 'btn-outline' : 'btn-black'}
                  aria-pressed={active}
                  disabled={active}
                  onClick={() => onSelectCandidate(candidate)}
                >
                  {active ? <><Check size={14} />已选用</> : '选用此方案'}
                </button>
              </div>
              <CandidateEvidence candidate={candidate} />
            </article>
          );
        })}
      </div>
      {result.status === 'matched' && !result.alternative && <p className="decision-caption">当前仅一套满足硬条件。</p>}
      {(review || rejection) && (
        <div className="decision-gate-grid">
          {review && (
            <article className="decision-gate decision-review">
              <h3>待核组合</h3>
              <p>{candidateTitle(review)}</p>
              <ul>{review.decisionReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
              <CandidateEvidence candidate={review} />
            </article>
          )}
          {rejection && (
            <article className="decision-gate decision-rejection">
              <h3>拒绝示例</h3>
              <p>{candidateTitle(rejection)}</p>
              <ul>{rejection.decisionReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
              <CandidateEvidence candidate={rejection} />
            </article>
          )}
        </div>
      )}
    </section>
  );
}

interface RevisionWorkspaceProps {
  version: Version | null;
  feedbackDraft: string;
  preview: RevisionPreview | null;
  onSaveBase: () => void;
  onChangeDraft: (text: string) => void;
  onPreview: () => void;
  onCancelPreview: () => void;
  onConfirm: (option: RevisionOption) => void;
  canSaveBase: boolean;
  pendingBase?: boolean;
}

function ChangeTable({ changes }: { changes: ConstraintChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="decision-scroll">
      <table className="decision-diff">
        <thead><tr><th scope="col">字段</th><th scope="col">此前</th><th scope="col">修改后</th></tr></thead>
        <tbody>
          {changes.map(({ field, previous, next }, index) => (
            <tr key={`${field}-${index}`}>
              <th scope="row">{decisionFieldLabel(field)}</th>
              <td>{decisionValueLabel(previous)}</td>
              <td>
                {decisionValueLabel(next)}
                {next?.quote && <small>「{next.quote}」</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BranchCard({ branch, version, onConfirm }: { branch: RevisionBranch; version: Version; onConfirm: (option: RevisionOption) => void }) {
  const isDeferred = branch.option === 'defer';
  const previousHardIds = new Set(version.requirement.constraints.filter((item) => item.level === 'hard').map((item) => item.id));
  const carryForward = branch.requirement.constraints.filter((item) =>
    item.level === 'hard' && previousHardIds.has(item.id),
  );
  return (
    <article className="decision-candidate">
      <h3>{REVISION_OPTION_LABELS[branch.option]}</h3>
      {isDeferred ? (
        <p>把反馈留给业务专员，继续沿用 V{version.number}。</p>
      ) : (
        <>
          <ChangeTable changes={branch.changes} />
          <CandidateMaterial candidate={branch.candidate} />
          {carryForward.length > 0 && (
            <p className="decision-caption">
              沿用硬条件 · {carryForward.map((item) => `${decisionFieldLabel(item.field)} ${decisionValueLabel(item)}`).join('、')}
            </p>
          )}
          {branch.impacts.length > 0 && <ul>{branch.impacts.map(({ detail }, index) => <li key={index}>{detail}</li>)}</ul>}
          {!branch.canConfirm && <p className="decision-caption">{branch.changes.length ? '复核阻断原因后再确认。' : '这一选项没有可保存的变更。'}</p>}
        </>
      )}
      <button
        type="button"
        className={isDeferred ? 'btn-outline' : 'btn-black'}
        disabled={!branch.canConfirm}
        onClick={() => onConfirm(branch.option)}
      >
        {isDeferred ? '挂起反馈' : !branch.candidate ? '确认条件并保存待核版'
          : branch.option === 'keep' ? '按原硬条件确认' : '确认并保存新版'}
      </button>
    </article>
  );
}

export function RevisionWorkspace({
  version, feedbackDraft, preview, onSaveBase, onChangeDraft, onPreview, onCancelPreview, onConfirm, canSaveBase, pendingBase,
}: RevisionWorkspaceProps) {
  const feedbackId = useId();
  return (
    <section className="surface-card decision-panel" aria-label="客户改稿">
      <div className="decision-heading">
        <h2>客户改稿</h2>
        {version && <span className="decision-caption">当前版本 V{version.number}{version.candidate ? '' : ' · 待核'}</span>}
      </div>
      {!version ? (
        <div className="decision-actions">
          <p>{pendingBase ? '可以先保存当前约束和拒绝依据，后续继续复核及改稿。' : '保存当前需求和组合后，即可对照原版修改。'}</p>
          <button type="button" className="btn-black" disabled={!canSaveBase} onClick={onSaveBase}>{pendingBase ? '保存待核初版' : '保存初版'}</button>
        </div>
      ) : (
        <>
          <label className="decision-label" htmlFor={feedbackId}>客户反馈原话</label>
          <textarea
            id={feedbackId}
            className="clean-textarea decision-feedback"
            value={feedbackDraft}
            onChange={(event) => onChangeDraft(event.target.value)}
            rows={3}
          />
          <div className="decision-actions">
            <button type="button" className="btn-black" disabled={!feedbackDraft.trim()} onClick={onPreview}>
              <GitCompareArrows size={15} />预览改稿差异
            </button>
            {preview && <button type="button" className="btn-outline" onClick={onCancelPreview}>取消预览并保留草稿</button>}
          </div>
          {preview && (
            <div className="decision-preview" aria-label="改稿差异预览">
              <div className="decision-heading">
                <h3>V{version.number} · 改稿前</h3>
              </div>
              <CandidateMaterial candidate={version.candidate} />
              {preview.requestedPatch.length ? <ChangeTable changes={preview.requestedPatch} /> : (
                <p className="decision-caption">{preview.branches.some((branch) => branch.changes.length > 0)
                  ? '此次反馈补充了待确认事项，可核对原话后保存。'
                  : '本次反馈尚未提取到可确认的变更。'}</p>
              )}
              {preview.conflicts.length > 0 && (
                <div className="decision-alert" role="status">
                  <strong>待裁决的冲突</strong>
                  <ul>{preview.conflicts.map(({ field, detail }, index) => <li key={index}>{decisionFieldLabel(field)} · {detail}</li>)}</ul>
                </div>
              )}
              <div className="decision-branch-grid">
                {preview.branches.map((branch) => <BranchCard key={branch.option} branch={branch} version={version} onConfirm={onConfirm} />)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function VersionHandoff({ history }: { history: DecisionHistory }) {
  const selectId = useId();
  const [pickedId, setPickedId] = useState('');
  const latest = history.versions.at(-1);
  const version = history.versions.find((entry) => entry.id === pickedId) ?? latest;
  if (!version) return null;

  const previous = history.versions.find((entry) => entry.id === version.parentVersionId) ?? null;
  const handoff = buildDecisionExport(version, previous);
  const fileStem = `Sartoria-V${version.number}-${version.id.replace(/[^\w.-]/g, '-')}`;
  const genericUnknownText = '原话未说明或暂无可归一化的取值。';
  const primaryReviews = handoff.reviews.filter((item) => item.nextStep !== genericUnknownText);
  const optionalReviews = handoff.reviews.filter((item) => item.nextStep === genericUnknownText);

  return (
    <section className="surface-card decision-panel decision-handoff" aria-label="版本交接">
      <div className="decision-heading">
        <h2>版本交接</h2>
        <div className="decision-actions no-print">
          <label htmlFor={selectId}>查看版本</label>
          <select id={selectId} value={version.id} className="clean-select decision-version-select" onChange={(event) => setPickedId(event.target.value)}>
            {history.versions.slice().reverse().map((entry) => (
              <option value={entry.id} key={entry.id}>V{entry.number}{entry.id === latest?.id ? ' · 最新' : ''}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline"
            onClick={() => downloadTextFile(`${fileStem}.json`, JSON.stringify(handoff, null, 2), 'application/json;charset=utf-8')}
          >
            <FileJson size={15} />下载 JSON
          </button>
          <button
            type="button"
            className="btn-black"
            onClick={() => downloadTextFile(`${fileStem}.md`, buildDecisionMarkdown(version, previous), 'text/markdown;charset=utf-8')}
          >
            <Download size={15} />下载交接文档
          </button>
        </div>
      </div>
      <div className="decision-version-grid">
        {previous && <div><h3>V{previous.number} · 改稿前</h3><CandidateMaterial candidate={previous.candidate} /></div>}
        <div><h3>V{version.number} · 选中版本</h3><CandidateMaterial candidate={version.candidate} /></div>
      </div>
      {version.revision && (
        <p className="decision-revision-summary">
          {REVISION_OPTION_LABELS[version.revision.selectedOption]} · 「{version.revision.turn.text}」
        </p>
      )}
      <ChangeTable changes={handoff.versionChanges} />
      <div className="decision-gate-grid">
        <div>
          <h3>待核责任</h3>
          <ul className="decision-review-list">
            {primaryReviews.map(({ field, owner, nextStep }) => (
              <li key={field}><strong>{decisionFieldLabel(field)} · {owner}</strong><div>{nextStep}</div></li>
            ))}
          </ul>
          {optionalReviews.length > 0 && (
            <details className="decision-evidence" style={{ marginTop: 8 }}>
              <summary>其余 {optionalReviews.length} 项未提及字段（按需补充）</summary>
              <ul>
                {optionalReviews.map(({ field, owner }) => (
                  <li key={field}>{decisionFieldLabel(field)} · {owner}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div>
          <h3>选中版本依据</h3>
          {version.candidate && <CandidateEvidence candidate={version.candidate} />}
          {!version.candidate && <p>暂无满足全部硬条件的组合。</p>}
        </div>
      </div>
      <details className="decision-evidence">
        <summary>客户原话与需求依据</summary>
        <ul>
          {version.requirement.turns.map((turn, index) => (
            <li key={turn.id}><strong>第 {index + 1} 轮</strong><div>「{turn.text}」</div></li>
          ))}
        </ul>
      </details>
      {history.rejectedRevisions.length > 0 && (
        <details className="decision-evidence">
          <summary>挂起反馈 ({history.rejectedRevisions.length})</summary>
          <ul>
            {history.rejectedRevisions.map((revision) => {
              const base = history.versions.find((entry) => entry.id === revision.baseVersionId);
              return (
                <li key={revision.id}>
                  <strong>{base ? `V${base.number}` : revision.baseVersionId}</strong>
                  <div>「{revision.turn.text}」</div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
