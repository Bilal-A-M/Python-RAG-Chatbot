// Markdown-lite renderer for the assistant's answer.
// Blocks: ``` code fences, "- " bullets, "**bold**" paragraphs.
// Inline: `inline code`, **bold**, [[N]] citation tokens.

function parseBlocks(text) {
  // Split on blank line; preserve code fences as single blocks.
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const start = i + 1;
      let j = start;
      while (j < lines.length && !lines[j].startsWith('```')) j++;
      blocks.push({ kind: 'code', lang, body: lines.slice(start, j).join('\n') });
      i = j + 1;
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    // paragraph: until blank line or fence or list
    const start = i;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('- ')
    ) i++;
    blocks.push({ kind: 'p', body: lines.slice(start, i).join(' ') });
  }
  return blocks;
}

// Inline pieces. Citation tokens like [[3]] become <Cite n=3 />.
function renderInline(text, ctx) {
  // Split keeping the matches.
  const re = /(\[\[\d+\]\]|`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(re).filter((p) => p !== '');
  return parts.map((p, i) => {
    if (/^\[\[\d+\]\]$/.test(p)) {
      const n = Number(p.slice(2, -2));
      return <Cite key={i} n={n} ctx={ctx} />;
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return <code key={i}>{p.slice(1, -1)}</code>;
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

window.parseBlocks = parseBlocks;
window.renderInline = renderInline;
