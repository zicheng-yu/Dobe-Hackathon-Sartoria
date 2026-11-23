import type { ReactNode } from 'react';

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    keyIdx += 1;
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`b-${keyIdx}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={`c-${keyIdx}`} className="doc-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (lm) {
        const label = lm[1];
        const href = lm[2];
        const isExternal = /^https?:\/\//i.test(href);
        nodes.push(
          <a
            key={`a-${keyIdx}`}
            href={href}
            className="doc-link"
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer' : undefined}
          >
            {label}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function MarkdownArticle({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let i = 0;
  let headingCounter = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr-${i}`} className="doc-hr" />);
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const start = i;
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      elements.push(
        <pre key={`code-${start}`} className="doc-code-block">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Headings
    const hMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (hMatch) {
      const level = hMatch[1].length;
      const content = hMatch[2].trim();
      if (level === 1) {
        elements.push(
          <h1 key={`h1-${i}`} className="doc-h1">
            {renderInline(content)}
          </h1>
        );
      } else if (level === 2) {
        headingCounter += 1;
        elements.push(
          <h2 key={`h2-${i}`} id={`sec-${headingCounter}`} className="doc-h2">
            {renderInline(content)}
          </h2>
        );
      } else if (level === 3) {
        headingCounter += 1;
        elements.push(
          <h3 key={`h3-${i}`} id={`sec-${headingCounter}`} className="doc-h3">
            {renderInline(content)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={`h4-${i}`} className="doc-h4">
            {renderInline(content)}
          </h4>
        );
      }
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const start = i;
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      elements.push(
        <blockquote key={`bq-${start}`} className="doc-blockquote">
          {quoteLines.map((ql, idx) => (
            <div key={idx}>{renderInline(ql)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Markdown table
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|?[\s:-]+\|/.test(lines[i + 1].trim())
    ) {
      const start = i;
      const headers = parseTableRow(lines[i]);
      i += 2; // skip header & separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      elements.push(
        <div key={`tbl-${start}`} className="doc-table-wrap">
          <table className="clean-table doc-table">
            <thead>
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx}>{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const start = i;
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${start}`} className="doc-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const start = i;
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${start}`} className="doc-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    const start = i;
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('```') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      lines[i].trim() !== '---'
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    elements.push(
      <p key={`p-${start}`} className="doc-p">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="doc-prose">{elements}</div>;
}
