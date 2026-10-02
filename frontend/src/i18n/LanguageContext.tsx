import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { en } from './locales/en';
import { nl } from './locales/nl';

export type Lang = 'en' | 'nl';
export type TranslationKey = keyof typeof en;
type Vars = Record<string, string | number>;

const dictionaries: Record<Lang, Record<string, string>> = { en, nl };
const STORAGE_KEY = 'lang';

// First visit: follow the browser (Dutch browsers get Dutch), otherwise English.
const initialLang = (): Lang => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'nl') return stored;
  } catch {
    /* storage can be blocked; fall through to the browser language */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
};

interface LanguageContextType {
  lang: Lang;
  // BCP-47 locale for Intl / toLocale*String, matching the chosen language.
  locale: string;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
  // Translates a message that came back from the API in English (login errors etc.),
  // falling back to the original text when there is no Dutch version.
  tError: (message: string | undefined, fallbackKey?: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  locale: 'en-GB',
  setLang: () => {},
  t: (key) => key,
  tError: (message) => message || '',
});

export const useLang = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the choice just won't survive a reload */
    }
  }, []);

  const value = useMemo<LanguageContextType>(() => {
    const dict = dictionaries[lang];

    const t = (key: TranslationKey, vars?: Vars) => {
      let text = dict[key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, v] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(v));
        }
      }
      return text;
    };

    // API error messages are keyed by their exact English text under "err.<message>".
    const tError = (message: string | undefined, fallbackKey?: TranslationKey) => {
      if (message) {
        const known = dict[`err.${message}`];
        return known ?? message;
      }
      return fallbackKey ? t(fallbackKey) : '';
    };

    return { lang, locale: lang === 'nl' ? 'nl-NL' : 'en-GB', setLang, t, tError };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
