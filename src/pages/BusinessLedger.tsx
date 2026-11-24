import { ArrowUpRight, Check, Clock, Download, FileJson, Plus, Printer, Save } from 'lucide-react';
import { useState } from 'react';
import { VersionHandoff } from '../components/DecisionPanels';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type { LedgerRecord, LedgerReviewStatus } from '../types/sartoria';
import { buildLedgerCsv, downloadTextFile } from '../utils/exporters';

interface BusinessLedgerProps {
  records: LedgerRecord[];
  highlightedRecordId: string | null;
  onUpdateRecord: (
    id: string,
    patch: {
      projectName?: string;
      clientName?: string;
      status?: LedgerReviewStatus;
      specialistNotes?: string;
    },
    auditAction: string,
    diffSummary?: string
  ) => void;
  onLoadRecordIntoStudio: (record: LedgerRecord) => void;
  onStartNewRequirement: () => void;
}

const STATUS_OPTIONS: LedgerReviewStatus[] = [
  'AI草稿',
  '待业务专员复核',
  '待版师/报价终审',
  '已归档',
];

export function BusinessLedger({
  records,
  highlightedRecordId,
  onUpdateRecord,
  onLoadRecordIntoStudio,
  onStartNewRequirement,
}: BusinessLedgerProps) {
  const [userSelection, setUserSelection] = useState<{
    id: string;
    forHighlight: string | null;
  } | null>(null);

  const selectedId =
    userSelection && userSelection.forHighlight === highlightedRecordId
      ? userSelection.id
      : highlightedRecordId ?? records[0]?.id ?? '';

  const selected = records.find((r) => r.id === selectedId) ?? records[0];

  const [draftEdits, setDraftEdits] = useState<{
    recordKey: string;
    projectName: string;
    clientName: string;
    status: LedgerReviewStatus;
    specialistNotes: string;
  } | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);

  const activeRecordKey = selected ? `${selected.id}:${selected.updatedAt}` : '';
  const activeDraft =
    selected && draftEdits && draftEdits.recordKey === activeRecordKey
      ? draftEdits
      : selected
        ? {
            recordKey: activeRecordKey,
            projectName: selected.projectName,
            clientName: selected.clientName,
            status: selected.status,
            specialistNotes: selected.specialistNotes,
          }
        : null;

  const updateDraft = (
    patch: Partial<{
      projectName: string;
      clientName: string;
      status: LedgerReviewStatus;
      specialistNotes: string;
    }>
  ) => {
    if (!activeDraft) return;
    setSavedFlag(false);
    setDraftEdits({ ...activeDraft, ...patch });
  };

  const draftProjectName = activeDraft?.projectName ?? '';
  const draftClientName = activeDraft?.clientName ?? '';
  const draftStatus: LedgerReviewStatus = activeDraft?.status ?? '待业务专员复核';
  const draftNotes = activeDraft?.specialistNotes ?? '';

  const savedVersions = records.reduce((sum, record) => sum + (record.decisionHistory?.versions.length ?? 0), 0);
  const pendingReviewCount = records.filter((r) => r.status !== '已归档').length;
  const totalActions = records.reduce((sum, r) => sum + r.auditLogs.length, 0);

  const selectedConfig = selected?.config;
  const selectedPattern = PATTERNS.find((p) => p.id === selectedConfig?.patternId);
  const selectedFabric = FABRICS.find((f) => f.id === selectedConfig?.fabricId);
  const selectedScene = SCENES.find((s) => s.id === selectedConfig?.sceneId);
  const selectedCrafts = selectedConfig
    ? CRAFTS.filter((c) => selectedConfig.craftIds.includes(c.id))
    : [];
  const selectedCases = selected
    ? HISTORICAL_CASES.filter((hc) => (selected.matchedCaseIds ?? []).includes(hc.id))
    : [];

  const hasPendingEdits = Boolean(
    selected &&
      (draftProjectName !== selected.projectName ||
        draftClientName !== selected.clientName ||
        draftStatus !== selected.status ||
        draftNotes !== selected.specialistNotes)
  );

  const handleSaveEdits = () => {
    if (!selected || !hasPendingEdits) return;
    const diffs: string[] = [];
    if (draftProjectName !== selected.projectName) {
      diffs.push(`项目名：${selected.projectName} → ${draftProjectName}`);
    }
    if (draftClientName !== selected.clientName) {
      diffs.push(`客户：${selected.clientName} → ${draftClientName}`);
    }
    if (draftStatus !== selected.status) {
      diffs.push(`状态：${selected.status} → ${draftStatus}`);
    }
    if (draftNotes !== selected.specialistNotes) {
      diffs.push('更新复核备注');
    }

    onUpdateRecord(
      selected.id,
      {
        projectName: draftProjectName.trim() || selected.projectName,
        clientName: draftClientName.trim() || selected.clientName,
        status: draftStatus,
        specialistNotes: draftNotes,
      },
      '人工编辑档案记录',
      diffs.join('；')
    );
    setSavedFlag(true);
    window.setTimeout(() => setSavedFlag(false), 1800);
  };

  return (
    <div className="page-wrap">
      <div className="page-head no-print">
        <h1 className="page-h1">项目档案</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn-outline" onClick={onStartNewRequirement}>
            <Plus size={14} />
            <span>新建需求</span>
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={14} />
            <span>打印</span>
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                'Sartoria-AI-项目档案.json',
                JSON.stringify(records, null, 2),
                'application/json;charset=utf-8'
              )
            }
          >
            <FileJson size={14} />
            <span>导出 JSON</span>
          </button>
          <button
            type="button"
            className="btn-black"
            onClick={() =>
              downloadTextFile(
                'Sartoria-AI-定制项目档案.csv',
                buildLedgerCsv(records),
                'text/csv;charset=utf-8'
              )
            }
          >
            <Download size={14} />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Crisp Tabular KPIs */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>归档项目</div>
          <div className="kpi-num">{records.length}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>待人工复核</div>
          <div className="kpi-num">{pendingReviewCount}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>决策版本</div>
          <div className="kpi-num">{savedVersions}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>变更留痕</div>
          <div className="kpi-num">{totalActions}</div>
        </div>
      </div>

      <div className="ledger-stack">
        {/* Top: Full-Width Project Archive Table */}
        <section className="surface-card" style={{ padding: 0, overflow: 'hidden' }} aria-label="项目档案列表">
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>客户</th>
                  <th>匹配资产</th>
                  <th>匹配分</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const pat = PATTERNS.find((p) => p.id === rec.config?.patternId);
                  const fab = FABRICS.find((f) => f.id === rec.config?.fabricId);
                  const isSel = selected?.id === rec.id;
                  const isNewlyArchived = highlightedRecordId === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className={`table-row ${isSel ? 'selected' : ''}`}
                      onClick={() =>
                        setUserSelection({ id: rec.id, forHighlight: highlightedRecordId })
                      }
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 590 }}>{rec.projectName}</span>
                          {isNewlyArchived && (
                            <span className="meta-badge">
                              <span className="status-dot dot-pass" />
                              <span>刚归档</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                        {rec.clientName}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                        <span>{pat?.category ?? pat?.name ?? (rec.config ? '已选版型' : '暂无合格组合')}</span>
                        {fab?.shortName && <span style={{ color: 'var(--ink-muted)' }}> · {fab.shortName}</span>}
                      </td>
                      <td
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 590,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rec.config ? (rec.decisionHistory ? rec.matchScore : `${rec.matchScore}% · 旧档`) : '待核'}
                      </td>
                      <td>
                        <span className="meta-badge">{rec.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Version Handoff (Full-Width when Selected Record Has Decision History) */}
        {selected?.decisionHistory && <VersionHandoff key={selected.id} history={selected.decisionHistory} />}

        {/* Bottom: Balanced Full-Width 2-Column Project Detail & Review Workspace */}
        {selected && (
          <section className="surface-card" aria-label="档案详情与追溯">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                paddingBottom: 16,
                marginBottom: 16,
                borderBottom: '1px solid var(--border-hairline)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 16, fontWeight: 590 }}>{selected.projectName}</h2>
                <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                  {selected.projectCode}
                </span>
              </div>
              <button
                type="button"
                className="btn-outline no-print"
                style={{ padding: '6px 12px', fontSize: 12.5 }}
                onClick={() => onLoadRecordIntoStudio(selected)}
              >
                <span>回选配室修改</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="ledger-detail-grid">
              {/* Left Column: Requirement + Matched Assets + Audit Log */}
              <div className="ledger-detail-col">
                <div className="ledger-block">
                  <div className="ledger-block-title">
                    <span>原始需求</span>
                    <span className="meta-badge">
                      <span
                        className={`status-dot ${
                          selected.deconstructed.colorSpecifiedByUser ? 'dot-pass' : 'dot-caution'
                        }`}
                      />
                      <span>{selected.deconstructed.colorSpecifiedByUser ? '已表达色彩' : '待人工核色'}</span>
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.65 }}>
                    “{selected.requirementInput.rawNarrative}”
                  </p>
                </div>

                <div className="ledger-block">
                  <div className="ledger-block-title">
                    <span>匹配资产</span>
                  </div>
                  {selectedConfig ? (
                    <div className="ledger-asset-list">
                      <div>
                        <strong>版型：</strong>
                        {selectedPattern ? selectedPattern.name : selectedConfig.patternId}
                      </div>
                      <div>
                        <strong>面料：</strong>
                        {selectedFabric ? selectedFabric.name : selectedConfig.fabricId}
                      </div>
                      <div>
                        <strong>工艺：</strong>
                        {selectedCrafts.length > 0
                          ? selectedCrafts.map((c) => c.shortName).join(' / ')
                          : '净面极简精工'}
                      </div>
                      <div>
                        <strong>案例：</strong>
                        {selectedCases.length > 0
                          ? selectedCases.map((hc) => hc.title).join('；')
                          : '—'}
                      </div>
                      <div>
                        <strong>场景：</strong>
                        {selectedScene?.shortName ?? selectedConfig.sceneId}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
                      暂无合格组合。拒绝和待核依据已保存在版本交接内。
                    </p>
                  )}
                </div>

                <div className="ledger-block">
                  <div className="ledger-block-title" style={{ justifyContent: 'flex-start', gap: 6 }}>
                    <Clock size={13} />
                    <span>变更记录 ({selected.auditLogs.length})</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    {selected.auditLogs
                      .slice()
                      .reverse()
                      .map((log) => (
                        <div
                          key={log.id}
                          style={{
                            borderLeft: '2px solid var(--border-medium)',
                            paddingLeft: 10,
                            fontSize: 12.5,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <strong style={{ fontWeight: 510 }}>
                              {log.stage} · {log.action}
                            </strong>
                            <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', flexShrink: 0 }}>
                              {new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {log.diffSummary && (
                            <div className="diff-pill" style={{ marginTop: 4 }}>
                              {log.diffSummary}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Human Review & Edit Form */}
              <div className="ledger-detail-col no-print">
                <div className="ledger-block">
                  <div className="ledger-block-title">
                    <span>人工复核与编辑</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label
                        htmlFor="ledger-project-name"
                        style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}
                      >
                        项目名称
                      </label>
                      <input
                        id="ledger-project-name"
                        className="clean-input"
                        style={{ background: 'var(--bg-page)', padding: '8px 10px', fontSize: 13 }}
                        value={draftProjectName}
                        onChange={(e) => updateDraft({ projectName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ledger-client-name"
                        style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}
                      >
                        客户称呼
                      </label>
                      <input
                        id="ledger-client-name"
                        className="clean-input"
                        style={{ background: 'var(--bg-page)', padding: '8px 10px', fontSize: 13 }}
                        value={draftClientName}
                        onChange={(e) => updateDraft({ clientName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label
                      htmlFor="ledger-status"
                      style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}
                    >
                      复核状态
                    </label>
                    <select
                      id="ledger-status"
                      className="clean-select"
                      style={{ background: 'var(--bg-page)', padding: '8px 10px', fontSize: 13 }}
                      value={draftStatus}
                      onChange={(e) => updateDraft({ status: e.target.value as LedgerReviewStatus })}
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label
                      htmlFor="ledger-notes"
                      style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}
                    >
                      复核备注
                    </label>
                    <textarea
                      id="ledger-notes"
                      className="clean-textarea"
                      style={{ background: 'var(--bg-page)', minHeight: 112, fontSize: 13, padding: '8px 10px' }}
                      value={draftNotes}
                      onChange={(e) => updateDraft({ specialistNotes: e.target.value })}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-black"
                    style={{ width: '100%', padding: '9px 14px', fontSize: 13 }}
                    disabled={!hasPendingEdits}
                    onClick={handleSaveEdits}
                  >
                    {savedFlag ? <Check size={14} /> : <Save size={14} />}
                    <span>{savedFlag ? '已保存变更' : '保存并记录轨迹'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
