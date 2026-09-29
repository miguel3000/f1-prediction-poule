interface RaceWeekendBannerProps {
  raceName: string;
  venue?: string;
  round: number;
}

// Most "X Grand Prix · Y Circuit" combos run up to ~55 characters (checked
// against the current calendar); past that it reads as a wall of text at
// this font size, so fall back to a plain round number instead of an
// ellipsis mid-name.
const MAX_COMBINED_LENGTH = 58;

// Same signage bar as RaceTypeToggle (full-bleed, light blue, sheared type,
// identical height) — shown on non-sprint weekends instead of the toggle,
// so the slot below Banner is never just empty.
const RaceWeekendBanner = ({ raceName, venue, round }: RaceWeekendBannerProps) => {
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
  const sizeWide = 'text-lg sm:text-2xl md:text-4xl lg:text-5xl';

  // Try race name + venue first, drop down to just the race name if that's
  // too long, and only fall back to a bare round number if even the name
  // alone won't fit.
  const combined = venue ? `${raceName} · ${venue}` : raceName;
  const display =
    combined.length <= MAX_COMBINED_LENGTH ? combined :
    raceName.length <= MAX_COMBINED_LENGTH ? raceName :
    `Round ${round}`;

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      <div
        style={{ ...fullBleed, backgroundColor: '#2596C7' }}
        className="px-4 py-4 sm:py-6 text-center overflow-hidden"
      >
        <span className={`text-white ${bigType} ${sizeWide} truncate inline-block max-w-full`} style={shear}>
          {display}
        </span>
      </div>
    </div>
  );
};

export default RaceWeekendBanner;
