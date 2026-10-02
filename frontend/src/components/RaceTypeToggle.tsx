import { useLang } from '../i18n/LanguageContext';

interface RaceTypeToggleProps {
  value: 'sprint' | 'main';
  onChange: (value: 'sprint' | 'main') => void;
}

// Same signage language as Banner: full-bleed light-blue bar, 13°-sheared
// text split by a divider the same color as the bar (so it reads as a cut,
// not a line). Used where Banner needs a second, single-row bar rather than
// a generic pill toggle.
const RaceTypeToggle = ({ value, onChange }: RaceTypeToggleProps) => {
  const { t } = useLang();
  const fullBleed: React.CSSProperties = {
    width: '100vw',
    position: 'relative',
    left: '50%',
    right: '50%',
    marginLeft: '-50vw',
    marginRight: '-50vw',
  };
  const shear: React.CSSProperties = { transform: 'skewX(-13deg)', display: 'inline-block' };
  const bigType = 'font-brand tracking-wide uppercase leading-none';
  // Matches Banner's own row sizing exactly, so this bar reads as the same
  // height as the banner rows above it, not a shorter afterthought.
  const sizeWide = 'text-lg sm:text-2xl md:text-4xl lg:text-5xl';

  const optionClass = (active: boolean) =>
    `bg-transparent border-0 p-0 cursor-pointer transition-opacity truncate ${bigType} ${sizeWide} text-white ${
      active ? 'opacity-100' : 'opacity-50 hover:opacity-75'
    }`;

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      <div
        style={{ ...fullBleed, backgroundColor: '#2596C7', gridTemplateColumns: '50% 50%' }}
        className="relative grid items-center px-4 py-4 sm:py-6 overflow-hidden"
      >
        <div
          className="absolute top-0 bottom-0 left-1/2 w-2 pointer-events-none"
          style={{ backgroundColor: '#191517', transform: 'translateX(-50%) skewX(-13deg)' }}
        />
        <button onClick={() => onChange('sprint')} className={`${optionClass(value === 'sprint')} text-right pr-3`} style={shear}>
          {t('toggle.sprint')}
        </button>
        <button onClick={() => onChange('main')} className={`${optionClass(value === 'main')} text-left pl-3`} style={shear}>
          {t('toggle.main')}
        </button>
      </div>
    </div>
  );
};

export default RaceTypeToggle;
