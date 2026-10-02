import type { news as en_news } from '../en/news';

export const news: Record<keyof typeof en_news, string> = {
  'news.title': 'Nieuws',
  'news.intro': 'Het laatste nieuws uit de paddock, van de officiële F1-site en onafhankelijke motorsportmedia. De artikelen zelf blijven in het Engels.',
  'news.loadFailed': 'Nieuws laden mislukt. Probeer het zo nog eens.',
  'news.none': 'Op dit moment is er geen nieuws.',
  'news.justNow': 'Zojuist',
  'news.hoursAgo': '{n} u geleden',
  'news.daysAgo': '{n} d geleden',
};
