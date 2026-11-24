import { useState } from 'react';
import {
  applyConstraintEdit, describeRequirementValue, isPendingQuantityBreakdown, isRequirementValue, requirementFields,
} from '../engine/requirementInterview';
import { quantityScopeOf } from '../engine/requirementQuantity';
import type { Constraint, DecisionRequirement } from '../types/decisions';
import './RequirementConstraints.css';

const sourceLabels: Record<Constraint['state'], string> = {
  explicit: '用户原话', suggested: '系统建议', unknown: '待确认', confirmed: '人工确认',
};

const groups = [
  { level: 'hard', label: '必须满足', tone: 'dot-pass' },
  { level: 'preference', label: '偏好与建议', tone: 'dot-info' },
  { level: 'pending', label: '待确认', tone: 'dot-caution' },
] as const;

const GENERIC_UNKNOWN_REASON = '原话未说明或暂无可归一化的取值。';

interface ConstraintEditorProps {
  item: Constraint;
  onSave: (item: Constraint) => void;
  onCancel: () => void;
}

function ConstraintEditor({ item, onSave, onCancel }: ConstraintEditorProps) {
  const [level, setLevel] = useState<Constraint['level']>(item.level === 'pending' ? 'hard' : item.level);
  const [op, setOp] = useState(item.op);
  const [selected, setSelected] = useState(item.value === null ? '' : String(item.value));
  const { label, choices } = requirementFields[item.field];
  const value = item.field === 'quantity' ? Number(selected) : choices.find(([choice]) => String(choice) === selected)?.[0];
  const canSave = level === 'pending' || isRequirementValue(item.field, value);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    const concreteValue = level === 'pending' ? null : value ?? null;
    const concreteOp = level === 'pending' ? 'eq' : op;
    const keepSource = item.value === concreteValue && item.op === concreteOp && item.level === level;
    onSave({
      ...item, value: concreteValue, op: concreteOp, level,
      state: level === 'pending' ? 'unknown' : 'confirmed',
      blocking: level === 'pending' && (item.level === 'hard' || item.blocking) ? true : undefined,
      sourceTurnId: keepSource ? item.sourceTurnId : null,
      quote: keepSource ? item.quote : null,
      quantityScope: item.field === 'quantity' ? quantityScopeOf(item) : undefined,
      verifiedBy: level === 'pending' ? null : '业务顾问',
      reason: level === 'pending' ? '业务顾问将该字段设为待确认。' : null,
      withdraws: undefined,
    });
  }

  return (
    <form className="constraint-editor" aria-label={`编辑${label}`} onSubmit={submit}>
      <label>
        约束级别
        <select className="clean-select" aria-label="约束级别" value={level} onChange={(event) => setLevel(event.target.value as Constraint['level'])}>
          {groups.map((group) => <option key={group.level} value={group.level}>{group.label}</option>)}
        </select>
      </label>
      {level !== 'pending' && (
        <>
          <label>
            取值方式
            <select className="clean-select" aria-label="取值方式" value={op} onChange={(event) => setOp(event.target.value as Constraint['op'])}>
              <option value="eq">指定</option>
              <option value="neq">排除</option>
            </select>
          </label>
          <label>
            {label}
            {item.field === 'quantity' ? (
              <input className="clean-input" aria-label={label} type="number" min="1" step="1" value={selected} onChange={(event) => setSelected(event.target.value)} />
            ) : (
              <select className="clean-select" aria-label={label} value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">选择{label}</option>
                {choices.map(([choice, choiceLabel]) => <option key={String(choice)} value={String(choice)}>{choiceLabel}</option>)}
              </select>
            )}
          </label>
        </>
      )}
      <div className="constraint-actions">
        <button type="submit" className="btn-black" disabled={!canSave}>{level === 'pending' ? '标为待确认' : '确认并保存'}</button>
        <button type="button" className="btn-outline" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

interface RequirementConstraintsProps {
  requirement: DecisionRequirement;
  onEdit?: (constraints: Constraint[]) => void;
}

export function RequirementConstraints({ requirement, onEdit }: RequirementConstraintsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const { constraints, questions, turns, onlineReview } = requirement;

  function save(item: Constraint) {
    if (!onEdit) return;
    onEdit(applyConstraintEdit(constraints, item));
    setEditingId(null);
  }

  const questionFields = new Set(questions.map((q) => q.field));
  const hardItems = constraints.filter((item) => item.level === 'hard');
  const prefItems = constraints.filter((item) => item.level === 'preference');
  const pendingItems = constraints.filter((item) => item.level === 'pending');

  const priorityPending = pendingItems.filter(
    (item) => item.blocking || item.sourceTurnId !== null || item.field === 'color' || questionFields.has(item.field)
  );
  const optionalPending = pendingItems.filter((item) => !priorityPending.includes(item));

  function renderConstraintCard(item: Constraint, compactPending = false) {
    const fieldLabel = requirementFields[item.field].label;
    const quoteTurn = item.quote && turns.find((turn) => turn.id === item.sourceTurnId);
    const displayReason = item.reason && item.reason !== GENERIC_UNKNOWN_REASON ? item.reason : null;
    return (
      <article key={item.id} className={compactPending ? 'constraint-chip-card' : 'constraint-item'}>
        <div className="constraint-item-head">
          <div className="constraint-inline-main">
            <span className="constraint-field">{fieldLabel}</span>
            <span className="constraint-value">
              {item.op === 'neq' ? '排除 · ' : ''}
              {describeRequirementValue(
                item.field,
                item.value,
                item.quote ?? (item.state === 'suggested' ? requirement.input.groupSize : null),
                item.quantityScope
              )}
            </span>
          </div>
          {onEdit && editingId !== item.id && !isPendingQuantityBreakdown(item) && (
            <button type="button" className="btn-outline" aria-label={`编辑${fieldLabel}`} onClick={() => setEditingId(item.id)}>
              {item.level === 'pending' ? '补充' : '编辑'}
            </button>
          )}
        </div>
        <p className="constraint-note">
          {sourceLabels[item.state]}{displayReason ? ` · ${displayReason}` : ''}
        </p>
        {quoteTurn && (
          <details className="constraint-quote">
            <summary>查看原话</summary>
            <blockquote>「{item.quote}」</blockquote>
            {quoteTurn.text.trim() !== item.quote && <p>原始记录：{quoteTurn.text}</p>}
          </details>
        )}
        {editingId === item.id && onEdit && (
          <ConstraintEditor key={item.id} item={item} onSave={save} onCancel={() => setEditingId(null)} />
        )}
      </article>
    );
  }

  return (
    <section className="surface-card constraint-panel" aria-labelledby="requirement-constraints-heading">
      <header className="constraint-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 id="requirement-constraints-heading">需求约束</h2>
          <span className="constraint-summary-count">
            已明确 {hardItems.length} · 建议 {prefItems.length}{priorityPending.length > 0 ? ` · 待确认 ${priorityPending.length}` : ''}
          </span>
        </div>
        <span className="meta-badge">{requirement.mode === 'local_rules' ? '本地规则 · 人工确认' : '结构化来源已校验'}</span>
      </header>

      {questions.length > 0 && (
        <div className="constraint-questions">
          <h3>优先追问</h3>
          <ul>{questions.map(({ field, question }) => <li key={field}>{question}</li>)}</ul>
        </div>
      )}
      <div className="constraint-main-grid">
        <section className="constraint-group" aria-label="必须满足">
          <h3>
            <span className="status-dot dot-pass" />
            <span>必须满足</span>
            <span className="constraint-group-count">{hardItems.length}</span>
          </h3>
          {hardItems.length === 0 ? (
            <p className="constraint-note">暂无硬性要求</p>
          ) : (
            <div className="constraint-item-grid">
              {hardItems.map((item) => renderConstraintCard(item))}
            </div>
          )}
        </section>

        <section className="constraint-group" aria-label="偏好与建议">
          <h3>
            <span className="status-dot dot-info" />
            <span>偏好与建议</span>
            <span className="constraint-group-count">{prefItems.length}</span>
          </h3>
          {prefItems.length === 0 ? (
            <p className="constraint-note">暂无补充建议</p>
          ) : (
            <div className="constraint-item-grid">
              {prefItems.map((item) => renderConstraintCard(item))}
            </div>
          )}
        </section>
      </div>

      {pendingItems.length > 0 && (
        <section className="constraint-pending-bar" aria-label="待确认">
          {priorityPending.length > 0 && (
            <>
              <h3>
                <span className="status-dot dot-caution" />
                <span>需优先确认</span>
              </h3>
              <div className="constraint-pending-grid">
                {priorityPending.map((item) => renderConstraintCard(item, true))}
              </div>
            </>
          )}

          {optionalPending.length > 0 && (
            <details className="constraint-more-pending">
              <summary>
                <span>其他未提及字段（{optionalPending.length} 项，按需补充）</span>
                <span className="constraint-more-preview">
                  {optionalPending.slice(0, 5).map((item) => requirementFields[item.field].label).join(' · ')}
                  {optionalPending.length > 5 ? ' …' : ''}
                </span>
              </summary>
              <div className="constraint-pending-grid" style={{ marginTop: 10 }}>
                {optionalPending.map((item) => renderConstraintCard(item, true))}
              </div>
            </details>
          )}
        </section>
      )}

      {onlineReview?.notes.length ? (
        <div className="constraint-questions">
          <h3>在线拆解待核</h3>
          <ul>{onlineReview.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}
      {onlineReview?.questions.length ? (
        <div className="constraint-questions">
          <h3>在线建议追问</h3>
          <ul>{onlineReview.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}
