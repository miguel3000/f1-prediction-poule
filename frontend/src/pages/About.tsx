import { useLang } from '../i18n/LanguageContext';

const About = () => {
  const { t } = useLang();

  const what = [1, 2, 3, 4, 5] as const;
  const how = [1, 2, 3, 4, 5] as const;
  const tech = [1, 2, 3, 4] as const;
  const fair = [1, 2, 3, 4] as const;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="card-f1 p-8">
        <h1 className="text-4xl font-bold mb-6 text-f1-yellow-500">{t('about.title')}</h1>

        <div className="space-y-6 text-white">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.welcome.title')}</h2>
            <p>{t('about.welcome.text')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.what.title')}</h2>
            <p className="mb-3">{t('about.what.intro')}</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              {what.map((n) => (
                <li key={n}>
                  <strong className="text-white">{t(`about.what.${n}.label`)}</strong> {t(`about.what.${n}.text`)}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.how.title')}</h2>
            <div className="space-y-4">
              {how.map((n) => (
                <div key={n} className="bg-gray-800/50 p-4 border border-gray-700">
                  <h3 className="text-lg font-bold text-f1-yellow-500 mb-2">{t(`about.how.${n}.title`)}</h3>
                  <p>{t(`about.how.${n}.text`)}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.mission.title')}</h2>
            <p>{t('about.mission.text')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.tech.title')}</h2>
            <p className="mb-3">{t('about.tech.intro')}</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              {tech.map((n) => (
                <li key={n}><strong>{t(`about.tech.${n}.label`)}</strong> {t(`about.tech.${n}.text`)}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.fair.title')}</h2>
            <p className="mb-3">{t('about.fair.intro')}</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              {fair.map((n) => (
                <li key={n}>{t(`about.fair.${n}`)}</li>
              ))}
            </ul>
            <p className="mt-3">
              {t('about.fair.more')} <a href="/rules" className="text-f1-yellow-500 hover:underline">{t('about.fair.rulesLink')}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.community.title')}</h2>
            <p>{t('about.community.text')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.free.title')}</h2>
            <p>{t('about.free.text')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.disclaimer.title')}</h2>
            <p className="mb-3">{t('about.disclaimer.intro')}</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Formula 1® (F1)</li>
              <li>Fédération Internationale de l'Automobile (FIA)</li>
              <li>Liberty Media Corporation</li>
              <li>{t('about.disclaimer.4')}</li>
            </ul>
            <p className="mt-3">{t('about.disclaimer.text')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.contact.title')}</h2>
            <p className="mb-3">{t('about.contact.intro')}</p>
            <ul className="list-none ml-4 space-y-1">
              <li><strong>{t('about.contact.email')}</strong> <a href="mailto:kimi@pouleposition.nl" className="text-f1-yellow-500 hover:underline">kimi@pouleposition.nl</a></li>
            </ul>
            <p className="mt-3">
              {t('about.contact.privacy')} <a href="/privacy" className="text-f1-yellow-500 hover:underline">{t('about.contact.privacyLink')}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">{t('about.version.title')}</h2>
            <p>
              <strong>{t('about.version.current')}</strong> {t('about.version.currentValue')}<br />
              <strong>{t('about.version.updated')}</strong> {t('about.version.updatedValue')}
            </p>
            <p className="mt-3">{t('about.version.text')}</p>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-700 text-center">
            <p className="text-lg font-semibold text-white mb-2">{t('about.cta.title')}</p>
            <p className="mb-4">{t('about.cta.text')}</p>
            <a
              href="/"
              className="inline-block bg-f1-yellow-500 hover:brightness-110 text-black font-bold py-3 px-6 transition-all"
            >
              {t('about.cta.button')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
