import { Link } from 'react-router-dom';
import { useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

const RacingFlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);
const CheckeredFlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);
const HelmetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 2C8 2 5 5 5 9v6c0 1 1 2 2 2h10c1 0 2-1 2-2V9c0-4-3-7-7-7z"/>
    <path d="M5 11h14M5 15h14"/>
  </svg>
);
const TeamIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);
const PredictionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="0" ry="0"/>
  </svg>
);
const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const WrenchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const Navigation = ({ isOpen, onClose }: NavigationProps) => {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
  }, [isOpen]);

  const menuItems = [
    { path: '/',            label: 'Homepage',      icon: <RacingFlagIcon /> },
    { path: '/races',       label: 'Race Overview', icon: <CheckeredFlagIcon /> },
    { path: '/drivers',     label: 'Drivers',       icon: <HelmetIcon /> },
    { path: '/teams',       label: 'Teams',         icon: <TeamIcon /> },
    { path: '/leaderboard', label: 'Championship',  icon: <TrophyIcon /> },
  ];
  if (user) menuItems.push({ path: '/predictions', label: 'My Predictions', icon: <PredictionIcon /> });
  menuItems.push({ path: '/stats', label: 'Statistics', icon: <ChartIcon /> });

  const footerItems = [
    { path: '/rules',   label: 'Rules',          icon: <ClipboardIcon /> },
    { path: '/about',   label: 'About',          icon: <InfoIcon /> },
    { path: '/privacy', label: 'Privacy Policy', icon: <ShieldIcon /> },
    { path: '/pitlane', label: 'Pitlane',        icon: <WrenchIcon /> },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 transition-opacity duration-200"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-60 z-50 transform transition-transform duration-200 shadow-2xl border-r border-f1-neutral-800 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#0A0A0A' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-f1-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-f1-pink-500" />
            <span className="font-f1 font-black text-white text-sm uppercase tracking-widest">Poule Position</span>
          </div>
          <button
            onClick={onClose}
            className="text-f1-neutral-500 hover:text-f1-pink-500 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-3 text-sm font-semibold text-f1-neutral-300 hover:text-white hover:bg-f1-neutral-900 border-l-2 border-transparent hover:border-f1-pink-500 transition-all duration-150 py-3 px-4 uppercase tracking-wider"
                >
                  <span className="text-f1-neutral-500">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer nav */}
        <div className="border-t border-f1-neutral-800 py-2">
          <ul>
            {footerItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-3 text-xs text-f1-neutral-500 hover:text-f1-neutral-300 hover:bg-f1-neutral-900 border-l-2 border-transparent hover:border-f1-pink-600 transition-all duration-150 py-2.5 px-4 uppercase tracking-wider"
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
};

export default Navigation;
