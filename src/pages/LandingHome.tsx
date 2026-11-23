import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  FileCode2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceTab } from '../components/TopNav';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { PRESET_DEMO_CASES } from '../data/presetDemos';
import { SITE_CONFIG } from '../data/siteConfig';
import type { PortalSection } from '../utils/router';

interface LandingHomeProps {
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
  onLaunchPresetDemo: (presetId: string) => void;
  onOpenBoundaryModal: () => void;
}

export function LandingHome({
  onNavigate,
  onLaunchPresetDemo,
  onOpenBoundaryModal,
}: LandingHomeProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyUrl = (key: string, url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const deliverables = [
    {
      key: 'demo',
      badge: '01 · 在线 Demo',
      title: '交互式企划辅助工作台',
      url: `${SITE_CONFIG.siteUrl}/demo`,
      desc: '完整跑通自然语言拆解、三分栏边界、四类静态资产检索选配、方案初稿、三镜头提示词包与可编辑导出台账。',
      icon: Sparkles,
      cta: '进入在线 Demo',
      onClick: () => onNavigate('demo', 'requirements'),
    },
    {
      key: 'video',
      badge: '02 · 3 分钟 Demo 视频',
      title: '公开演示视频与分镜剧本',
      url: `${SITE_CONFIG.siteUrl}/video`,
      desc: '聚焦官方案例六（交领开襟真丝暗纹外套）主 Demo 与案例三（两件式舞台演出套装）对比演示。',
      icon: PlayCircle,
      cta: '打开视频页',
      onClick: () => onNavigate('video'),
    },
    {
      key: 'docs',
      badge: '03 · 在线项目介绍文档',
      title: '完整架构与命题逐条响应',
      url: `${SITE_CONFIG.siteUrl}/docs`,
      desc: '直接同步渲染仓库主说明文档：含上服命题逐条响应、静态数据声明、业务闭环与独立《Agent 能力边界清单》。',
      icon: BookOpen,
      cta: '阅读在线文档',
      onClick: () => onNavigate('docs'),
    },
    {
      key: 'github',
      badge: '04 · GitHub 开源仓库',
      title: 'zicheng-yu/Dobe-Hackathon-Sartoria',
      url: SITE_CONFIG.githubUrl,
      desc: '全部源码、静态模拟资产库、Vitest 核心引擎测试与架构文档；已与 Cloudflare Workers Builds 同步自动部署。',
      icon: FileCode2,
      cta: '访问 GitHub 仓库',
      external: SITE_CONFIG.githubUrl,
    },
  ];

  const pipelineSteps: Array<{
    step: string;
    title: string;
    desc: string;
    tab: WorkspaceTab;
  }> = [
    {
      step: '01',
      title: '需求拆解与三类信息分离',
      desc: '8 项专业转译 + 6 维雷达，严格分开「用户明确 / 系统建议 / 待人工核实」，不代客定色、不凭空报松量数。',
      tab: 'requirements',
    },
    {
      step: '02',
      title: '四类静态资产检索与选配',
      desc: `检索版型(${PATTERNS.length})、面料(${FABRICS.length})、工艺(${CRAFTS.length})、历史案例(${HISTORICAL_CASES.length})，实时触发可行性护栏。`,
      tab: 'configurator',
    },
    {
      step: '03',
      title: '方案初稿与三镜头视觉包',
      desc: '输出带资产编码依据、三维选料依据的方案初稿 + 成衣/细节/上身氛围绘图提示词包（不接生图 API）。',
      tab: 'proposal',
    },
    {
      step: '04',
      title: '可编辑、可追溯业务台账',
      desc: '完整回看原始需求、四类匹配资源与人工修改前后 Diff，一键导出 UTF-8 CSV / JSON / 打印报告。',
      tab: 'ledger',
    },
  ];

  const primaryCase = PRESET_DEMO_CASES[0];
  const stageCase = PRESET_DEMO_CASES[1];

  return (
    <div className="page-wrap">
      {/* Hero */}
      <section className="portal-hero">
        <div className="portal-hero-text">
          <span className="tag-minimal" style={{ marginBottom: 14 }}>
            {SITE_CONFIG.trackLabel}
          </span>
          <h1 className="portal-h1">
            Sartoria AI
            <span className="portal-h1-sub">海派高定与团体职业服 AI 企划辅助 Agent</span>
          </h1>
          <p className="portal-lead">
            面向定制业务专员、职业服方案设计师与高定企划人员，用 100% 静态模拟定制资产跑通
            「自然语言需求拆解 → 四类资产匹配与场景选配 → 带依据方案初稿与三镜头视觉提示词包 → 可编辑可追溯业务台账」
            前期企划闭环。
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
            <button
              type="button"
              className="btn-black"
              onClick={() => onNavigate('demo', 'requirements')}
            >
              <span>立即体验在线 Demo</span>
              <ArrowRight size={15} />
            </button>
            <button type="button" className="btn-outline" onClick={() => onNavigate('docs')}>
              <BookOpen size={14} />
              <span>在线项目说明文档</span>
            </button>
            <button type="button" className="btn-outline" onClick={() => onNavigate('video')}>
              <PlayCircle size={14} />
              <span>3 分钟演示视频</span>
            </button>
            <button type="button" className="btn-outline" onClick={onOpenBoundaryModal}>
              <ShieldCheck size={14} />
              <span>Agent 能力边界清单</span>
            </button>
          </div>
        </div>

        <div className="portal-hero-visual">
          <img
            src="/assets/official1-studio-jacket.jpg"
            alt="Sartoria AI 海派定制企划参考"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div className="portal-hero-caption">
            <strong>静态模拟原型 · 零生产系统直连</strong>
            <span>不做正式报价 / CAD 定版 / 签约 / 打样 / 下单 · 不接外部绘图 API</span>
          </div>
        </div>
      </section>

      {/* 4 Deliverables Hub */}
      <section style={{ marginTop: 40 }} aria-label="初筛提交四大入口">
        <div className="portal-sec-head">
          <div>
            <h2 className="portal-h2">作品提交四大入口（Cloudflare × GitHub 自动同步）</h2>
            <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
              统一托管于 <code>sartoria.zichengyu.com</code>，仓库 <code>main</code> 分支更新后自动构建发布
            </p>
          </div>
        </div>

        <div className="deliverable-4-grid">
          {deliverables.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="surface-card deliverable-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="tag-minimal">{item.badge}</span>
                  <Icon size={16} color="#6e6e73" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>{item.title}</h3>
                <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6, marginTop: 6 }}>
                  {item.desc}
                </p>
                <div className="deliverable-url-row">
                  <code className="doc-inline-code" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.url}
                  </code>
                  <button
                    type="button"
                    className="util-btn"
                    title="复制链接"
                    onClick={() => handleCopyUrl(item.key, item.url)}
                  >
                    {copiedKey === item.key ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                  {item.external ? (
                    <a
                      href={item.external}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline"
                      style={{ width: '100%', textDecoration: 'none' }}
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

      {/* End-to-End Pipeline */}
      <section style={{ marginTop: 40 }} aria-label="核心企划闭环">
        <div className="portal-sec-head">
          <h2 className="portal-h2">一条线跑通前期企划闭环</h2>
        </div>

        <div className="pipeline-4-grid">
          {pipelineSteps.map((s) => (
            <button
              key={s.step}
              type="button"
              className="surface-card pipeline-card"
              onClick={() => onNavigate('demo', s.tab)}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
                STEP {s.step}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{s.title}</div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6, marginTop: 6 }}>
                {s.desc}
              </p>
              <span className="btn-text" style={{ marginTop: 10 }}>
                <span>直达该工作区</span>
                <ArrowRight size={13} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Demo Cases */}
      <section style={{ marginTop: 40 }} aria-label="主推官方案例演示">
        <div className="portal-sec-head">
          <h2 className="portal-h2">一键进入标杆演示案例</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
          {[primaryCase, stageCase].map((demo) => (
            <div key={demo.id} className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="tag-minimal">{demo.badge}</span>
                <span className={`prov-pill ${demo.colorSpecifiedByUser ? 'prov-user' : 'prov-human'}`}>
                  {demo.colorSpecifiedByUser ? '已表达色彩方向' : '未指定颜色 · 不代客定色'}
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{demo.title}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                “{demo.input.rawNarrative}”
              </p>
              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                onClick={() => onLaunchPresetDemo(demo.id)}
              >
                <span>在 Demo 中打开该案例</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
