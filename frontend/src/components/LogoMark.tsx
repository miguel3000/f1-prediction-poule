interface LogoMarkProps {
  variant?: 'full' | 'icon';
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

  return (
    <svg viewBox="0 0 520 150" className={className} role="img" aria-label="Poule Position">
      {/* Speed streak — motion cue trailing the badge */}
      <g fill="#ffcc00" opacity="0.5">
        <polygon points="6,120 24,120 46,34 28,34" />
        <polygon points="18,120 36,120 58,34 40,34" />
      </g>
      <g transform="skewX(-10)">
        <rect x="38" y="40" width="58" height="58" fill="#ffcc00" />
        <text x="67" y="80" fontFamily="Michroma, sans-serif" fontSize="26" fontWeight={700} fill="#000" textAnchor="middle">P1</text>
        <rect x="104" y="40" width="220" height="27" fill="#3d7dbf" />
        <text x="116" y="60" fontFamily="'Big Shoulders Display', sans-serif" fontWeight={800} fontSize="20" fill="#fff" letterSpacing="1">POULE</text>
        <rect x="104" y="71" width="250" height="27" fill="#15304f" />
        <text x="116" y="91" fontFamily="'Big Shoulders Display', sans-serif" fontWeight={800} fontSize="20" fill="#ffcc00" letterSpacing="1">POSITION</text>
      </g>
      {/* Checkered corner */}
      <g transform="translate(452,16)">
        <rect x="0" y="0" width="12" height="12" fill="#fff" /><rect x="12" y="0" width="12" height="12" fill="#0a0a0a" />
        <rect x="0" y="12" width="12" height="12" fill="#0a0a0a" /><rect x="12" y="12" width="12" height="12" fill="#fff" />
        <rect x="24" y="0" width="12" height="12" fill="#fff" /><rect x="24" y="12" width="12" height="12" fill="#0a0a0a" />
        <rect x="0" y="24" width="12" height="12" fill="#0a0a0a" /><rect x="12" y="24" width="12" height="12" fill="#fff" /><rect x="24" y="24" width="12" height="12" fill="#0a0a0a" />
      </g>
    </svg>
  );
};

export default LogoMark;
