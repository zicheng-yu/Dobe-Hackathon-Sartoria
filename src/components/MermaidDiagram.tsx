import { useEffect, useId, useState } from 'react';

let mermaidInitialized = false;
let renderSeq = 0;

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            fontFamily:
              "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
            themeVariables: {
              background: '#ffffff',
              primaryColor: '#f7f7f8',
              primaryTextColor: '#111113',
              primaryBorderColor: '#2c2d33',
              secondaryColor: '#efeff2',
              secondaryTextColor: '#111113',
              secondaryBorderColor: '#86878f',
              tertiaryColor: '#fafafa',
              tertiaryTextColor: '#111113',
              tertiaryBorderColor: '#c4c5cc',
              lineColor: '#52535a',
              textColor: '#111113',
              mainBkg: '#f7f7f8',
              nodeBorder: '#2c2d33',
              clusterBkg: '#fafafa',
              clusterBorder: '#d2d3da',
              titleColor: '#111113',
              edgeLabelBackground: '#ffffff',
              actorBkg: '#f7f7f8',
              actorBorder: '#2c2d33',
              actorTextColor: '#111113',
              actorLineColor: '#86878f',
              signalColor: '#2c2d33',
              signalTextColor: '#111113',
              labelBoxBkgColor: '#f7f7f8',
              labelBoxBorderColor: '#c4c5cc',
              labelTextColor: '#111113',
              loopTextColor: '#111113',
              noteBkgColor: '#f4f4f6',
              noteBorderColor: '#c4c5cc',
              noteTextColor: '#3a3b42',
              activationBkgColor: '#ececef',
              activationBorderColor: '#52535a',
              fontSize: '13.5px',
            },
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: 'basis',
              nodeSpacing: 36,
              rankSpacing: 46,
              padding: 14,
            },
            sequence: {
              useMaxWidth: true,
              mirrorActors: false,
              actorMargin: 44,
              messageMargin: 34,
              boxMargin: 12,
              boxTextMargin: 8,
              noteMargin: 10,
            },
          });
          mermaidInitialized = true;
        }

        renderSeq += 1;
        const safeId = `sartoria-mmd-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-${renderSeq}`;
        const { svg: renderedSvg } = await mermaid.render(safeId, chart);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Mermaid render failed');
          setSvg(null);
        }
      }
    }

    void renderChart();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <pre className="doc-code-block">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <figure className="doc-mermaid-card" aria-label="系统架构与流程图">
      {svg ? (
        <div
          className="doc-mermaid-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="doc-mermaid-loading">图表渲染中…</div>
      )}
    </figure>
  );
}
