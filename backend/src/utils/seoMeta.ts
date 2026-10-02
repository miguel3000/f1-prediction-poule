import fs from 'fs';

// Per-page <head> values, applied to index.html on the server so crawlers and
// link-preview bots (which often do not run JavaScript) see the right title,
// description and language. Keep the wording in step with
// frontend/src/i18n/locales/{en,nl}/meta.ts, which the app applies client-side.

export type SeoLang = 'en' | 'nl';

interface PageMeta {
  title: Record<SeoLang, string>;
  desc: Record<SeoLang, string>;
}

const SITE = 'https://pouleposition.nl';

const PUBLIC_PAGES: Record<string, PageMeta> = {
  '/': {
    title: {
      en: 'Poule Position – F1 prediction game for friends',
      nl: 'Poule Position – F1-voorspellingsspel voor vrienden',
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

let template: string | null = null;
const loadTemplate = (indexPath: string) => {
  if (template === null) template = fs.readFileSync(indexPath, 'utf8');
  return template;
};

export const renderIndex = (indexPath: string, rawPath: string, lang: SeoLang): string => {
  const path = normalizePath(rawPath);
  const page = PUBLIC_PAGES[path];
  const title = page ? page.title[lang] : path === '/auth' ? AUTH_TITLE[lang] : 'Poule Position';
  const canonical = `${SITE}${path === '/' ? '/' : path}`;

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
  } else {
    // Login-gated and utility pages stay out of search results.
    html = html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>');
  }

  return html;
};
