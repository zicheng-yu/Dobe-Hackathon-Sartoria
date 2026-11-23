export interface DocHeading {
  id: string;
  level: 2 | 3;
  text: string;
}

export function extractDocHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const lines = markdown.split(/\r?\n/);
  let inCode = false;
  let counter = 0;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (m) {
      counter += 1;
      const level = m[1].length as 2 | 3;
      const text = m[2].replace(/\*\*/g, '').trim();
      headings.push({ id: `sec-${counter}`, level, text });
    }
  }
  return headings;
}
