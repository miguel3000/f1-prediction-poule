import axios from 'axios';

// The network access for reading formula1.com's results pages (starting grid). Kept apart from the
// logic so the logic is tested with fakes.

const USER_AGENT = 'Mozilla/5.0 (compatible; PoulePositionBot/1.0; +https://pouleposition.nl)';
const F1_HOST = 'www.formula1.com';
const MAX_PAGE_BYTES = 5 * 1024 * 1024;

export type HttpGet = (url: string) => Promise<{ status: number; data: string }>;

const get: HttpGet = async (url) => {
  const res = await axios.get<string>(url, {
    timeout: 15_000,
    responseType: 'text',
    maxContentLength: MAX_PAGE_BYTES,
    maxRedirects: 0, // a results page is served from where its address says; no redirect to elsewhere
    validateStatus: (status) => status === 200 || status === 404,
    headers: { 'User-Agent': USER_AGENT },
  });
  return { status: res.status, data: res.data };
};

// The page's HTML, or null when formula1.com has no such page (yet). Anything else is an error.
export const fetchF1Page = async (url: string, http: HttpGet = get): Promise<string | null> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Not a formula1.com URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== F1_HOST) throw new Error('Not a formula1.com URL');

  const res = await http(url);
  return res.status === 404 ? null : res.data;
};
