import logo from '../assets/poule-position-logo.svg';

interface LogoMarkProps {
  className?: string;
}

const LogoMark = ({ className = '' }: LogoMarkProps) => (
  <img src={logo} alt="Poule Position" className={`object-contain ${className}`} />
);

export default LogoMark;
