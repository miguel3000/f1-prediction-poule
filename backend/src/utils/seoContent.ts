import fs from 'fs';
import path from 'path';

// The text of the public pages for search engines and AI bots, from dist/seo-content.json. The frontend build
// writes that file from the same locale files the pages use (frontend/src/seo/outline.ts, frontend/vite.seo.ts),
// so nothing here holds wording of its own except the few lines of llms.txt.
//
// Why: the app is a React single-page app and most AI crawlers do not run JavaScript, so without this they
// see an empty <div id="root">. seoMeta.ts puts renderBody() inside that div (React replaces it on load),
// replaces the structured data with renderStructuredData(), and server.ts serves the two llms files.

export type SeoLang = 'en' | 'nl';

export type SeoBlock =
  | { type: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'faq'; items: Array<{ q: string; a: string }> }
  | { type: 'links'; label: string; items: Array<{ path: string; label: string }> };

export interface SeoPageContent {
  title: string;
  description: string;
  blocks: SeoBlock[];
}

export interface SeoContent {
  version: number;
  pages: Array<{ path: string; en: SeoPageContent; nl: SeoPageContent }>;
}

export const SITE = 'https://pouleposition.nl';

const cache = new Map<string, SeoContent | null>();

// Reads <dir>/seo-content.json once. A missing or unreadable file (the dev server, an old build) is not an
// error: the pages then just have their head and no extra text.
export const loadSeoContent = (dir: string): SeoContent | null => {
  if (cache.has(dir)) return cache.get(dir) ?? null;
  let content: SeoContent | null = null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'seo-content.json'), 'utf8'));
    if (raw && raw.version === 1 && Array.isArray(raw.pages)) content = raw as SeoContent;
  } catch {
    /* no content file */
  }
  cache.set(dir, content);
  return content;
};

export const clearSeoContentCache = () => cache.clear();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The locale files mark bold as **text**; escape first, so nothing but our own <strong> gets through.
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');

// Dutch pages live under /nl; the login page has no Dutch address (its language follows the player).
const hrefFor = (content: SeoContent, lang: SeoLang, p: string) =>
  lang === 'nl' && content.pages.some((page) => page.path === p) ? `/nl${p === '/' ? '' : p}` : p;
const absolute = (content: SeoContent, lang: SeoLang, p: string) => `${SITE}${hrefFor(content, lang, p)}`;

const find = (content: SeoContent, p: string) => content.pages.find((page) => page.path === p);

// ---- the text inside <div id="root"> ----
export const renderBody = (content: SeoContent, pagePath: string, lang: SeoLang): string | null => {
  const page = find(content, pagePath)?.[lang];
  if (!page) return null;
  const parts = page.blocks.map((b) => {
    switch (b.type) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'p': {
        const tag = b.type;
        return `<${tag}>${inline(b.text)}</${tag}>`;
      }
      case 'ul':
        return `<ul>\n${b.items.map((i) => `<li>${inline(i)}</li>`).join('\n')}\n</ul>`;
      case 'faq':
        return `<dl>\n${b.items.map((i) => `<dt>${inline(i.q)}</dt>\n<dd>${inline(i.a)}</dd>`).join('\n')}\n</dl>`;
      case 'links':
        return `<nav aria-label="${esc(b.label)}">\n<ul>\n${b.items
          .map((i) => `<li><a href="${esc(hrefFor(content, lang, i.path))}">${esc(i.label)}</a></li>`)
          .join('\n')}\n</ul>\n</nav>`;
    }
  });
  return `<main id="seo-content">\n${parts.join('\n')}\n</main>`;
};

// What a visitor sees for the moment before the app loads (and what a reader without JavaScript sees): the
// same yellow headings as the site, on its dark page, instead of one flat wall of text. Every rule starts
// with #seo-content, so it can never restyle the app, and it goes away with the element when React mounts.
export const SEO_CONTENT_CSS = [
  '#seo-content{max-width:56rem;margin:0 auto;padding:2rem 1rem;line-height:1.6}',
  '#seo-content h1{font-size:2rem;line-height:1.2;margin:0 0 1rem;color:#FFD81A}',
  '#seo-content h2{font-size:1.4rem;margin:2rem 0 .5rem;color:#FFD81A}',
  '#seo-content h3{font-size:1.1rem;margin:1.25rem 0 .25rem}',
  '#seo-content p,#seo-content ul,#seo-content dl{margin:0 0 1rem}',
  '#seo-content ul{padding-left:1.25rem;list-style:disc}',
  '#seo-content dt{font-weight:700;margin-top:1rem}',
  '#seo-content dd{margin:0 0 .5rem}',
  '#seo-content a{color:#FFD81A}',
  '#seo-content nav ul{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;list-style:none;padding:0}',
].join('\n');

