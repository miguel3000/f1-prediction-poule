import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePitwall?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin, requirePitwall }: ProtectedRouteProps) => {
  const { user, token } = useContext(AuthContext);

  if (!token) return <Navigate to="/auth" replace />;

  // On a fresh page load the token is known before the profile fetch resolves —
  // wait for it rather than briefly redirecting an admin away from /pitlane.
  if (requireAdmin && user === null) return null;
  if (requireAdmin && !user?.is_admin) return <Navigate to="/" replace />;

  // Pit Wall is for players the admin has granted access (admins always have it).
  // The backend re-checks this on every request; this only keeps the page out of sight.
  if (requirePitwall && user === null) return null;
  if (requirePitwall && !(user?.pitwall_access || user?.is_admin)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
