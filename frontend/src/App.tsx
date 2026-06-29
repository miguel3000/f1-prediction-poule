import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import Homepage from './pages/Homepage';
import RaceOverview from './pages/RaceOverview';
import DriverStandings from './pages/DriverStandings';
import Leaderboard from './pages/Leaderboard';
import Rules from './pages/Rules';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import PrivacyPolicy from './pages/PrivacyPolicy';
import About from './pages/About';
import MyPredictions from './pages/MyPredictions';
import Stats from './pages/Stats';
import Teams from './pages/Teams';
import { AuthContext } from './context/AuthContext';
import { getProfile } from './services/api';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    // Check if user is logged in
    if (token) {
      fetchUserProfile();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // Token is invalid, clear it
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <Router>
        <div className="min-h-screen text-white flex flex-col" style={{ backgroundColor: '#080808' }}>
          <Header onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} />
          <Navigation isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

          <main className="container mx-auto px-4 py-8 relative z-10 flex-grow">
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/races" element={<RaceOverview />} />
              <Route path="/drivers" element={<DriverStandings />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/pitlane" element={<Admin />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/predictions" element={<MyPredictions />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
