import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  PlayCircle,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import type { WorkspaceTab } from '../components/TopNav';
import { SITE_CONFIG } from '../data/siteConfig';
import type { PortalSection } from '../utils/router';

interface VideoShowcaseProps {
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
}

const DEMO_SCRIPT_CHAPTERS: Array<{
  time: string;
  title: string;
  detail: string;
  tab: WorkspaceTab;
}> = [
  {
    time: '0:00 – 0:40',
    title: '需求录入、8 项转译与三类信息分离（官方案例六）',
    detail:
      '输入高个肩背宽厚、不压肩不卡手臂的口述需求；展示 8 项专业参数、6 维雷达与「用户明确 / 系统建议 / 还要人工核实」三分栏，强调未指定颜色绝不代客定色、松量不凭空报厘米数。',
    tab: 'requirements',
  },
  {
    time: '0:40 – 1:30',
    title: '四类静态模拟资产检索与交互选配（含案例三对比）',
    detail:
      '展示版型 / 面料 / 工艺 / 历史案例四类静态资产匹配依据、选料三维判断依据（风格/体感/体型）、3D 面料光泽与 SVG 结构示意图，并演示案例三两件式演出套装差异与可行性护栏。',
    tab: 'configurator',
  },
  {
    time: '1:30 – 2:15',
    title: '带依据方案初稿与三镜头视觉需求包',
    detail:
      '一键生成含资产编码依据、六步人机边界与人工终审清单的方案初稿，以及成衣/细节/上身氛围三镜头 Midjourney / Flux / 即梦提示词包（明示不接生图 API、支持导出 MD）。',
    tab: 'proposal',
  },
  {
    time: '2:15 – 3:00',
    title: '业务台账回看、在线编辑 Diff 追踪与 CSV/JSON 导出',
    detail:
      '在台账中回看原始需求与四类匹配资产，修改复核状态与备注并保存生成前后变更轨迹，一键导出 UTF-8 CSV 台账，最后打开「能力边界」重申零报价/定版/下单红线。',
    tab: 'ledger',
  },
];

export function VideoShowcase({ onNavigate }: VideoShowcaseProps) {
  const [copied, setCopied] = useState(false);
  const { video } = SITE_CONFIG;
  const hasVideo = Boolean(video.embedUrl || video.localMp4Path || video.externalUrl);

  const pageUrl = `${SITE_CONFIG.siteUrl}/video`;

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1 className="page-h1">3 分钟 Demo 演示视频</h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
            {video.subtitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              navigator.clipboard?.writeText(video.externalUrl || pageUrl).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? '已复制视频链接' : '复制视频页链接'}</span>
          </button>
          <button
            type="button"
            className="btn-black"
            onClick={() => onNavigate('demo', 'requirements')}
          >
            <span>同步打开在线 Demo</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Main 16:9 Player / Ready Placeholder */}
      <section className="surface-card" style={{ padding: 20 }}>
        {video.embedUrl ? (
          <div className="video-frame-16-9">
            <iframe
              src={video.embedUrl}
              title={video.title}
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
            />
          </div>
        ) : video.localMp4Path ? (
          <div className="video-frame-16-9">
            <video
              controls
              playsInline
              poster="/assets/official1-studio-jacket.jpg"
              style={{ width: '100%', height: '100%', borderRadius: 12, background: '#111' }}
            >
              <source src={video.localMp4Path} type="video/mp4" />
            </video>
          </div>
        ) : (
          <div className="video-placeholder-frame">
            <img
              src="/assets/official1-studio-jacket.jpg"
              alt="Sartoria AI Demo 视频封面"
              className="video-placeholder-bg"
            />
            <div className="video-placeholder-overlay">
              <PlayCircle size={48} strokeWidth={1.4} />
              <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 10 }}>{video.title}</h2>
              <p style={{ fontSize: 13, opacity: 0.9, maxWidth: 620, textAlign: 'center', lineHeight: 1.65 }}>
                视频录制并上传至 B 站 / 腾讯视频 / YouTube（公开无密码直链）后，在{' '}
                <code>src/data/siteConfig.ts</code> 填入 <code>externalUrl</code> /{' '}
                <code>embedUrl</code>（或放入 <code>public/video/</code>）推送至 GitHub{' '}
                <code>main</code>，Cloudflare Workers Builds 将自动构建并更新本页面。
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-black"
                  style={{ background: '#ffffff', color: '#111111', borderColor: '#ffffff' }}
                  onClick={() => onNavigate('demo', 'requirements')}
                >
                  <span>先直接体验在线 Demo</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)' }}
                  onClick={() => onNavigate('docs')}
                >
                  <span>查看项目说明文档</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {hasVideo && video.externalUrl && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
              <Video size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              公开直链：{video.externalUrl}
            </span>
            <a
              href={video.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
              style={{ textDecoration: 'none' }}
            >
              <span>在新标签页打开原视频</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        )}
      </section>

      {/* 3-Minute Chapter Timeline + Submission Verification Checklist */}
      <div className="deconstruct-grid" style={{ marginTop: 24 }}>
        <section className="surface-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>3 分钟演示分镜与对应工作区</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DEMO_SCRIPT_CHAPTERS.map((ch) => (
              <div key={ch.time} className="ledger-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{ch.title}</strong>
                  <span className="tag-minimal" style={{ fontFamily: 'var(--font-mono)' }}>
                    {ch.time}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                  {ch.detail}
                </p>
                <button
                  type="button"
                  className="btn-text"
                  style={{ marginTop: 6 }}
                  onClick={() => onNavigate('demo', ch.tab)}
                >
                  <span>前往该演示步骤</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>初筛视频发布核验清单</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {video.hostingChecklist.map((item) => (
              <div key={item} className="feas-bar feas-pass">
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="ledger-block" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>本页支持的公开路由</div>
            <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.7 }}>
              <div>
                标准视频页：<code>{SITE_CONFIG.siteUrl}/video</code>
              </div>
              <div>
                兼容别名路由：<code>{SITE_CONFIG.siteUrl}/vedio</code>（自动平滑指向视频页）
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
