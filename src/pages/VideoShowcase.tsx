import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  PlayCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { WorkspaceTab } from '../components/TopNav';
import { SITE_CONFIG } from '../data/siteConfig';
import type { PortalSection } from '../utils/router';

interface VideoShowcaseProps {
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
}

const DEMO_SCRIPT_CHAPTERS: Array<{
  time: string;
  startSec: number;
  title: string;
  detail: string;
  tab: WorkspaceTab;
}> = [
  {
    time: '0:00 – 0:16',
    startSec: 0,
    title: '上海服装集团前期企划场景',
    detail: '聚焦海派高定与团体职业服前期企划痛点，从 Sartoria 官网门户进入全流程交互工作台。',
    tab: 'requirements',
  },
  {
    time: '0:16 – 1:32',
    startSec: 16,
    title: '团装需求拆解、选配与改稿冲突裁决',
    detail: '60 套秋季会务团装从口语拆解、逐字出处、方案对比与 3D/版型图联动，到改稿冲突拦截并确认 V2。',
    tab: 'configurator',
  },
  {
    time: '1:32 – 2:21',
    startSec: 92,
    title: '官方案例六边界守护、方案初稿与三镜头提示词',
    detail: '演示未指定不代定色、宽肩体态工学转译、单行合并改稿差异、同面料标题消歧与三镜头视觉提示词。',
    tab: 'proposal',
  },
  {
    time: '2:21 – 2:51',
    startSec: 141,
    title: '项目档案、可追溯交接导出与工程验收',
    detail: '全宽项目档案对照 V1/V2 变更，导出 Markdown 与 JSON 交接包并刷新验证持久化，明确人机边界。',
    tab: 'ledger',
  },
];

export function VideoShowcase({ onNavigate }: VideoShowcaseProps) {
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { video } = SITE_CONFIG;
  const hasVideo = Boolean(video.embedUrl || video.localMp4Path || video.externalUrl);
  const pageUrl = `${SITE_CONFIG.siteUrl}/video`;

  const handleSeekToChapter = (sec: number) => {
    const el = videoRef.current;
    if (!el) return;
    const seekAndPlay = () => {
      el.currentTime = sec;
      el.play().catch(() => {});
    };
    if (el.readyState < 1) {
      el.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      el.load();
      return;
    }
    seekAndPlay();
  };

  return (
    <div className="page-wrap">
      <div className="page-head">
        <h1 className="page-h1">演示视频</h1>
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
            <span>{copied ? '已复制链接' : '复制链接'}</span>
          </button>
          <button
            type="button"
            className="btn-black"
            onClick={() => onNavigate('demo', 'requirements')}
          >
            <span>体验在线 Demo</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

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
              ref={videoRef}
              controls
              playsInline
              preload="metadata"
              poster={video.posterPath || '/assets/official1-studio-jacket.jpg'}
              style={{ width: '100%', height: '100%', borderRadius: 12, background: '#ffffff' }}
            >
              <source src={video.localMp4Path} type="video/mp4" />
            </video>
          </div>
        ) : (
          <div className="video-placeholder-frame">
            <img
              src="/assets/official1-studio-jacket.jpg"
              alt="Sartoria AI 演示视频封面"
              className="video-placeholder-bg"
            />
            <div className="video-placeholder-overlay">
              <PlayCircle size={48} strokeWidth={1.4} />
              <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>{video.title}</h2>
              <p style={{ fontSize: 13.5, opacity: 0.88, maxWidth: 520, textAlign: 'center', marginTop: 10, lineHeight: 1.65 }}>
                上传公开演示视频后，在 <code>src/data/siteConfig.ts</code> 配置直链即可在此播放。
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-black"
                  style={{ background: '#ffffff', color: '#111111', borderColor: '#ffffff' }}
                  onClick={() => onNavigate('demo', 'requirements')}
                >
                  <span>进入在线 Demo</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {hasVideo && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--border-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="tag-minimal" style={{ fontFamily: 'var(--font-mono)' }}>
                {video.durationLabel} · 1080P
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>{video.subtitle}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {video.localMp4Path && (
                <a
                  href={video.localMp4Path}
                  download="sartoria-demo-3min.mp4"
                  className="btn-outline"
                >
                  <Download size={14} />
                  <span>下载 MP4</span>
                </a>
              )}
              {video.externalUrl && (
                <a
                  href={video.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline"
                >
                  <span>打开原视频</span>
                  <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="surface-card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 14 }}>演示章节</h2>
        <div className="video-chapters-grid">
          {DEMO_SCRIPT_CHAPTERS.map((ch, idx) => (
            <div
              key={ch.time}
              className="ledger-block"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
                padding: 18,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {video.localMp4Path ? (
                    <button
                      type="button"
                      className="tag-minimal"
                      style={{ fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                      onClick={() => handleSeekToChapter(ch.startSec)}
                      title={`跳转至 ${ch.time}`}
                    >
                      {ch.time}
                    </button>
                  ) : (
                    <span className="tag-minimal" style={{ fontFamily: 'var(--font-mono)' }}>
                      {ch.time}
                    </span>
                  )}
                </div>
                <strong style={{ display: 'block', fontSize: 14, lineHeight: 1.45 }}>
                  {ch.title}
                </strong>
                <p
                  style={{
                    fontSize: 12.8,
                    color: 'var(--ink-secondary)',
                    marginTop: 8,
                    lineHeight: 1.65,
                  }}
                >
                  {ch.detail}
                </p>
              </div>
              <button
                type="button"
                className="btn-text"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => onNavigate('demo', ch.tab)}
              >
                <span>前往该步骤</span>
                <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
