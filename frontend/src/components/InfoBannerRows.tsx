import React from 'react';

// Generalization of Banner.tsx's homepage countdown rows (same full-bleed,
// skewed-divider, label/value stack) to an arbitrary number of rows instead
// of exactly 3 — used wherever a page wants that same banner motif to show a
// list of info pairs rather than a race countdown.
export interface InfoBannerRow {
  label: string;
  value: React.ReactNode;
}

interface InfoBannerRowsProps {
  rows: InfoBannerRow[];
}

const COLORS = ['#2596C7', '#FFD81A', '#005277']; // blue, yellow, navy — cycles if more rows than colors

// Full-bleed: breaks out of the page's centered max-width container to span
// the whole viewport, regardless of how deep it's nested. Same trick as Banner.tsx.
const fullBleed: React.CSSProperties = {
  width: '100vw',
  position: 'relative',
  left: '50%',
  right: '50%',
  marginLeft: '-50vw',
  marginRight: '-50vw',
};

const rowGrid = 'relative grid items-center px-4 py-3 sm:py-4 overflow-hidden';
const shear: React.CSSProperties = { transform: 'skewX(-13deg)', display: 'inline-block' };
const bigType = 'font-brand tracking-wide uppercase leading-none';
const sizeWide = 'text-sm sm:text-lg md:text-2xl';

const Divider = ({ offset = 0 }: { offset?: number }) => (
  <div
    className="absolute top-0 bottom-0 left-1/2 w-2 pointer-events-none"
    style={{ backgroundColor: '#191517', transform: `translateX(calc(-50% + ${offset}px)) skewX(-13deg)` }}
  />
);

const InfoBannerRows = ({ rows }: InfoBannerRowsProps) => {
  const n = rows.length;
  // Linear offset across the stack approximates one continuous diagonal cut
  // through all rows, the same way Banner.tsx hand-tuned +8/0/-8 for its
  // fixed 3 rows — generalized here to however many rows are passed in.
  const mid = (n - 1) / 2;
  const step = 8;

  return (
    <div className="w-full border-b border-f1-neutral-800" style={{ backgroundColor: '#191517' }}>
      <div style={fullBleed} className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const bg = COLORS[i % COLORS.length];
          const offset = Math.round((mid - i) * step);
          return (
            <div
              key={i}
              className={rowGrid}
              style={{ backgroundColor: bg, gridTemplateColumns: `calc(50% + ${offset}px) calc(50% - ${offset}px)` }}
            >
              <Divider offset={offset} />
              <span className={`text-white ${bigType} ${sizeWide} text-right truncate pr-3`} style={shear}>
                {row.label}
              </span>
              <span className={`text-white ${bigType} ${sizeWide} text-left truncate pl-3`} style={shear}>
                {row.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InfoBannerRows;
