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
        <h1 className="page-h1">项目文档</h1>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={`${SITE_CONFIG.githubUrl}/blob/main/docs/Sartoria-AI-Solution-Architecture.md`}
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
          >
            <span>GitHub 源文件</span>
            <ArrowUpRight size={14} />
          </a>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                'Sartoria-AI-系统架构与产品说明文档.md',
                architectureMarkdown,
                'text/markdown;charset=utf-8'
              )
            }
          >
            <Download size={14} />
            <span>下载 MD</span>
          </button>
          <button type="button" className="btn-outline" onClick={() => window.print()}>
            <Printer size={14} />
            <span>打印</span>
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
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 10 }}>
            目录
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
