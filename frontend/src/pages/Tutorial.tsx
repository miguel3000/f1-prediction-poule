import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import Rich from '../components/Rich';

// The game, step by step, with examples. The illustrations are built from the same
// pieces as the real prediction screen (yellow car-number square + blue name bar), and
// the "try it" calculator uses exactly the scoring rules the site scores with.

const MAIN_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

// ── building blocks ────────────────────────────────────────────────────────
const StepHeader = ({ n, title }: { n: number; title: string }) => (
  <div className="flex items-stretch min-h-[3rem] mb-4">
    <div className="w-12 shrink-0 bg-f1-yellow-500 flex items-center justify-center font-f1-badge font-bold text-black text-lg">
      {n}
    </div>
    <div className="flex-1 min-w-0 bg-f1-blue flex items-center px-4 py-2">
      <h2 className="font-brand uppercase tracking-wide text-white text-2xl leading-none">{title}</h2>
    </div>
  </div>
);

const Chip = ({ number, name }: { number: number; name: string }) => (
  <>
    <div className="w-9 shrink-0 bg-f1-yellow-500 flex items-center justify-center">
      <span className="font-f1-badge font-bold text-black tabular-nums text-xs">{number}</span>
    </div>
    <div className="flex-1 min-w-0 bg-f1-blue flex items-center px-2">
      <span className="font-f1 font-black text-white uppercase tracking-wide truncate leading-none text-sm">{name}</span>
    </div>
  </>
);

const Panel = ({ children }: { children: React.ReactNode }) => (
  <section className="card-f1 !p-5 sm:!p-6">{children}</section>
);

const Text = ({ text }: { text: string }) => (
  <p className="text-white leading-relaxed">
    <Rich text={text} />
  </p>
);

