import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  FileCode2,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceTab } from '../components/TopNav';
import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SITE_CONFIG } from '../data/siteConfig';
import type { PortalSection } from '../utils/router';

interface LandingHomeProps {
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
  onLaunchPresetDemo: (presetId: string) => void;
}

export function LandingHome({
  onNavigate,
  onLaunchPresetDemo,
}: LandingHomeProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyUrl = (key: string, url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const pipelineSteps: Array<{
    step: string;
    title: string;
    desc: string;
    tab: WorkspaceTab;
  }> = [
    {
      step: '01',
      title: '需求拆解',
      desc: '自然语言转译 8 项专业参数，区分事实、建议与人工核实。',
      tab: 'requirements',
    },
    {
      step: '02',
      title: '场景选配',
      desc: '联动检索版型、面料、工艺与历史案例，实时触发可行性提示。',
      tab: 'configurator',
    },
    {
      step: '03',
      title: '定制方案',
      desc: '生成带搭配依据的方案初稿及成衣、细节、上身三镜头提示词。',
      tab: 'proposal',
    },
    {
      step: '04',
      title: '项目档案',
      desc: '回看原始需求与变更轨迹，支持在线复核编辑与 CSV / JSON 导出。',
      tab: 'ledger',
    },
  ];

  const deliverables = [
    {
      key: 'demo',
      title: '在线 Demo',
      desc: '端到端交互式企划辅助工作台',
      url: `${SITE_CONFIG.siteUrl}/demo`,
      icon: Sparkles,
      cta: '进入工作台',
      onClick: () => onNavigate('demo', 'requirements'),
    },
    {
      key: 'video',
      title: '演示视频',
      desc: '3 分钟完整闭环与双案例演示',
      url: `${SITE_CONFIG.siteUrl}/video`,
      icon: PlayCircle,
      cta: '观看视频',
      onClick: () => onNavigate('video'),
    },
    {
      key: 'docs',
      title: '项目文档',
      desc: '系统架构与设计方案说明',
      url: `${SITE_CONFIG.siteUrl}/docs`,
      icon: BookOpen,
      cta: '阅读文档',
      onClick: () => onNavigate('docs'),
    },
    {
      key: 'github',
      title: 'GitHub 源码',
      desc: '完整前端代码、静态资产与测试',
      url: SITE_CONFIG.githubUrl,
      icon: FileCode2,
      cta: '查看仓库',
      external: SITE_CONFIG.githubUrl,
    },
  ];

  const primaryCase = PRESET_DEMO_CASES[0];
  const stageCase = PRESET_DEMO_CASES[1];

  return (
    <div className="page-wrap">
      {/* Clean Editorial Hero */}
      <section className="portal-hero">
        <div className="portal-hero-text">
          <h1 className="portal-h1">Sartoria</h1>
          <p className="portal-lead">
            海派高定与团体职业服企划工作台。将自然语言需求转化为定制参数、场景搭配方案与可追溯项目档案。
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
            <button
              type="button"
              className="btn-black"
              onClick={() => onNavigate('demo', 'requirements')}
            >
              <span>进入在线 Demo</span>
              <ArrowRight size={15} />
            </button>
            <button type="button" className="btn-outline" onClick={() => onNavigate('docs')}>
              <span>项目文档</span>
            </button>
            <button type="button" className="btn-outline" onClick={() => onNavigate('video')}>
              <span>演示视频</span>
            </button>
          </div>
        </div>

        <div className="portal-hero-visual">
          <img
            src="/assets/official1-studio-jacket.jpg"
            alt="Sartoria AI 海派定制企划参考"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </section>

      {/* 4-Step Pipeline */}
      <section className="portal-sec" aria-label="企划流程">
        <h2 className="portal-h2">企划流程</h2>
        <div className="pipeline-4-grid">
          {pipelineSteps.map((s) => (
            <button
              key={s.step}
              type="button"
              className="surface-card pipeline-card"
              onClick={() => onNavigate('demo', s.tab)}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
                {s.step}
              </span>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</div>
              <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Cases */}
      <section className="portal-sec" aria-label="标杆案例">
        <h2 className="portal-h2">快速体验案例</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {[primaryCase, stageCase].map((demo) => (
            <div key={demo.id} className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 16.5, fontWeight: 600 }}>{demo.title}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', lineHeight: 1.65 }}>
                {demo.subtitle}
              </p>
              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                onClick={() => onLaunchPresetDemo(demo.id)}
              >
                <span>在 Demo 中体验</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Deliverables Hub */}
      <section className="portal-sec" aria-label="作品入口">
        <h2 className="portal-h2">作品入口</h2>
        <div className="deliverable-4-grid">
          {deliverables.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="surface-card deliverable-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Icon size={18} color="#111111" strokeWidth={1.7} />
                  <button
                    type="button"
                    className="util-btn"
                    title="复制链接"
                    aria-label={`复制${item.title}链接`}
                    onClick={() => handleCopyUrl(item.key, item.url)}
                  >
                    {copiedKey === item.key ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>{item.desc}</p>

                <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                  {item.external ? (
                    <a
                      href={item.external}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline"
                      style={{ width: '100%' }}
                    >
                      <span>{item.cta}</span>
                      <ArrowUpRight size={14} />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={item.key === 'demo' ? 'btn-black' : 'btn-outline'}
                      style={{ width: '100%' }}
                      onClick={item.onClick}
                    >
                      <span>{item.cta}</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
