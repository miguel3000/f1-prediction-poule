import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { ShareIcon } from './icons';
import { shareLink, shareUrlFor } from '../utils/share';

// Small share button for the header, so every page has one. Shares the page you are
// on when that page is public, otherwise the home page (see shareUrlFor). The notice
// is anchored to the header (the nearest positioned ancestor) rather than fixed,
// because the header's backdrop blur would otherwise trap a fixed child inside it.
const ShareIconButton = () => {
  const { t, lang } = useLang();
  const { pathname } = useLocation();
  const [notice, setNotice] = useState('');
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const share = async () => {
    const url = shareUrlFor(pathname, lang);
    const result = await shareLink({ title: t('share.title'), text: t('share.text'), url });
    if (result === 'copied') setNotice(t('share.copied'));
    else if (result === 'failed') setNotice(t('share.copyFailed', { url }));
    else return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(''), 4000);
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="p-2 transition-colors border text-f1-neutral-400 border-f1-neutral-800 hover:text-white hover:border-f1-neutral-600"
        aria-label={t('share.icon')}
        title={t('share.icon')}
      >
        <ShareIcon className="w-4 h-4" />
      </button>
      {notice && (
        <div className="absolute top-full right-0 left-0 z-50 px-4 pt-2 pointer-events-none">
          <p
            role="status"
            className="ml-auto max-w-sm bg-f1-yellow-500 text-black px-4 py-2 text-sm font-bold break-all"
          >
            {notice}
          </p>
        </div>
      )}
    </>
  );
};

export default ShareIconButton;
