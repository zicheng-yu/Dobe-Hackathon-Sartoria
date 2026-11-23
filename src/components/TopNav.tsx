import { ArrowUpRight, Cpu, ShieldCheck } from 'lucide-react';
import { SITE_CONFIG } from '../data/siteConfig';
import type { LlmSettings } from '../types/sartoria';
import type { PortalSection } from '../utils/router';

export type WorkspaceTab = 'requirements' | 'configurator' | 'proposal' | 'knowledge' | 'ledger';

interface TopNavProps {
  activeSection: PortalSection;
  activeTab: WorkspaceTab;
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
  llmSettings: LlmSettings;
  ledgerCount: number;
  onOpenLlmModal: () => void;
  onOpenBoundaryModal: () => void;
}

const PORTAL_ITEMS: Array<{ id: PortalSection; label: string }> = [
  { id: 'home', label: '官网总览' },
  { id: 'demo', label: '在线 Demo' },
  { id: 'video', label: '演示视频' },
  { id: 'docs', label: '项目文档' },
];

const DEMO_NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'requirements', label: '01 需求拆解' },
  { id: 'configurator', label: '02 场景选配' },
  { id: 'proposal', label: '03 方案与提示词' },
  { id: 'knowledge', label: '04 资产库' },
  { id: 'ledger', label: '05 业务台账' },
];

export function TopNav({
  activeSection,
  activeTab,
  onNavigate,
  llmSettings,
  ledgerCount,
  onOpenLlmModal,
  onOpenBoundaryModal,
}: TopNavProps) {
  return (
    <div className="nav-shell no-print">
      <header className="top-nav">
        <button
          type="button"
          className="brand-wordmark brand-btn"
          onClick={() => onNavigate('home')}
          aria-label="返回 Sartoria AI 官网总览"
        >
          <span className="brand-name">SARTORIA</span>
          <span className="brand-dot">AI · 海派定制</span>
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
          <a
            href={SITE_CONFIG.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="nav-link nav-link-ext"
          >
            <span>GitHub</span>
            <ArrowUpRight size={12} />
          </a>
        </nav>

        <div className="nav-utilities">
          {activeSection === 'demo' && (
            <button type="button" className="util-btn" onClick={onOpenLlmModal}>
              <Cpu size={14} strokeWidth={1.6} />
              <span>{llmSettings.enabled && llmSettings.apiKey ? 'LLM 模式' : '本地引擎'}</span>
            </button>
          )}
          <button type="button" className="util-btn" onClick={onOpenBoundaryModal}>
            <ShieldCheck size={14} strokeWidth={1.6} />
            <span>能力边界</span>
          </button>
        </div>
      </header>

      {activeSection === 'demo' && (
        <div className="demo-subnav" role="navigation" aria-label="Demo 工作区导航">
          <div className="demo-subnav-inner">
            {DEMO_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`subnav-tab ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onNavigate('demo', item.id)}
              >
                <span>{item.label}</span>
                {item.id === 'ledger' && <span className="nav-count">{ledgerCount}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
