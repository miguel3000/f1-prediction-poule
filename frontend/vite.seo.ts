// Writes dist/seo-content.json: the text of the public pages (src/seo/outline.ts) in both languages, taken
// from the same locale files the pages use. The backend reads it to put real content in the HTML for bots
// that do not run JavaScript, to write the structured data, and to build /llms.txt and /llms-full.txt
// (backend/src/utils/seoContent.ts).
//
// The build fails, on purpose, when a key is missing in a language or still has a {placeholder}: a page
// of raw keys must never reach a crawler.
import type { Plugin } from 'vite';
import { en } from './src/i18n/locales/en';
import { nl } from './src/i18n/locales/nl';
import { SEO_PAGES, type SeoBlock, type SeoItem } from './src/seo/outline';

type Lang = 'en' | 'nl';
const DICT: Record<Lang, Record<string, string>> = { en, nl };

const text = (lang: Lang, key: string, vars: Record<string, string> = {}): string => {
  const raw = DICT[lang][key];
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(`SEO content: "${key}" is missing in ${lang}`);
  const filled = raw.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? vars[name] : whole));
  const left = /\{\w+\}/.exec(filled);
  if (left) throw new Error(`SEO content: "${key}" (${lang}) still has ${left[0]}, so it cannot be written as plain text`);
  return filled.trim();
};

// "⚠ Bonus: First Retirement" -> "Bonus: First Retirement" (decorative symbols belong to the page, not the text)
const heading = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '');

const item = (lang: Lang, it: SeoItem): string => {
  if (typeof it === 'string') return text(lang, it);
  if (Array.isArray(it)) return `${text(lang, it[0])} ${text(lang, it[1])}`;
  return `${text(lang, it.label)} ${it.value}`;
};

const block = (lang: Lang, b: SeoBlock) => {
  if ('h' in b) return { type: `h${b.h}`, text: heading(text(lang, b.key)) };
  if ('p' in b) return { type: 'p', text: text(lang, b.p, b.vars) };
  if ('ul' in b) return { type: 'ul', items: b.ul.map((it) => item(lang, it)) };
  if ('faq' in b) return { type: 'faq', items: b.faq.map(([q, a]) => ({ q: text(lang, q), a: text(lang, a) })) };
  return { type: 'links', label: text(lang, 'seo.nav'), items: b.links.map((l) => ({ path: l.path, label: text(lang, l.label) })) };
};

export const buildSeoContent = () => ({
  version: 1,
  pages: SEO_PAGES.map((page) => {
    const forLang = (lang: Lang) => ({
      title: text(lang, page.title),
      description: text(lang, page.description),
      blocks: page.blocks.map((b) => block(lang, b)),
    });
    return { path: page.path, en: forLang('en'), nl: forLang('nl') };
  }),
});

export const seoContent = (): Plugin => ({
  name: 'poule-position-seo-content',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'seo-content.json', source: JSON.stringify(buildSeoContent(), null, 1) });
  },
});
