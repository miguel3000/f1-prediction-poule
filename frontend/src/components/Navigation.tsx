import { Link } from 'react-router-dom';
import { useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

// Racing-themed SVG Icons
const RacingFlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);

const CheckeredFlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
    <path d="M8 3v4M12 3v4M16 3v4M8 11v4M12 11v4M16 11v4" strokeWidth="1"/>
  </svg>
);

const HelmetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M12 2C8 2 5 5 5 9v6c0 1 1 2 2 2h10c1 0 2-1 2-2V9c0-4-3-7-7-7z"/>
    <path d="M5 11h14"/>
    <path d="M5 15h14"/>
    <circle cx="9" cy="9" r="1" fill="currentColor"/>
    <circle cx="15" cy="9" r="1" fill="currentColor"/>
  </svg>
);

const TeamIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
    <line x1="9" y1="16" x2="15" y2="16"/>
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const PredictionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const WrenchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const Navigation = ({ isOpen, onClose }: NavigationProps) => {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  const menuItems = [
    { path: '/', label: 'Homepage', icon: <RacingFlagIcon /> },
    { path: '/races', label: 'Race Overview', icon: <CheckeredFlagIcon /> },
    { path: '/drivers', label: 'Drivers', icon: <HelmetIcon /> },
    { path: '/teams', label: 'Teams', icon: <TeamIcon /> },
    { path: '/leaderboard', label: 'Championship', icon: <TrophyIcon /> },
  ];

  // Add predictions link if user is logged in
  if (user) {
    menuItems.push({ path: '/predictions', label: 'My Predictions', icon: <PredictionIcon /> });
  }

  // Statistics always at the end of main menu
  menuItems.push({ path: '/stats', label: 'Statistics', icon: <ChartIcon /> });

  // Footer menu items (always visible)
  const footerMenuItems = [
    { path: '/rules', label: 'Rules', icon: <ClipboardIcon /> },
    { path: '/about', label: 'About', icon: <InfoIcon /> },
    { path: '/privacy', label: 'Privacy Policy', icon: <ShieldIcon /> },
    { path: '/pitlane', label: 'Admin', icon: <WrenchIcon /> },
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-f1-neutral-900 border-r border-f1-red-500/50 z-50 transform transition-transform duration-300 shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <button
            onClick={onClose}
            className="text-white hover:text-f1-red-500 transition-all duration-300 mb-8 hover:scale-110"
            aria-label="Close menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <nav className="flex flex-col h-[calc(100vh-120px)]">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className="flex items-center gap-3 text-lg hover:text-f1-red-500 transition-all duration-300 py-3 px-4 rounded-lg hover:bg-f1-neutral-850 hover:translate-x-1 group"
                  >
                    <span className="group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                    <span className="font-semibold">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Footer section */}
            <div className="mt-auto pt-4 border-t border-gray-700">
              <ul className="space-y-2">
                {footerMenuItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={onClose}
                      className="flex items-center gap-3 text-sm hover:text-f1-red-500 transition-all duration-300 py-2 px-4 rounded-lg hover:bg-f1-neutral-850 hover:translate-x-1 group text-f1-gray"
                    >
                      <span className="group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Navigation;
