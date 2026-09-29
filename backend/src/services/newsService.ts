import Parser from 'rss-parser';
import { f1Cache } from '../utils/cache';

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PoulePositionBot/1.0)' },
  timeout: 10000,
});

export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  publishedAt: string | null;
}

const FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.formula1.com/en/latest/all.xml', source: 'Formula1.com' },
  { url: 'https://www.motorsport.com/rss/f1/news/', source: 'Motorsport.com' },
  { url: 'https://www.autosport.com/rss/f1/news/', source: 'Autosport' },
  { url: 'https://www.racefans.net/feed/', source: 'RaceFans' },
];

const CACHE_KEY = 'f1_news';
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ITEMS = 30;
// Generous cap — most feeds' own descriptions run shorter than this anyway
// (some, like Motorsport.com/Autosport, already end in their own "Keep
// reading" cutoff), so this mostly avoids re-truncating an already-short
// summary rather than actually kicking in.
const SUMMARY_MAX_CHARS = 500;

// Some feeds (Motorsport.com, Autosport) wrap their description in CDATA
// containing raw HTML — a trailing "Keep reading" link, <br> tags — which
// isn't real XML markup so the parser hands it back as literal text.
function stripHtml(raw: string): string {
  return raw
    .replace(/<a[^>]*class=['"]more['"][^>]*>.*?<\/a>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// rss-parser generates contentSnippet by stripping tags itself before we
// ever see it, which removes the <a class="more"> markup above but leaves
// its "Keep reading" link text behind as plain trailing text — strip that
// separately since it's no longer inside a tag by the time it reaches us.
function stripTrailingCta(text: string): string {
  return text.replace(/\s*\.{0,3}\s*(keep reading|read more|continue reading)\.?\s*$/i, '').trim();
}

function truncate(text: string, max = SUMMARY_MAX_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

export async function getLatestNews(): Promise<NewsItem[]> {
  const cached = f1Cache.get<NewsItem[]>(CACHE_KEY);
  if (cached) return cached;

  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, source }) => {
      const feed = await parser.parseURL(url);
      return (feed.items || []).slice(0, 8).map((item): NewsItem => {
        const rawSummary = item.contentSnippet || item.content || (item as any).description || '';
        return {
          title: stripHtml(item.title || 'Untitled'),
          link: item.link || '',
          summary: truncate(stripTrailingCta(stripHtml(rawSummary))),
          source,
          publishedAt: item.isoDate || item.pubDate || null,
        };
      });
    })
  );

  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      console.error('News feed fetch failed:', result.reason?.message || result.reason);
    }
  }

  items.sort((a, b) => {
    const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return timeB - timeA;
  });

  const top = items.filter((item) => item.link).slice(0, MAX_ITEMS);
  f1Cache.set(CACHE_KEY, top, CACHE_TTL_MS);
  return top;
}
