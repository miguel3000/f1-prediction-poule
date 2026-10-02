import { useState, useEffect } from 'react';
import { getNews } from '../services/api';
import { useLang, TranslationKey } from '../i18n/LanguageContext';

interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  publishedAt: string | null;
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const formatRelative = (iso: string | null, t: Translate, locale: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return t('news.justNow');
  if (diffHours < 24) return t('news.hoursAgo', { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return t('news.daysAgo', { n: diffDays });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

const News = () => {
  const { t, locale } = useLang();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getNews()
      .then((res) => setItems(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">
        {t('news.title')}
      </h1>
      <p className="text-center text-white mb-8">
        {t('news.intro')}
      </p>

      {loading && (
        <div className="text-center py-16">
          <div className="animate-spin h-12 w-12 border-b-2 border-f1-yellow-500 mx-auto" style={{ borderRadius: 0 }}></div>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 text-center">
          {t('news.loadFailed')}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="card-f1 p-8 text-center text-white">{t('news.none')}</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, i) => (
            <article key={`${item.link}-${i}`} className="card-f1">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-bold text-white hover:text-f1-yellow-500 transition-colors leading-snug"
              >
                {item.title}
              </a>
              {item.summary && (
                <p className="text-white mt-2 text-sm leading-relaxed">{item.summary}</p>
              )}
              <div className="flex items-center gap-2 mt-3 text-xs text-f1-yellow-500 font-bold uppercase tracking-wider">
                <span>{item.source}</span>
                {item.publishedAt && (
                  <>
                    <span className="text-white">&middot;</span>
                    <span className="text-white normal-case font-normal tracking-normal">{formatRelative(item.publishedAt, t, locale)}</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default News;
