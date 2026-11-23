import { ArrowUpRight, Check, Clock, Download, FileJson, Printer, Save } from 'lucide-react';
import { useState } from 'react';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type { LedgerRecord, LedgerReviewStatus } from '../types/sartoria';
import { buildLedgerCsv, downloadTextFile } from '../utils/exporters';

interface BusinessLedgerProps {
  records: LedgerRecord[];
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
}

const STATUS_OPTIONS: LedgerReviewStatus[] = [
  'AI草稿',
  '待业务专员复核',
  '待版师/报价终审',
  '已归档',
];

export function BusinessLedger({
  records,
  onUpdateRecord,
  onLoadRecordIntoStudio,
}: BusinessLedgerProps) {
  const [selectedId, setSelectedId] = useState<string>(records[0]?.id ?? '');
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

  const avgMatch =
    records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.matchScore, 0) / records.length)
      : 0;
  const totalActions = records.reduce((sum, r) => sum + r.auditLogs.length, 0);

  const selectedPattern = selected ? PATTERNS.find((p) => p.id === selected.config.patternId) : undefined;
  const selectedFabric = selected ? FABRICS.find((f) => f.id === selected.config.fabricId) : undefined;
  const selectedScene = selected ? SCENES.find((s) => s.id === selected.config.sceneId) : undefined;
  const selectedCrafts = selected
    ? CRAFTS.filter((c) => selected.config.craftIds.includes(c.id))
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
      diffs.push(`流转状态：${selected.status} → ${draftStatus}`);
    }
    if (draftNotes !== selected.specialistNotes) {
      diffs.push('更新专员复核备注');
    }

    onUpdateRecord(
      selected.id,
      {
        projectName: draftProjectName.trim() || selected.projectName,
        clientName: draftClientName.trim() || selected.clientName,
        status: draftStatus,
        specialistNotes: draftNotes,
      },
      '人工编辑台账记录',
      diffs.join('；')
    );
    setSavedFlag(true);
    window.setTimeout(() => setSavedFlag(false), 1800);
  };

  return (
    <div className="page-wrap">
      <div className="page-head no-print">
        <div>
          <h1 className="page-h1">定制业务台账</h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
            可编辑、可导出 · 完整回看原始需求、四类匹配静态资源与全流程修改轨迹（改过什么一目了然）
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={14} />
            <span>打印</span>
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                'Sartoria-AI-台账档案.json',
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
                'Sartoria-AI-定制业务专题台账.csv',
                buildLedgerCsv(records),
                'text/csv;charset=utf-8'
              )
            }
          >
            <Download size={14} />
            <span>导出 CSV 台账</span>
          </button>
        </div>
      </div>

      {/* Minimal 4-KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>归档项目</div>
          <div className="kpi-num">{records.length}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>平均资产契合度</div>
          <div className="kpi-num">{avgMatch}%</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>全流程变更留痕</div>
          <div className="kpi-num">{totalActions}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>数据与合规状态</div>
          <div className="kpi-num" style={{ fontSize: 18, paddingTop: 6, color: 'var(--pass)' }}>
            静态模拟 · 人工终审
          </div>
        </div>
      </div>

      <div className="ledger-split">
        <section className="surface-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>项目与客户</th>
                  <th>匹配静态资产</th>
                  <th>契合度</th>
                  <th>复核状态</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const pat = PATTERNS.find((p) => p.id === rec.config.patternId);
                  const fab = FABRICS.find((f) => f.id === rec.config.fabricId);
                  const scene = SCENES.find((s) => s.id === rec.config.sceneId);
                  const isSel = selected?.id === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className={`table-row ${isSel ? 'selected' : ''}`}
                      onClick={() => setSelectedId(rec.id)}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{rec.projectName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>
                          {rec.projectCode} · {rec.clientName}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                        <div>{pat?.code ?? rec.config.patternId}</div>
                        <div style={{ color: 'var(--ink-muted)' }}>
                          {fab?.shortName} · {scene?.shortName}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{rec.matchScore}%</td>
                      <td>
                        <span className="tag-minimal">{rec.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <aside className="surface-card" aria-label="台账详情与追溯">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                  {selected.projectCode} · 更新于 {new Date(selected.updatedAt).toLocaleString('zh-CN')}
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{selected.projectName}</h2>
              </div>
              <button
                type="button"
                className="btn-outline no-print"
                style={{ padding: '6px 11px', fontSize: 12 }}
                onClick={() => onLoadRecordIntoStudio(selected)}
              >
                <span>回选配室修改</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 1. 回看原始需求与待核实提示 */}
              <div className="ledger-block">
                <div className="ledger-block-title">
                  <span>1. 回看原始需求</span>
                  <span
                    className={`prov-pill ${
                      selected.deconstructed.colorSpecifiedByUser ? 'prov-user' : 'prov-human'
                    }`}
                  >
                    {selected.deconstructed.colorSpecifiedByUser ? '已表达色彩倾向' : '未定色 · 待人工核色'}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                  “{selected.requirementInput.rawNarrative}”
                </p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                  {selected.deconstructed.emotionTags.map((t) => (
                    <span key={t} className="tag-minimal">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* 2. 匹配了哪些静态模拟资源（四类全展示） */}
              <div className="ledger-block">
                <div className="ledger-block-title">
                  <span>2. 匹配的四类静态模拟资产</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>非真实生产数据</span>
                </div>
                <div className="ledger-asset-list">
                  <div>
                    <strong>版型：</strong>
                    {selectedPattern ? `${selectedPattern.code} ${selectedPattern.name}` : selected.config.patternId}
                  </div>
                  <div>
                    <strong>面料：</strong>
                    {selectedFabric ? `${selectedFabric.code} ${selectedFabric.name}` : selected.config.fabricId}
                  </div>
                  <div>
                    <strong>工艺：</strong>
                    {selectedCrafts.length > 0
                      ? selectedCrafts.map((c) => `${c.code} ${c.shortName}`).join(' / ')
                      : '净面极简精工'}
                  </div>
                  <div>
                    <strong>历史案例：</strong>
                    {selectedCases.length > 0
                      ? selectedCases.map((hc) => `${hc.code} ${hc.title}`).join('；')
                      : '—'}
                  </div>
                  <div>
                    <strong>场景：</strong>
                    {selectedScene?.name ?? selected.config.sceneId}
                  </div>
                </div>
              </div>

              {/* 3. 在线编辑（显式保存并记录变更 Diff） */}
              <div className="ledger-block no-print">
                <div className="ledger-block-title">
                  <span>3. 人工编辑与复核流转（不含报价/下单）</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                      项目名称
                    </label>
                    <input
                      className="clean-input"
                      style={{ padding: '7px 10px', fontSize: 12.5 }}
                      value={draftProjectName}
                      onChange={(e) => updateDraft({ projectName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                      客户称呼
                    </label>
                    <input
                      className="clean-input"
                      style={{ padding: '7px 10px', fontSize: 12.5 }}
                      value={draftClientName}
                      onChange={(e) => updateDraft({ clientName: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    人工流转状态
                  </label>
                  <select
                    className="clean-select"
                    style={{ padding: '7px 10px', fontSize: 12.5 }}
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

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>
                    专员复核备注（记录线下核色、量体与改版意见）
                  </label>
                  <textarea
                    className="clean-textarea"
                    style={{ minHeight: 74, fontSize: 12.5, padding: '8px 10px' }}
                    value={draftNotes}
                    onChange={(e) => updateDraft({ specialistNotes: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  className="btn-black"
                  style={{ width: '100%', padding: '8px 14px', fontSize: 12.5 }}
                  disabled={!hasPendingEdits}
                  onClick={handleSaveEdits}
                >
                  {savedFlag ? <Check size={14} /> : <Save size={14} />}
                  <span>{savedFlag ? '已保存并记录修改轨迹 ✓' : '保存编辑并记录变更轨迹'}</span>
                </button>
              </div>

              {/* 4. 改过什么：全流程动作与 Diff 留痕 */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ink-muted)',
                    marginBottom: 10,
                  }}
                >
                  <Clock size={13} />
                  <span>4. 修改轨迹与操作留痕（{selected.auditLogs.length} 条）</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    maxHeight: 260,
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
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong>
                            [{log.stage}] {log.action}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--ink-muted)', flexShrink: 0 }}>
                            {new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {log.diffSummary && (
                          <div className="diff-pill" style={{ marginTop: 4 }}>
                            变更：{log.diffSummary}
                          </div>
                        )}
                        <div style={{ color: 'var(--ink-muted)', fontSize: 11.5, marginTop: 2 }}>
                          {log.detail} · {log.actor}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