// A static picture of the prediction screen: drivers on the left, the grid on the right.
const GridMock = () => {
  const { t } = useLang();
  const placed = [
    { number: 3, name: 'Verstappen' },
    { number: 16, name: 'Leclerc' },
    { number: 44, name: 'Hamilton' },
  ];
  const free = [
    { number: 12, name: 'Antonelli' },
    { number: 1, name: 'Norris' },
  ];

  return (
    <figure className="mt-4" aria-label={t('tutorial.s2.caption')}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-bold text-f1-yellow-500 uppercase tracking-widest mb-1.5">{t('tutorial.s2.listLabel')}</p>
          <div className="space-y-1">
            {[...placed.map((d) => ({ ...d, done: true })), ...free.map((d) => ({ ...d, done: false }))].map((d) => (
              <div key={d.number} className={`flex items-stretch h-10 border-l-4 border-f1-neutral-600 ${d.done ? 'opacity-30' : ''}`}>
                <Chip number={d.number} name={d.name} />
                <div className="w-7 shrink-0 bg-f1-neutral-850 flex items-center justify-center">
                  {d.done ? <span className="text-green-400 text-sm font-bold">✓</span> : <span className="text-white text-lg font-light">+</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-f1-yellow-500 uppercase tracking-widest mb-1.5">{t('tutorial.s2.gridLabel')}</p>
          <div className="bg-f1-neutral-900 border border-f1-neutral-800 p-2 space-y-1">
            {[1, 2, 3, 4].map((pos) => {
              const d = placed[pos - 1];
              return (
                <div key={pos} className="flex items-center gap-1.5">
                  <span className={`w-5 text-center text-xs font-black tabular-nums ${pos === 1 ? 'text-f1-yellow-500' : 'text-white'}`}>{pos}</span>
                  {d ? (
                    <div className="flex-1 min-w-0 h-10 flex items-stretch border-l-4 border-f1-neutral-600">
                      <Chip number={d.number} name={d.name} />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0 h-10 flex items-center justify-center border-l-4 border-dashed border-f1-neutral-700 bg-f1-neutral-900/40">
                      <span className="text-[9px] tracking-wider uppercase text-white">{t('tutorial.s2.empty')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-white/70">{t('tutorial.s2.caption')}</figcaption>
    </figure>
  );
};

// ── the "try it" points calculator ─────────────────────────────────────────
const PointsCalculator = () => {
  const { t } = useLang();
  const [kind, setKind] = useState<'main' | 'sprint'>('main');
  const [predicted, setPredicted] = useState(3);
  const [finished, setFinished] = useState<number | 'out'>(2);
  const [bonus, setBonus] = useState(false);

  const count = kind === 'main' ? 10 : 8;
  const table = kind === 'main' ? MAIN_POINTS : SPRINT_POINTS;
  const positions = Array.from({ length: count }, (_, i) => i + 1);

  const changeKind = (next: 'main' | 'sprint') => {
    const max = next === 'main' ? 10 : 8;
    setKind(next);
    setPredicted((p) => Math.min(p, max));
    setFinished((f) => (f === 'out' || f > max ? 'out' : f));
    if (next === 'sprint') setBonus(false);
  };

  // Same rules the site scores with: points come from the PREDICTED position; exact = full,
  // one off = half (rounded), anything else, or outside the scored positions, = nothing.
  const base = table[predicted - 1];
  let outcome: 'exact' | 'near' | 'miss' = 'miss';
  let points = 0;
  if (finished !== 'out') {
    const diff = Math.abs(predicted - finished);
    if (diff === 0) {
      outcome = 'exact';
      points = base;
    } else if (diff === 1) {
      outcome = 'near';
      points = Math.round(base * 0.5);
    }
  }
  const bonusPoints = kind === 'main' && bonus ? 25 : 0;

  const ptsText = (n: number) => t(n === 1 ? 'tutorial.try.pt' : 'tutorial.try.pts', { n });
  const half = base / 2;

  const message =
    outcome === 'exact'
      ? t('tutorial.try.exact', { pts: ptsText(points), p: predicted })
      : outcome === 'near'
        ? Number.isInteger(half)
          ? t('tutorial.try.nearWhole', { base, pts: ptsText(points) })
          : t('tutorial.try.nearRounded', { base, half, pts: ptsText(points) })
        : t('tutorial.try.miss');

  return (
    <div>
      <p className="text-white mb-4">{t('tutorial.try.intro')}</p>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label htmlFor="try-kind" className="block text-xs font-bold text-f1-yellow-500 uppercase tracking-widest mb-1">
            {t('tutorial.try.race')}
          </label>
          <select id="try-kind" value={kind} onChange={(e) => changeKind(e.target.value as 'main' | 'sprint')} className="input-f1 w-full">
            <option value="main">{t('tutorial.s5.main')}</option>
            <option value="sprint">{t('tutorial.s5.sprint')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="try-predicted" className="block text-xs font-bold text-f1-yellow-500 uppercase tracking-widest mb-1">
            {t('tutorial.try.predicted')}
          </label>
          <select id="try-predicted" value={predicted} onChange={(e) => setPredicted(Number(e.target.value))} className="input-f1 w-full">
            {positions.map((p) => (
              <option key={p} value={p}>
                P{p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="try-finished" className="block text-xs font-bold text-f1-yellow-500 uppercase tracking-widest mb-1">
            {t('tutorial.try.finished')}
          </label>
          <select
            id="try-finished"
            value={finished}
            onChange={(e) => setFinished(e.target.value === 'out' ? 'out' : Number(e.target.value))}
            className="input-f1 w-full"
          >
            {positions.map((p) => (
              <option key={p} value={p}>
                P{p}
              </option>
            ))}
            <option value="out">{t('tutorial.try.outside', { n: count })}</option>
          </select>
        </div>
      </div>

      {kind === 'main' && (
        <label className="flex items-center gap-2 text-sm text-white mb-3 cursor-pointer">
          <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} className="w-4 h-4 accent-[#FFD81A]" />
          {t('tutorial.try.bonus')}
        </label>
      )}

      <div className="flex items-stretch min-h-[3.5rem]" role="status" aria-live="polite">
        <div className="w-16 shrink-0 bg-f1-yellow-500 flex items-center justify-center font-f1-badge font-bold text-black text-xl tabular-nums">
          {points}
        </div>
        <div className="flex-1 min-w-0 bg-f1-blue flex items-center px-4 py-2 text-white text-sm">{message}</div>
      </div>
      <p className="mt-2 font-brand uppercase tracking-wide text-xl text-f1-yellow-500">{t('tutorial.try.total', { pts: ptsText(points + bonusPoints) })}</p>
    </div>
  );
};

// ── page ───────────────────────────────────────────────────────────────────
const Tutorial = () => {
  const { t } = useLang();
  const { user } = useContext(AuthContext);

  const scale = (label: string, list: number[]) => (
    <div className="mb-3">
      <p className="text-xs text-white/70 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {list.map((p, i) => (
          <span key={i} className="inline-flex items-stretch text-xs">
            <span className="bg-f1-yellow-500 text-black font-f1-badge font-bold px-1.5 py-1 min-w-[2rem] text-center">P{i + 1}</span>
            <span className="bg-f1-blue text-white font-bold px-2 py-1 tabular-nums">{p}</span>
          </span>
        ))}
      </div>
    </div>
  );

  const exampleRows = [
    { name: 'Verstappen', predicted: 'P1', finished: 'P1', result: t('tutorial.example.exact'), points: 25 },
    { name: 'Hamilton', predicted: 'P2', finished: 'P5', result: t('tutorial.example.miss'), points: 0 },
    { name: 'Leclerc', predicted: 'P3', finished: 'P2', result: t('tutorial.example.near'), points: 8 },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-2 text-center text-f1-yellow-500">{t('tutorial.title')}</h1>
      <p className="text-center text-white mb-8">{t('tutorial.subtitle')}</p>

      <div className="space-y-6">
        <Panel>
          <StepHeader n={1} title={t('tutorial.s1.title')} />
          <Text text={t('tutorial.s1.text')} />
        </Panel>

        <Panel>
          <StepHeader n={2} title={t('tutorial.s2.title')} />
          <Text text={t('tutorial.s2.text')} />
          <GridMock />
          <p className="mt-4 text-sm text-white/80">{t('tutorial.s2.tip')}</p>
        </Panel>

        <Panel>
          <StepHeader n={3} title={t('tutorial.s3.title')} />
          <Text text={t('tutorial.s3.text')} />
          <div className="mt-4 bg-f1-neutral-950 border border-f1-neutral-800 px-3 py-2.5">
            <p className="flex items-center justify-between text-[10px] font-bold text-f1-yellow-500 uppercase tracking-widest mb-1.5">
              <span>{t('tutorial.s3.fieldLabel')}</span>
              <span className="text-white normal-case font-normal tracking-normal">{t('tutorial.s3.fieldHint')}</span>
            </p>
            <div className="w-full bg-f1-neutral-950 border border-f1-neutral-700 text-white text-sm px-3 py-2">Bottas</div>
          </div>
        </Panel>

        <Panel>
          <StepHeader n={4} title={t('tutorial.s4.title')} />
          <Text text={t('tutorial.s4.text')} />
          <div className="mt-4 space-y-1">
            {[
              { label: t('tutorial.s4.t1'), value: t('tutorial.s4.t1v'), bg: '#2596C7' },
              { label: t('tutorial.s4.t2'), value: t('tutorial.s4.t2v'), bg: '#FFD81A' },
              { label: t('tutorial.s4.t3'), value: t('tutorial.s4.t3v'), bg: '#005277' },
            ].map((row) => (
              <div key={row.label} className="flex flex-col sm:flex-row sm:items-center gap-x-4 px-4 py-2.5" style={{ backgroundColor: row.bg }}>
                <span className="font-brand uppercase tracking-wide text-white text-lg leading-none sm:w-52 shrink-0">{row.label}</span>
                <span className="text-white text-sm">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-white leading-relaxed">{t('tutorial.s4.forgot')}</p>
        </Panel>

        <Panel>
          <StepHeader n={5} title={t('tutorial.s5.title')} />
          <Text text={t('tutorial.s5.text')} />
          <div className="mt-4 grid grid-cols-2 gap-0 bg-f1-blue max-w-md" aria-hidden="true">
            <div className="py-3 text-center font-brand uppercase tracking-wide text-white text-2xl leading-none" style={{ fontStyle: 'italic' }}>
              {t('tutorial.s5.sprint')}
            </div>
            <div className="py-3 text-center font-brand uppercase tracking-wide text-white/50 text-2xl leading-none border-l-8 border-f1-neutral-900" style={{ fontStyle: 'italic' }}>
              {t('tutorial.s5.main')}
            </div>
          </div>
        </Panel>

        <Panel>
          <StepHeader n={6} title={t('tutorial.s6.title')} />
          <Text text={t('tutorial.s6.text')} />
          <p className="mt-3 text-sm text-white/80">{t('tutorial.s6.spoiler')}</p>
        </Panel>

        <Panel>
          <h2 className="font-brand uppercase tracking-wide text-f1-yellow-500 text-3xl leading-none mb-4">{t('tutorial.score.title')}</h2>
          <Text text={t('tutorial.score.intro')} />

          <div className="mt-4 grid sm:grid-cols-3 gap-1">
            {[
              { title: t('tutorial.score.exact'), text: t('tutorial.score.exactText'), bg: 'bg-f1-blue' },
              { title: t('tutorial.score.near'), text: t('tutorial.score.nearText'), bg: 'bg-f1-blue-dark' },
              { title: t('tutorial.score.miss'), text: t('tutorial.score.missText'), bg: 'bg-f1-neutral-800' },
            ].map((c) => (
              <div key={c.title} className={`${c.bg} p-3 text-white`}>
                <p className="font-brand uppercase tracking-wide text-xl leading-none mb-1">{c.title}</p>
                <p className="text-sm">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="font-f1 font-bold uppercase tracking-wide text-white text-sm mb-2">{t('tutorial.score.scale')}</p>
            {scale(t('tutorial.score.scaleMain'), MAIN_POINTS)}
            {scale(t('tutorial.score.scaleSprint'), SPRINT_POINTS)}
          </div>

          <h3 className="font-brand uppercase tracking-wide text-white text-2xl leading-none mt-6 mb-2">{t('tutorial.example.title')}</h3>
          <p className="text-white mb-3">{t('tutorial.example.intro')}</p>
          <div>
            <div className="grid grid-cols-[1.2fr_1.8fr_0.6fr] bg-f1-yellow-500 text-black text-[10px] font-bold uppercase tracking-wider">
              <span className="px-3 py-2">{t('tutorial.example.colPredicted')}</span>
              <span className="px-3 py-2">
                {t('tutorial.example.colFinished')} / {t('tutorial.example.colResult')}
              </span>
              <span className="px-3 py-2 text-right">{t('tutorial.example.colPoints')}</span>
            </div>
            {exampleRows.map((row, i) => (
              <div key={row.name} className={`grid grid-cols-[1.2fr_1.8fr_0.6fr] items-center text-white text-sm ${i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}>
                <span className="px-3 py-2.5 font-f1 font-bold uppercase">
                  {row.name} <span className="text-white/70">{row.predicted}</span>
                </span>
                <span className="px-3 py-2.5">
                  <span className="font-f1-badge text-xs">{row.finished}</span>
                  <span className="block">{row.result}</span>
                </span>
                <span className={`px-3 py-2.5 text-right font-f1-badge font-bold ${row.points > 0 ? 'text-f1-yellow-400' : 'text-white/70'}`}>{row.points}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-white">
            <Rich text={t('tutorial.example.total')} />
          </p>

          <h3 className="font-brand uppercase tracking-wide text-white text-2xl leading-none mt-6 mb-2">{t('tutorial.try.title')}</h3>
          <PointsCalculator />
        </Panel>

        <Panel>
          <h2 className="font-brand uppercase tracking-wide text-f1-yellow-500 text-3xl leading-none mb-4">{t('tutorial.cta.title')}</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {user ? (
              <Link to="/" className="btn-f1-primary text-center">
                {t('tutorial.cta.predict')}
              </Link>
            ) : (
              <Link to="/auth" className="btn-f1-primary text-center">
                {t('tutorial.cta.register')}
              </Link>
            )}
            <Link to="/rules" className="btn-f1-secondary text-center">
              {t('tutorial.cta.rules')}
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default Tutorial;
