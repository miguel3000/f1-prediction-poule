import { useLang } from '../i18n/LanguageContext';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
    {children}
  </section>
);

const PrivacyPolicy = () => {
  const { t } = useLang();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="card-f1 p-8">
        <h1 className="text-4xl font-bold mb-6 text-f1-yellow-500">{t('privacy.title')}</h1>

        <p className="text-white mb-6">
          <strong>{t('privacy.updated')}</strong> {t('privacy.updatedValue')}
        </p>

        <div className="space-y-6 text-white">
          <Section title={t('s1.title')}>
            <p>{t('s1.text')}</p>
          </Section>

          <Section title={t('s2.title')}>
            <h3 className="text-xl font-semibold text-f1-yellow-500 mb-2">{t('s2.1.title')}</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>{t('s2.1.email.label')}</strong> {t('s2.1.email.text')}</li>
              <li><strong>{t('s2.1.password.label')}</strong> {t('s2.1.password.text')}</li>
              <li><strong>{t('s2.1.nickname.label')}</strong> {t('s2.1.nickname.text')}</li>
              <li><strong>{t('s2.1.avatar.label')}</strong> {t('s2.1.avatar.text')}</li>
              <li><strong>{t('s2.1.predictions.label')}</strong> {t('s2.1.predictions.text')}</li>
            </ul>

            <h3 className="text-xl font-semibold text-f1-yellow-500 mt-4 mb-2">{t('s2.2.title')}</h3>
            <p>{t('s2.2.text')}</p>
          </Section>

          <Section title={t('s3.title')}>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>{t('s3.1.label')}</strong> {t('s3.1.text')}</li>
              <li><strong>{t('s3.2.label')}</strong> {t('s3.2.text')}</li>
              <li><strong>{t('s3.3.label')}</strong> {t('s3.3.text')}</li>
              <li><strong>{t('s3.4.label')}</strong> {t('s3.4.text')}</li>
            </ul>
            <p className="mt-3">{t('s3.note')}</p>
          </Section>

          <Section title={t('s4.title')}>
            <h3 className="text-xl font-semibold text-f1-yellow-500 mb-2">{t('s4.1.title')}</h3>
            <p className="mb-3">{t('s4.1.text')}</p>

            <h3 className="text-xl font-semibold text-f1-yellow-500 mb-2">{t('s4.2.title')}</h3>
            <p>{t('s4.2.text')}</p>
          </Section>

          <Section title={t('s5.title')}>
            <p>{t('s5.text')}</p>
          </Section>

          <Section title={t('s6.title')}>
            <p>{t('s6.text')}</p>
          </Section>

          <Section title={t('s7.title')}>
            <p className="mb-3">{t('s7.intro')}</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>{t('s7.1.label')}</strong> {t('s7.1.text')}</li>
              <li><strong>{t('s7.2.label')}</strong> {t('s7.2.text')}</li>
              <li><strong>{t('s7.3.label')}</strong> {t('s7.3.text')}</li>
              <li><strong>{t('s7.4.label')}</strong> {t('s7.4.text')}</li>
            </ul>
            <p className="mt-3">{t('s7.note')}</p>
          </Section>

          <Section title={t('s8.title')}>
            <p>{t('s8.text')}</p>
          </Section>

          <Section title={t('s9.title')}>
            <p className="mb-3">{t('s9.intro')}</p>
            <ul className="list-none ml-4 space-y-1">
              <li><strong>{t('s9.email')}</strong> noreply@pouleposition.nl</li>
              <li><strong>{t('s9.website')}</strong> https://pouleposition.nl</li>
            </ul>
          </Section>

          <Section title={t('s10.title')}>
            <p>{t('s10.text')}</p>
          </Section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
