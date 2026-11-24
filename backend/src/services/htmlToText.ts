// Plain-text version of one of our mails. A mail with only an HTML part is a spam signal, and
// some readers (watches, terminal clients, screen-reader modes) show only the text part.
//
// It is written for the HTML our own templates produce (tables, inline styles, a few links), not for
// arbitrary HTML. One rule matters for privacy: anything with an inline `display: none` is left out.
// The result mails hide the real results that way (spoiler protection), and a plain-text part that
// printed them would give the spoiler away in every app that shows the text part.

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
const SKIP_CONTENT = new Set(['head', 'style', 'script', 'title']);
const PARAGRAPH = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCK = new Set(['div', 'table', 'tr', 'ul', 'ol', 'blockquote', 'section', 'center', 'hr']);

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', times: '×', zwnj: '‌',
};

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });

const hrefOf = (attrs: string): string | null => {
  const m = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  const href = decodeEntities((m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim());
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : null;
};

const bare = (s: string) => s.trim().replace(/^(https?:\/\/|mailto:)/i, '').replace(/\/+$/, '').toLowerCase();

export const htmlToText = (html: string): string => {
  const token = /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</g;
  let buf = '';
  const stack: string[] = [];
  let hiddenFrom = Infinity; // hidden while stack.length >= hiddenFrom
  const links: Array<{ href: string; start: number }> = [];
  // Makes sure the text so far ends with at least n line breaks, so a closing and an opening block tag
  // next to each other give one break, not two.
  const breaks = (n: number) => {
    if (!buf) return;
    const have = (/(?:\n[ \t]*)*$/.exec(buf.slice(-40))![0].match(/\n/g) ?? []).length;
    buf += '\n'.repeat(Math.max(0, n - have));
  };

  for (let m = token.exec(html); m; m = token.exec(html)) {
    const [whole, closing, rawName, attrs = ''] = m;
    if (!rawName) {
      if (whole.startsWith('<!') || whole.startsWith('<?') || whole === '<') continue;
      if (stack.length < hiddenFrom) buf += decodeEntities(whole.replace(/[ \t\r\n\f]+/g, ' '));
      continue;
    }
    const name = rawName.toLowerCase();
    const isVoid = VOID.has(name) || attrs.trimEnd().endsWith('/');

    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at < 0) continue;
      stack.length = at;
      const link = name === 'a' ? links.pop() : undefined; // popped even when hidden, so the stack never goes stale
      if (stack.length < hiddenFrom) {
        hiddenFrom = Infinity;
        if (link?.href) {
          const seg = buf.slice(link.start);
          const text = seg.replace(/\s+/g, ' ').trim();
          if (text && bare(text) !== bare(link.href)) {
            const tail = /\s*$/.exec(seg)![0];
            buf = `${buf.slice(0, link.start)}${seg.slice(0, seg.length - tail.length)} (${link.href})${tail}`;
          }
        }
      }
      if (stack.length < hiddenFrom) {
        if (PARAGRAPH.has(name)) breaks(2);
        else if (BLOCK.has(name) || name === 'li') breaks(1);
        else if (name === 'td' || name === 'th') buf += ' ';
      }
      continue;
    }

    const hidden = /display\s*:\s*none/i.test(attrs) || SKIP_CONTENT.has(name);
    if (isVoid) {
      if (stack.length < hiddenFrom && !hidden) {
        if (name === 'br') buf += '\n';
        else if (name === 'hr') breaks(1);
      }
      continue;
    }
    // A link is tracked on its own stack so a hidden one does not leave a stale entry behind.
    const wasHidden = stack.length >= hiddenFrom;
    stack.push(name);
    if (!wasHidden && hidden) hiddenFrom = stack.length;
    if (stack.length >= hiddenFrom) {
      if (name === 'a') links.push({ href: '', start: buf.length });
      continue;
    }
    if (PARAGRAPH.has(name)) breaks(2);
    else if (BLOCK.has(name)) breaks(1);
    else if (name === 'li') {
      breaks(1);
      buf += '- ';
    } else if (name === 'a') {
      const href = hrefOf(attrs);
      links.push({ href: href ?? '', start: buf.length });
    }
  }

  return buf
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
