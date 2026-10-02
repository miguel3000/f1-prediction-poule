import { useLang, Lang } from '../i18n/LanguageContext';

const OPTIONS: Lang[] = ['en', 'nl'];

// Flat EN | NL switch: the active language is the yellow block, the other sits
// on the dark navy, same two-state pattern as the Idea/Implementation switch.
const LanguageToggle = () => {
  const { lang, setLang, t } = useLang();

  return (
    <div className="flex" role="group" aria-label={t('common.language')}>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
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
