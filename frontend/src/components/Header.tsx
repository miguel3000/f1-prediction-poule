import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import LogoMark from './LogoMark';

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header = ({ onMenuToggle }: HeaderProps) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-f1-neutral-800" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">

          {/* Hamburger */}
          <button
            onClick={onMenuToggle}
            className="text-white hover:text-f1-pink-500 transition-colors p-1"
            aria-label="Toggle menu"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <div className="flex-1 flex items-center justify-center">
            {/* Full wordmark on md+, icon only on mobile */}
            <button onClick={() => navigate('/')} className="focus:outline-none select-none" aria-label="Poule Position home">
              <LogoMark variant="full" className="hidden md:block h-10 w-auto" />
              <LogoMark variant="icon" className="block md:hidden h-9 w-9" />
            </button>
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div
                  className="hidden md:block text-right cursor-pointer"
                  onClick={() => navigate('/profile')}
                >
                  <p className="text-sm font-bold text-white hover:text-f1-pink-400 transition-colors">{user.nickname}</p>
                  <p className="text-xs text-f1-pink-500 font-mono font-semibold tabular-nums">{user.total_points} PTS</p>
                </div>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.nickname}
                    className="w-9 h-9 border-2 border-f1-pink-500 cursor-pointer object-cover"
                    style={{ borderRadius: 0 }}
                    onClick={() => navigate('/profile')}
                  />
                ) : (
                  <div
                    className="w-9 h-9 border border-f1-neutral-700 bg-f1-neutral-850 flex items-center justify-center text-sm font-black cursor-pointer hover:border-f1-pink-500 transition-colors"
                    onClick={() => navigate('/profile')}
                  >
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={logout}
                  className="text-xs text-f1-neutral-500 hover:text-f1-pink-400 transition-colors font-bold uppercase tracking-wider"
                >
                  Out
                </button>
              </>
            ) : (
              <a
                href="/auth"
                className="btn-f1-primary px-5 py-2 text-sm"
              >
                Login
              </a>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
