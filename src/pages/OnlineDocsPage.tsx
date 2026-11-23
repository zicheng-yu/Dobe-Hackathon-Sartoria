import { ArrowRight, ArrowUpRight, Download, Printer } from 'lucide-react';
import { useMemo } from 'react';
import architectureMarkdown from '../../docs/Sartoria-AI-Solution-Architecture.md?raw';
import { MarkdownArticle } from '../components/MarkdownArticle';
import type { WorkspaceTab } from '../components/TopNav';
import { SITE_CONFIG } from '../data/siteConfig';
import { extractDocHeadings } from '../utils/docHeadings';
import { downloadTextFile } from '../utils/exporters';
import type { PortalSection } from '../utils/router';

interface OnlineDocsPageProps {
  onNavigate: (section: PortalSection, demoTab?: WorkspaceTab) => void;
}

export function OnlineDocsPage({ onNavigate }: OnlineDocsPageProps) {
  const headings = useMemo(() => extractDocHeadings(architectureMarkdown), []);

  return (
    <div className="page-wrap">
      <div className="page-head no-print">
        <div>
          <h1 className="page-h1">在线项目介绍文档</h1>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
            与 GitHub 仓库 <code>docs/Sartoria-AI-Solution-Architecture.md</code> 实时同步渲染 · 含「命题逐条响应」与独立《Agent 能力边界清单》
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={`${SITE_CONFIG.githubUrl}/blob/main/docs/Sartoria-AI-Solution-Architecture.md`}
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
            style={{ textDecoration: 'none' }}
          >
            <span>GitHub 源文件</span>
            <ArrowUpRight size={14} />
          </a>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                'Sartoria-AI-项目说明与命题响应文档.md',
                architectureMarkdown,
                'text/markdown;charset=utf-8'
              )
            }
          >
            <Download size={14} />
            <span>下载 Markdown</span>
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={14} />
            <span>打印 / PDF</span>
          </button>
          <button
            type="button"
            className="btn-black"
            onClick={() => onNavigate('demo', 'requirements')}
          >
            <span>进入在线 Demo</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <div className="docs-layout">
        <aside className="docs-toc no-print" aria-label="文档目录">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 10 }}>
            文档目录
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={`docs-toc-link ${h.level === 3 ? 'sub' : ''}`}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </aside>

        <article className="dossier-sheet docs-article">
          <MarkdownArticle markdown={architectureMarkdown} />
        </article>
      </div>
    </div>
  );
}