// ---- structured data (schema.org JSON-LD), one block per page ----
// JSON for inside a <script>: "<" is escaped so nothing in the text can close the tag early.
const scriptSafe = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

// `lang` is the language of the text; `addressLang` the language of the address it is served at (they differ
// when a visitor who asks for Dutch opens an English address: Dutch text, English canonical).
export const renderStructuredData = (content: SeoContent, pagePath: string, lang: SeoLang, addressLang: SeoLang = lang): string | null => {
  const entry = find(content, pagePath);
  const page = entry?.[lang];
  if (!entry || !page) return null;
  const url = absolute(content, addressLang, pagePath);
  const home = absolute(content, addressLang, '/');
  const graph: object[] = [];

  if (pagePath === '/') {
    graph.push(
      { '@type': 'WebSite', name: 'Poule Position', alternateName: 'Poule Position F1', url, inLanguage: lang, description: page.description },
      {
        '@type': 'WebApplication',
        name: 'Poule Position',
        url,
        description: page.description,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        inLanguage: ['en', 'nl'],
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      }
    );
  } else {
    const h1 = page.blocks.find((b) => b.type === 'h1') as { text: string } | undefined;
    graph.push(
      {
        '@type': 'WebPage', name: page.title, description: page.description, url, inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: 'Poule Position', url: home },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Poule Position', item: home },
          { '@type': 'ListItem', position: 2, name: h1?.text ?? page.title, item: url },
        ],
      }
    );
    for (const b of page.blocks) {
      if (b.type !== 'faq') continue;
      graph.push({
        '@type': 'FAQPage',
        mainEntity: b.items.map((i) => ({ '@type': 'Question', name: plain(i.q), acceptedAnswer: { '@type': 'Answer', text: plain(i.a) } })),
      });
    }
  }
  return `<script type="application/ld+json">${scriptSafe({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
};

// ---- llms.txt and llms-full.txt (https://llmstxt.org): the site for language models, as plain markdown ----
const NOTE =
  'Poule Position is a free Formula 1 prediction game for friends, in English and Dutch. Players predict the finishing order of every race and sprint and compete on a season leaderboard. It is an independent, fan-made game, not affiliated with Formula 1. The pages below are the public part of the site; the race calendar, standings, predictions and leaderboards are behind a login.';

const homeDescription = (content: SeoContent) => find(content, '/')?.en.description ?? '';

export const renderLlmsTxt = (content: SeoContent): string => {
  const list = (lang: SeoLang) =>
    content.pages.map((p) => `- [${p[lang].title}](${absolute(content, lang, p.path)}): ${p[lang].description}`);
  return [
    '# Poule Position',
    '',
    `> ${homeDescription(content)}`,
    '',
    NOTE,
    '',
    '## Pages (English)',
    ...list('en'),
    '',
    "## Pagina's (Nederlands)",
    ...list('nl'),
    '',
    '## Full text',
    `- [All the pages above in one file, English and Dutch](${SITE}/llms-full.txt)`,
    '',
  ].join('\n');
};

const markdown = (content: SeoContent, p: SeoContent['pages'][number], lang: SeoLang): string => {
  const page = p[lang];
  const question = lang === 'nl' ? 'V' : 'Q';
  const out: string[] = [];
  for (const b of page.blocks) {
    switch (b.type) {
      case 'h1':
        out.push(`## ${b.text}`, `Source: ${absolute(content, lang, p.path)}`);
        break;
      case 'h2':
        out.push(`### ${b.text}`);
        break;
      case 'h3':
        out.push(`#### ${b.text}`);
        break;
      case 'p':
        out.push(b.text);
        break;
      case 'ul':
        out.push(b.items.map((i) => `- ${i}`).join('\n'));
        break;
      case 'faq':
        out.push(b.items.map((i) => `**${question}: ${i.q}**\n${i.a}`).join('\n\n'));
        break;
      case 'links':
        break; // the navigation is the same on every page
    }
  }
  return out.join('\n\n');
};

export const renderLlmsFullTxt = (content: SeoContent): string =>
  [
    '# Poule Position',
    '',
    `> ${homeDescription(content)}`,
    '',
    NOTE,
    '',
    ...(['en', 'nl'] as SeoLang[]).flatMap((lang) => content.pages.flatMap((p) => ['---', '', markdown(content, p, lang), ''])),
  ].join('\n');
