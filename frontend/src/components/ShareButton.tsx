import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';
import { shareLink, shareUrlFor } from '../utils/share';

// The big "Invite friends" button on a few pages: always shares the home page.
const ShareButton = () => {
  const { t, lang } = useLang();
  const [notice, setNotice] = useState('');

  const share = async () => {
    const url = shareUrlFor('/', lang);
    const result = await shareLink({ title: t('share.title'), text: t('share.text'), url });
    if (result === 'copied') setNotice(t('share.copied'));
    else if (result === 'failed') setNotice(t('share.copyFailed', { url }));
    else return;
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
