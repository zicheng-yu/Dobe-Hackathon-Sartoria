import { ArrowUpRight, Check, Cpu, Layers } from 'lucide-react';
import { SITE_CONFIG } from '../data/siteConfig';
import type { EngineMode, WorkerLlmStatus } from '../types/sartoria';
import type { PortalSection } from '../utils/router';

export type WorkspaceTab = 'requirements' | 'configurator' | 'proposal' | 'knowledge' | 'ledger';
export type FlowStepTab = 'requirements' | 'configurator' | 'proposal' | 'ledger';

export type CompletedSteps = Record<FlowStepTab, boolean>;

interface TopNavProps {
  activeSection: PortalSection;
  activeTab: WorkspaceTab;
  completedSteps: CompletedSteps;
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
  engineMode: EngineMode;
  workerStatus: WorkerLlmStatus | null;
  ledgerCount: number;
  onOpenLlmModal: () => void;
}

const PORTAL_ITEMS: Array<{ id: PortalSection; label: string }> = [
  { id: 'home', label: '首页' },
  { id: 'demo', label: '在线 Demo' },
  { id: 'video', label: '演示视频' },
  { id: 'docs', label: '项目文档' },
];

const PIPELINE_STEPS: Array<{ id: FlowStepTab; num: string; label: string }> = [
  { id: 'requirements', num: '1', label: '需求拆解' },
  { id: 'configurator', num: '2', label: '场景选配' },
  { id: 'proposal', num: '3', label: '定制方案' },
  { id: 'ledger', num: '4', label: '项目档案' },
];

export function TopNav({
  activeSection,
  activeTab,
  completedSteps,
  onNavigate,
  engineMode,
  workerStatus,
  ledgerCount,
  onOpenLlmModal,
}: TopNavProps) {
  const isOnlineActive = engineMode === 'online_worker' && Boolean(workerStatus?.configured);
  const remainingText =
    isOnlineActive && workerStatus?.quota
      ? `智能引擎 · ${workerStatus.quota.visitor.remaining}/${workerStatus.quota.visitor.limit}`
      : engineMode === 'online_worker'
        ? '智能引擎'
        : '本地规则';
  const activeStepIndex = PIPELINE_STEPS.findIndex((s) => s.id === activeTab);

  return (
    <div className="nav-shell no-print">
      <header className="top-nav">
        <button
          type="button"
          className="brand-wordmark brand-btn"
          onClick={() => onNavigate('home')}
          aria-label="返回 Sartoria 首页"
        >
          <span className="brand-name">SARTORIA</span>
        </button>

        <nav className="nav-links" aria-label="站点主导航">
          {PORTAL_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id, item.id === 'demo' ? activeTab : undefined)}
            >
              <span>{item.label}</span>
            </button>
          ))}
          <a href={SITE_CONFIG.githubUrl} target="_blank" rel="noreferrer" className="nav-link">
            <span>GitHub</span>
            <ArrowUpRight size={12} />
          </a>
        </nav>

        <div className="nav-utilities">
          {activeSection === 'demo' && (
            <button type="button" className="util-btn" onClick={onOpenLlmModal}>
              <Cpu size={14} strokeWidth={1.6} />
              <span>{remainingText}</span>
            </button>
          )}
        </div>
      </header>

      {activeSection === 'demo' && (
        <div className="demo-stepper-bar" role="navigation" aria-label="企划流程步骤">
          <div className="demo-stepper-inner">
            <div className="stepper-track">
              {PIPELINE_STEPS.map((step, index) => {
                const isActive = activeTab === step.id;
                const isDone = completedSteps[step.id] || (activeStepIndex > -1 && index < activeStepIndex);
                const prevDone =
                  index > 0 &&
                  (completedSteps[PIPELINE_STEPS[index - 1].id] ||
                    (activeStepIndex > -1 && index - 1 < activeStepIndex));
                const connectorFilled = (activeStepIndex >= index && activeStepIndex > -1) || (prevDone && isDone);

                return (
                  <div key={step.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {index > 0 && (
                      <span
                        className={`stepper-connector ${connectorFilled ? 'filled' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                    <button
                      type="button"
                      className={`stepper-node ${isActive ? 'active' : isDone ? 'completed' : ''}`}
                      aria-current={isActive ? 'step' : undefined}
                      onClick={() => onNavigate('demo', step.id)}
                    >
                      <span className="stepper-circle">
                        {isDone && !isActive ? <Check size={11} strokeWidth={2.5} /> : step.num}
                      </span>
                      <span>{step.label}</span>
                      {step.id === 'ledger' && (
                        <span className="stepper-count">{ledgerCount}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="stepper-aside">
              <button
                type="button"
                className={`stepper-ref-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
                onClick={() => onNavigate('demo', 'knowledge')}
              >
                <Layers size={13} strokeWidth={1.8} />
                <span>资产库</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
