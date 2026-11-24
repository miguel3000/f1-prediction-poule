import fs from 'fs';
import { dirname } from 'path';
import { loadSeoContent, renderBody, renderStructuredData, SEO_CONTENT_CSS, SITE } from './seoContent';

// Per-page <head> values, applied to index.html on the server so crawlers and
// link-preview bots (which often do not run JavaScript) see the right title,
// description and language. Keep the wording in step with
// frontend/src/i18n/locales/{en,nl}/meta.ts, which the app applies client-side.
// The page text and structured data come from seo-content.json (seoContent.ts).

export type SeoLang = 'en' | 'nl';

interface PageMeta {
  title: Record<SeoLang, string>;
  desc: Record<SeoLang, string>;
}

const PUBLIC_PAGES: Record<string, PageMeta> = {
  '/': {
    title: {
      en: 'Poule Position – F1 prediction game for friends',
      nl: 'F1-poule spelen met vrienden – Poule Position',
    },
    desc: {
      en: 'Predict the top 10 of every Formula 1 race and sprint, score points for every correct position and beat your friends on the season leaderboard. Free F1 prediction poule.',
      nl: 'Voorspel de top 10 van elke Formule 1-race en sprint, verdien punten voor elke juiste positie en versla je vrienden in het seizoensklassement. Gratis F1-poule.',
    },
  },
  '/about': {
    title: { en: 'About Poule Position – the F1 prediction poule', nl: 'Over Poule Position – de F1-poule' },
    desc: {
      en: 'How Poule Position works: create an account, predict the finishing order of every Formula 1 race and sprint, and compete with friends for the season title.',
      nl: 'Zo werkt Poule Position: maak een account, voorspel de uitslag van elke Formule 1-race en sprint en strijd met vrienden om de seizoenstitel.',
    },
  },
  '/tutorial': {
    title: { en: 'How to play – Poule Position tutorial', nl: 'Zo speel je – Poule Position handleiding' },
    desc: {
      en: 'A step-by-step tutorial for Poule Position with examples: build your F1 prediction grid, pick the first retirement, beat the deadline and see how points are scored.',
      nl: 'Een stap-voor-stap handleiding voor Poule Position met voorbeelden: bouw je F1-voorspellingsgrid, kies de eerste uitvaller, haal de deadline en zie hoe punten worden berekend.',
    },
  },
  '/rules': {
    title: { en: 'Rules and scoring – Poule Position', nl: 'Regels en puntentelling – Poule Position' },
    desc: {
      en: 'How points are scored in Poule Position: exact positions, near misses, first retirement and sprint races explained.',
      nl: 'Zo worden punten verdiend in Poule Position: exacte posities, bijna goed, eerste uitvaller en sprintraces uitgelegd.',
    },
  },
  '/privacy': {
    title: { en: 'Privacy policy – Poule Position', nl: 'Privacybeleid – Poule Position' },
    desc: {
      en: 'What data Poule Position stores about players and how it is used.',
      nl: 'Welke gegevens Poule Position over spelers bewaart en waarvoor ze worden gebruikt.',
    },
  },
};

const AUTH_TITLE: Record<SeoLang, string> = {
  en: 'Log in or sign up – Poule Position',
  nl: 'Inloggen of registreren – Poule Position',
};

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ?lang= (set by the app's share button) wins; otherwise the first language the
// client asks for. Bots that send no Accept-Language get English.
export const pickLang = (queryLang: unknown, acceptLanguage: string | undefined): SeoLang => {
  if (queryLang === 'nl' || queryLang === 'en') return queryLang;
  return acceptLanguage?.trim().toLowerCase().startsWith('nl') ? 'nl' : 'en';
};

const normalizePath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

const templates = new Map<string, string>();
const loadTemplate = (indexPath: string) => {
  let template = templates.get(indexPath);
  if (template === undefined) {
    template = fs.readFileSync(indexPath, 'utf8');
    templates.set(indexPath, template);
  }
  return template;
};

const IMAGE_ALT_NL = 'Poule Position-logo – voorspel de F1-uitslag, versla je vrienden';

// Dutch pages live under /nl (/nl, /nl/tutorial, ...) so that search engines, which crawl without
// a language, can index the Dutch version separately. English stays at the plain paths.
const splitLangPrefix = (path: string): { lang: SeoLang | null; base: string } => {
  const m = /^\/nl(\/.*)?$/.exec(path);
  return m ? { lang: 'nl', base: m[1] ? normalizePath(m[1]) : '/' } : { lang: null, base: path };
};

const urlFor = (lang: SeoLang, base: string) =>
  lang === 'nl' ? `${SITE}/nl${base === '/' ? '' : base}` : `${SITE}${base}`;

export const renderIndex = (indexPath: string, rawPath: string, requestLang: SeoLang): string => {
  const normalized = normalizePath(rawPath);
  const prefixed = splitLangPrefix(normalized);
  const path = prefixed.base;
  // A Dutch address is always Dutch, whatever the visitor's language settings say.
  const lang: SeoLang = prefixed.lang ?? requestLang;
  const page = PUBLIC_PAGES[path];
  const title = page ? page.title[lang] : path === '/auth' ? AUTH_TITLE[lang] : 'Poule Position';
  const canonical = urlFor(prefixed.lang ?? 'en', path);

  let html = loadTemplate(indexPath);
  const setAttr = (pattern: RegExp, value: string) => {
    html = html.replace(pattern, (_m, open: string, close: string) => `${open}${escapeAttr(value)}${close}`);
  };

  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`);
  setAttr(/(<meta property="og:title" content=")[^"]*(")/, title);
  setAttr(/(<meta name="twitter:title" content=")[^"]*(")/, title);
  setAttr(/(<meta property="og:locale" content=")[^"]*(")/, lang === 'nl' ? 'nl_NL' : 'en_GB');
  setAttr(/(<link rel="canonical" href=")[^"]*(")/, canonical);
  setAttr(/(<meta property="og:url" content=")[^"]*(")/, canonical);

  if (page) {
    const desc = page.desc[lang];
    setAttr(/(<meta name="description" content=")[^"]*(")/, desc);
    setAttr(/(<meta property="og:description" content=")[^"]*(")/, desc);
    setAttr(/(<meta name="twitter:description" content=")[^"]*(")/, desc);

    if (lang === 'nl') setAttr(/(<meta property="og:image:alt" content=")[^"]*(")/, IMAGE_ALT_NL);

    // The text of the page for bots that do not run JavaScript (the app replaces it once it loads), and
    // structured data in the page's own language instead of the one English block of the shell.
    const content = loadSeoContent(dirname(indexPath));
    if (content) {
      const body = renderBody(content, path, lang);
      if (body) {
        html = html.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
        html = html.replace('</head>', () => `    <style id="seo-content-style">\n${SEO_CONTENT_CSS}\n    </style>\n  </head>`);
      }
      const structured = renderStructuredData(content, path, lang, prefixed.lang ?? 'en');
      if (structured) html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => structured);
    }

    // Tell search engines the English and Dutch versions belong together.
    const alternates = [
      `    <link rel="alternate" hreflang="en" href="${urlFor('en', path)}" />`,
      `    <link rel="alternate" hreflang="nl" href="${urlFor('nl', path)}" />`,
      `    <link rel="alternate" hreflang="x-default" href="${urlFor('en', path)}" />`,
    ].join('\n');
    html = html.replace('</head>', `${alternates}\n  </head>`);
  } else {
    // Login-gated and utility pages stay out of search results.
    html = html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>');
  }

  return html;
};
