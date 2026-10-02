import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/LanguageContext';

const SITE = 'https://pouleposition.nl';

// Only these pages are meant for search results; everything else is behind a
// login, so it is marked noindex once the app has rendered.
const PUBLIC_PAGES: Record<string, { title: TranslationKey; desc: TranslationKey }> = {
  '/': { title: 'meta.home.title', desc: 'meta.home.desc' },
  '/about': { title: 'meta.about.title', desc: 'meta.about.desc' },
  '/rules': { title: 'meta.rules.title', desc: 'meta.rules.desc' },
  '/privacy': { title: 'meta.privacy.title', desc: 'meta.privacy.desc' },
};

const setMeta = (selector: string, attr: string, value: string) => {
  document.head.querySelector(selector)?.setAttribute(attr, value);
};

// Keeps <title>, description, canonical and the share tags in step with the
// current page and language. The static index.html carries the English home
// page values for crawlers and link previews that do not run JavaScript.
const PageMeta = () => {
  const { pathname } = useLocation();
  const { t, lang } = useLang();

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const page = PUBLIC_PAGES[path];
    const title = t(page ? page.title : path === '/auth' ? 'meta.auth.title' : 'meta.private.title');

    document.title = title;
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[property="og:locale"]', 'content', lang === 'nl' ? 'nl_NL' : 'en_GB');

    if (page) {
      const desc = t(page.desc);
      setMeta('meta[name="description"]', 'content', desc);
      setMeta('meta[property="og:description"]', 'content', desc);
      setMeta('meta[name="twitter:description"]', 'content', desc);
    }

    const url = `${SITE}${path === '/' ? '/' : path}`;
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:url"]', 'content', url);

    // Private and auth pages should not appear in search results.
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!page) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex, nofollow');
    } else {
      robots?.remove();
    }
  }, [pathname, t, lang]);

  return null;
};

export default PageMeta;
