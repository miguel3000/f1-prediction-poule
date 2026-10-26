import { useLocation, useNavigate } from 'react-router-dom';
import { useLang, Lang } from '../i18n/LanguageContext';
import { saveLanguage } from '../services/api';

const OPTIONS: Lang[] = ['en', 'nl'];

// Flat EN | NL switch: the active language is the yellow block, the other sits
// on the dark navy, same two-state pattern as the Idea/Implementation switch.
const LanguageToggle = () => {
  const { lang, setLang, t } = useLang();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex" role="group" aria-label={t('common.language')}>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            setLang(option);
            // On a Dutch address (/nl/...) choosing English moves to the English address of the same page.
            if (option === 'en' && /^\/nl(\/|$)/.test(pathname)) navigate((pathname.replace(/^\/nl/, '') || '/') + search);
            // Logged-in players keep this choice on every device. A failure just
            // means it stays a this-browser choice.
            if (localStorage.getItem('token')) saveLanguage(option).catch(() => undefined);
          }}
          aria-pressed={lang === option}
          className={`px-1.5 min-[360px]:px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            lang === option ? 'bg-f1-yellow-500 text-black' : 'bg-f1-blue-dark text-white hover:brightness-125'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

export default LanguageToggle;
