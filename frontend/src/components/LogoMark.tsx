interface LogoMarkProps {
  variant?: 'full' | 'icon' | 'square';
  className?: string;
}

// "Slanted Speed" mark — yellow P1 badge + two-tone blue name bar, forward-skewed,
// reconstructing the F1 Digital+ "Master channel" name-row convention researched
// for the 1996-2002 retro re-skin. Built as SVG, not a raster asset, so it recolors
// with the design system instead of needing a new export every palette change.
const LogoMark = ({ variant = 'full', className = '' }: LogoMarkProps) => {
  if (variant === 'icon') {
    return (
      <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Poule Position">
        <rect width="120" height="120" fill="#0a0a0a" />
        <g transform="translate(60,60) skewX(-10) translate(-60,-60)">
          <rect x="14" y="18" width="60" height="60" fill="#ffcc00" />
          <text x="44" y="60" fontFamily="Michroma, sans-serif" fontSize="26" fontWeight={700} fill="#000" textAnchor="middle">P1</text>
          <rect x="14" y="82" width="92" height="16" fill="#3d7dbf" />
        </g>
      </svg>
    );
  }

  // Square (1:1) lockup — badge stacked over the two name bars, for anywhere a
  // horizontal wordmark doesn't fit: social avatars, share cards, square tiles.
  if (variant === 'square') {
    return (
      <svg viewBox="0 0 300 300" className={className} role="img" aria-label="Poule Position">
        <rect width="300" height="300" fill="#0a0a0a" />
        <g transform="skewX(-10)">
          <polygon points="58,30 70,30 62,130 50,130" fill="#ffcc00" opacity="0.5" />
          <rect x="70" y="30" width="160" height="100" fill="#ffcc00" />
          <text x="150" y="100" fontFamily="Michroma, sans-serif" fontSize="50" fontWeight={700} fill="#000" textAnchor="middle">P1</text>
          <rect x="70" y="140" width="160" height="40" fill="#3d7dbf" />
          <text x="84" y="168" fontFamily="'Big Shoulders Display', sans-serif" fontWeight={800} fontSize="26" fill="#fff" letterSpacing="1">POULE</text>
          <rect x="70" y="190" width="160" height="40" fill="#15304f" />
          <text x="84" y="218" fontFamily="'Big Shoulders Display', sans-serif" fontWeight={800} fontSize="26" fill="#ffcc00" letterSpacing="1">POSITION</text>
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 520 150" className={className} role="img" aria-label="Poule Position">
      <g transform="skewX(-10)">
        {/* Speed streak — flush against the badge's left edge, same height, so it
            can't poke out past the badge's top/bottom corners after the skew */}
        <polygon points="26,40 38,40 30,98 18,98" fill="#ffcc00" opacity="0.5" />
        <rect x="38" y="40" width="58" height="58" fill="#ffcc00" />
        <text x="67" y="80" fontFamily="Michroma, sans-serif" fontSize="26" fontWeight={700} fill="#000" textAnchor="middle">P1</text>
        <rect x="104" y="40" width="340" height="27" fill="#3d7dbf" />
        <text x="116" y="60" fontFamily="'Big Shoulders Display', sans-serif" fontWeight={800} fontSize="20" fill="#fff" letterSpacing="1">POULE</text>
        <rect x="104" y="71" width="370" height="27" fill="#15304f" />
        <text x="116" y="91" fontFamily="'Big Shoulders Display', sans-serif" fontWeight={800} fontSize="20" fill="#ffcc00" letterSpacing="1">POSITION</text>
      </g>
    </svg>
  );
};

export default LogoMark;
