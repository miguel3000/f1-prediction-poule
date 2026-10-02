import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';

const SITE = 'https://pouleposition.nl/';

// Opens the phone's share sheet (WhatsApp, Messages, ...) when there is one,
// otherwise copies the link. The link carries ?lang= so the friend's link
// preview and first screen match the language of whoever shared it.
const ShareButton = () => {
  const { t, lang } = useLang();
  const [notice, setNotice] = useState('');

  const share = async () => {
    const url = `${SITE}?lang=${lang}`;
    const text = t('share.text');

    if (navigator.share) {
      try {
        await navigator.share({ title: t('share.title'), text, url });
        return;
      } catch (err) {
        // Closing the sheet is not an error; any other failure falls back to copying.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNotice(t('share.copied'));
    } catch {
      setNotice(t('share.copyFailed', { url }));
    }
    window.setTimeout(() => setNotice(''), 4000);
  };

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button type="button" onClick={share} className="btn-f1-secondary">
        {t('share.button')}
      </button>
      {notice && (
        <span role="status" className="text-sm text-white break-all">
          {notice}
        </span>
      )}
    </div>
  );
};

export default ShareButton;
