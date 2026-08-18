import logo from '../assets/poule-position-logo.png';

interface LogoMarkProps {
  variant?: 'full' | 'icon';
  className?: string;
}

const LogoMark = ({ className = '' }: LogoMarkProps) => (
  <img src={logo} alt="Poule Position" className={`object-contain ${className}`} />
);

export default LogoMark;
