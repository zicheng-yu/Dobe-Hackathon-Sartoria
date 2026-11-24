import { RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { EngineMode, WorkerLlmStatus } from '../types/sartoria';

interface LlmConfigModalProps {
  open: boolean;
  engineMode: EngineMode;
  workerStatus: WorkerLlmStatus | null;
  isRefreshing: boolean;
  onChangeMode: (mode: EngineMode) => void;
  onRefreshStatus: () => void;
  onClose: () => void;
}

export function LlmConfigModal({
  open,
  engineMode,
  workerStatus,
  isRefreshing,
  onChangeMode,
  onRefreshStatus,
  onClose,
}: LlmConfigModalProps) {
  if (!open) return null;

  const quota = workerStatus?.quota ?? null;
  const onlineAvailable = Boolean(workerStatus?.configured && quota && !quota.budget.exhausted);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="llm-title">
      <div className="modal-panel" style={{ maxWidth: 520 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <h2 id="llm-title" style={{ fontSize: 16, fontWeight: 590 }}>
            解析引擎设置
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="util-btn"
              onClick={onRefreshStatus}
              disabled={isRefreshing}
              aria-label="刷新服务状态"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
              <span>刷新</span>
            </button>
            <button type="button" className="util-btn" onClick={onClose} aria-label="关闭">
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            className={`apple-option ${engineMode === 'online_worker' ? 'selected' : ''}`}
            onClick={() => onChangeMode('online_worker')}
          >
            <div>
              <div className="apple-option-title">
                <span>在线智能引擎</span>
                <span className="rec-tag">云端</span>
              </div>
              <div className="apple-option-sub">云端语义解析 · 结构化输出</div>
            </div>
          </button>

          <button
            type="button"
            className={`apple-option ${engineMode === 'local_rules' ? 'selected' : ''}`}
            onClick={() => onChangeMode('local_rules')}
          >
            <div>
              <div className="apple-option-title">
                <span>本地规则引擎</span>
                <span className="rec-tag">离线</span>
              </div>
              <div className="apple-option-sub">零配额消耗 · 离线随时可用</div>
            </div>
          </button>
        </div>

        <div className="notice-row" style={{ marginBottom: 16 }}>
          <ShieldCheck size={15} color="var(--ink-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {workerStatus === null
              ? '当前处于本地预览模式，默认使用本地规则引擎。'
              : workerStatus.configured
                ? '在线语义服务已就绪，凭据由服务端安全托管，浏览器不接触任何密钥。'
                : '在线服务暂未启用，可继续使用本地规则引擎。'}
          </span>
        </div>

        {quota && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div className="sub-card">
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>今日剩余</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 590,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {quota.visitor.remaining} / {quota.visitor.limit}
                </div>
              </div>

              <div className="sub-card">
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>全站今日已用</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 590,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {quota.site.used} / {quota.site.limit}
                </div>
              </div>

              <div className="sub-card">
                <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>项目累计预算</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 590,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${quota.budget.spentUsd.toFixed(4)} / ${quota.budget.limitUsd}
                </div>
              </div>
            </div>

            <div className="sub-card" style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.65 }}>
              <div>日配额重置：{quota.resetAt}（Asia/Shanghai 每日 00:00）</div>
              <div>累计记录：{quota.totalLoggedCalls} 次云端解析调用</div>
            </div>

            {!onlineAvailable && engineMode === 'online_worker' && (
              <div className="notice-row">
                <span className="status-dot dot-caution" />
                <span>
                  {quota.budget.exhausted
                    ? '项目预算已达上限，请切换为本地规则引擎继续使用。'
                    : '在线服务暂未就绪，建议切换为本地规则引擎。'}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn-black" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
