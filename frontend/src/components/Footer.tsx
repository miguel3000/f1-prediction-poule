import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-solid mt-12 pb-24 md:pb-0">
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-f1-neutral-500">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="font-bold text-f1-neutral-400">&copy; {currentYear} Poule Position</span>
            <Link to="/rules" className="hover:text-f1-pink-500 transition-colors">Rules</Link>
            <Link to="/about" className="hover:text-f1-pink-500 transition-colors">About</Link>
            <Link to="/privacy" className="hover:text-f1-pink-500 transition-colors">Privacy</Link>
            <a href="mailto:matt.gloudemans@gmail.com" className="hover:text-f1-pink-500 transition-colors">Contact</a>
          </div>
          <p className="text-center md:text-right max-w-md">
            Unofficial fan project, not associated with Formula 1® companies. F1, FORMULA ONE and related
            marks are trademarks of Formula One Licensing BV.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
