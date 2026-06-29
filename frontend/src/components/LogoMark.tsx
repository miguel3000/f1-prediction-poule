interface LogoMarkProps {
  variant?: 'full' | 'icon';
  className?: string;
}

const LogoMark = ({ variant = 'full', className = '' }: LogoMarkProps) => {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Poule Position"
      >
        <rect width="48" height="48" fill="#080808" />
        {/* Pink left bar */}
        <rect x="0" y="0" width="5" height="48" fill="#E6007E" />
        {/* P — white */}
        <text
          x="11"
          y="32"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontSize="30"
          fill="#FFFFFF"
          letterSpacing="-1"
        >
          P
        </text>
        {/* P — pink */}
        <text
          x="28"
          y="32"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontSize="30"
          fill="#E6007E"
          letterSpacing="-1"
        >
          P
        </text>
        {/* Pink bottom bar */}
        <rect x="0" y="43" width="48" height="5" fill="#E6007E" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 220 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Poule Position"
    >
      {/* Pink left accent bar */}
      <rect x="0" y="0" width="5" height="48" fill="#E6007E" />

      {/* POULE — white */}
      <text
        x="14"
        y="22"
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="19"
        fill="#FFFFFF"
        letterSpacing="4"
      >
        POULE
      </text>

      {/* POSITION — pink */}
      <text
        x="14"
        y="42"
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="19"
        fill="#E6007E"
        letterSpacing="2.5"
      >
        POSITION
      </text>
    </svg>
  );
};

export default LogoMark;
