const SITE = 'https://pouleposition.nl';

// Pages that make sense to hand to a friend as they are. Everything else is behind a
// login (or is a one-off like /reset-password), so sharing from there sends the
// friend to the home page instead.
const SHAREABLE = ['/', '/about', '/tutorial', '/rules', '/privacy'];

// The link carries ?lang= so the friend's link preview and first screen match the
// language of whoever shared it. Only the path is used, never the query or hash of the
// current address, so nothing like a reset-password token can end up in a shared link.
export const shareUrlFor = (pathname: string, lang: string): string => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return `${SITE}${SHAREABLE.includes(path) ? path : '/'}?lang=${lang}`;
};

export type ShareResult = 'shared' | 'copied' | 'failed' | 'cancelled';

// Opens the phone's share sheet (WhatsApp, Messages, ...) when there is one,
// otherwise copies the link.
export const shareLink = async (data: { title: string; text: string; url: string }): Promise<ShareResult> => {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      // Closing the sheet is not an error; any other failure falls back to copying.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${data.text} ${data.url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
};
