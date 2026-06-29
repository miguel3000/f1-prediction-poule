import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-solid border-t border-gray-800 mt-12">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-f1-pink-500 font-bold text-lg mb-3">F1 Prediction Poule</h3>
            <p className="text-f1-gray text-sm">
              Test your Formula 1 knowledge by predicting race results and competing on the leaderboard.
              Free to play, built for F1 fans.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-f1-gray hover:text-f1-pink-500 transition-colors">
                  Homepage
                </Link>
              </li>
              <li>
                <Link to="/races" className="text-f1-gray hover:text-f1-pink-500 transition-colors">
                  Race Overview
                </Link>
              </li>
              <li>
                <Link to="/leaderboard" className="text-f1-gray hover:text-f1-pink-500 transition-colors">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link to="/rules" className="text-f1-gray hover:text-f1-pink-500 transition-colors">
                  Rules
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">Legal & Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-f1-gray hover:text-f1-pink-500 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-f1-gray hover:text-f1-pink-500 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a
                  href="mailto:matt.gloudemans@gmail.com"
                  className="text-f1-gray hover:text-f1-pink-500 transition-colors"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-gray-800 text-center text-sm text-f1-gray">
          <p className="mb-2">
            &copy; {currentYear} F1 Prediction Poule. All rights reserved.
          </p>
          <p className="text-xs">
            This website is unofficial and is not associated in any way with Formula 1® companies.
            F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks
            are trademarks of Formula One Licensing BV.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
