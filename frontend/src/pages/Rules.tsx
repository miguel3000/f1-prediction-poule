import { useLang } from '../i18n/LanguageContext';
import { ordinal } from '../i18n/format';
import Rich from '../components/Rich';

// Racing-themed SVG Icons
const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

const CheckeredFlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
    <path d="M8 3v4M12 3v4M16 3v4M8 11v4M12 11v4M16 11v4" strokeWidth="1"/>
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const HelpCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 inline-block mr-2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const MAIN_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

const Rules = () => {
  const { t, lang } = useLang();
  const pts = (n: number) => (n === 1 ? t('rules.ptsOne') : t('rules.pts', { n }));
  const ptsShort = (n: number) => (n === 1 ? t('rules.ptsOne2') : t('rules.ptsN', { n }));

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center text-f1-yellow-500">{t('rules.title')}</h1>

      <div className="space-y-8 text-lg leading-relaxed">
        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><ClipboardIcon />{t('rules.how.title')}</h2>
          <ol className="list-decimal list-inside space-y-3">
            <li><Rich text={t('rules.how.1')} /></li>
            <li><Rich text={t('rules.how.2')} /></li>
            <li><Rich text={t('rules.how.3')} /></li>
            <li><Rich text={t('rules.how.4')} /></li>
            <li><Rich text={t('rules.how.5')} /></li>
          </ol>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><TrophyIcon />{t('rules.scoring.title')}</h2>
          <p className="mb-4">{t('rules.scoring.intro')}</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {MAIN_POINTS.map((p, i) => (
              <div key={i} className="bg-gray-900 p-3">
                <span className="text-f1-yellow-500 font-bold">{t('rules.placeLabel', { ord: ordinal(i + 1, lang) })}</span> {pts(p)}
              </div>
            ))}
          </div>

          <div className="bg-green-900/30 border border-green-500/50 p-4 mb-2">
            <h3 className="text-lg font-bold text-green-400 mb-2">{t('rules.exact.title')}</h3>
            <p className="text-sm"><Rich text={t('rules.exact.text')} /></p>
            <p className="mt-2 text-sm"><span className="text-green-400">{t('rules.example')}</span> <Rich text={t('rules.exact.example')} /></p>
          </div>

          <div className="bg-yellow-900/30 border border-yellow-500/50 p-4 mb-2">
            <h3 className="text-lg font-bold text-yellow-400 mb-2">{t('rules.near.title')}</h3>
            <p className="text-sm"><Rich text={t('rules.near.text')} /></p>
            <p className="mt-2 text-sm"><span className="text-yellow-400">{t('rules.example')}</span> <Rich text={t('rules.near.example')} /></p>
          </div>

          <div className="bg-gray-900/60 border border-gray-600/50 p-4 mb-4">
            <h3 className="text-lg font-bold text-gray-400 mb-2">{t('rules.miss.title')}</h3>
            <p className="text-sm"><Rich text={t('rules.miss.text')} /></p>
            <p className="mt-2 text-sm"><span className="text-gray-400">{t('rules.example')}</span> <Rich text={t('rules.miss.example')} /></p>
          </div>

          <p className="text-white"><Rich text={t('rules.note')} /></p>

          <div className="bg-f1-blue-dark/30 border border-f1-blue/50 p-4 mt-4">
            <h3 className="text-lg font-bold text-f1-blue mb-2">{t('rules.dnf.title')}</h3>
            <p className="text-sm"><Rich text={t('rules.dnf.text')} /></p>
          </div>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><ClockIcon />{t('rules.deadlines.title')}</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><Rich text={t('rules.deadlines.1')} /></li>
            <li><Rich text={t('rules.deadlines.2')} /></li>
            <li><Rich text={t('rules.deadlines.3')} /></li>
            <li><Rich text={t('rules.deadlines.4')} /></li>
            <li><Rich text={t('rules.deadlines.5')} /></li>
          </ul>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><TargetIcon />{t('rules.example.title')}</h2>
          <p className="mb-4">{t('rules.example.predicted')}</p>
          <div className="bg-gray-900 p-4 mb-4">
            <p>P1: Max Verstappen</p>
            <p>P2: Lewis Hamilton</p>
            <p>P3: Charles Leclerc</p>
            <p>{t('rules.example.more')}</p>
          </div>
          <p className="mb-4">{t('rules.example.actual')}</p>
          <div className="bg-gray-900 p-4 mb-4">
            <p>{t('rules.example.line', { pos: 1, name: 'Max Verstappen', pts: 25 })}</p>
            <p>{t('rules.example.line', { pos: 2, name: 'Charles Leclerc', pts: 18 })}</p>
            <p>{t('rules.example.line', { pos: 3, name: 'Lando Norris', pts: 15 })}</p>
            <p>{t('rules.example.line', { pos: 5, name: 'Lewis Hamilton', pts: 10 })}</p>
          </div>
          <p className="text-f1-yellow-500 font-bold">{t('rules.example.score')}</p>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
            <li>
              <strong>Verstappen:</strong> {t('rules.example.ver')} <span className="text-green-400">{ptsShort(25)}</span>
            </li>
            <li>
              <strong>Hamilton:</strong> {t('rules.example.ham')} <span className="text-gray-400">{ptsShort(0)}</span>
            </li>
            <li>
              <strong>Leclerc:</strong> {t('rules.example.lec')} <span className="text-yellow-400">{ptsShort(8)}</span>
            </li>
          </ul>
          <p className="mt-4 font-bold">{t('rules.example.total')}</p>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><span className="inline-block mr-2">🏃</span>{t('rules.sprint.title')}</h2>
          <p className="mb-4"><Rich text={t('rules.sprint.intro')} /></p>

          <div className="bg-f1-yellow-900/20 border border-f1-yellow-500/50 p-4 mb-4">
            <h3 className="text-lg font-bold text-f1-yellow-400 mb-2">{t('rules.sprint.pointsTitle')}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {SPRINT_POINTS.map((p, i) => (
                <div key={i} className="bg-gray-900 p-2">
                  <span className="text-f1-yellow-400 font-bold">{ordinal(i + 1, lang)}:</span> {ptsShort(p)}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white"><Rich text={t('rules.sprint.footer')} /></p>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><CheckeredFlagIcon />{t('rules.season.title')}</h2>
          <p>{t('rules.season.text')}</p>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><BellIcon />{t('rules.notif.title')}</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>{t('rules.notif.1')}</li>
            <li>{t('rules.notif.2')}</li>
            <li>{t('rules.notif.3')}</li>
          </ul>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><CheckeredFlagIcon />{t('rules.processing.title')}</h2>
          <p className="mb-4">{t('rules.processing.intro')}</p>
          <div className="space-y-4">
            <div className="bg-f1-blue-dark/30 border border-f1-blue/50 p-4">
              <h3 className="text-lg font-bold text-f1-blue mb-2">{t('rules.stage1.title')}</h3>
              <p className="text-sm">{t('rules.stage1.text')}</p>
            </div>
            <div className="bg-purple-900/30 border border-purple-500/50 p-4">
              <h3 className="text-lg font-bold text-purple-400 mb-2">{t('rules.stage2.title')}</h3>
              <p className="text-sm">{t('rules.stage2.text')}</p>
            </div>
          </div>
          <p className="text-white mt-4 text-sm"><Rich text={t('rules.stages.note')} /></p>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><ClockIcon />{t('rules.fair.title')}</h2>
          <p>{t('rules.fair.text')}</p>
        </section>

        <section className="bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-yellow-500"><HelpCircleIcon />{t('rules.questions.title')}</h2>
          <p>{t('rules.questions.text')}</p>
        </section>
      </div>
    </div>
  );
};

export default Rules;
