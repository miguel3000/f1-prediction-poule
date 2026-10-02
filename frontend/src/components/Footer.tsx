import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useLang();

  return (
    // Mobile/tablet (incl. landscape, up to xl): these links already live in
    // the "More" drawer, so skip the footer here — kept in sync with Header's
    // and BottomTabBar's own xl breakpoint.
    <footer className="footer-solid mt-12 hidden xl:block">
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-f1-neutral-500">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="font-bold text-f1-neutral-400">&copy; {currentYear} Poule Position</span>
            <Link to="/rules" className="hover:text-f1-yellow-500 transition-colors">{t('nav.rules')}</Link>
            <Link to="/about" className="hover:text-f1-yellow-500 transition-colors">{t('nav.about')}</Link>
            <Link to="/privacy" className="hover:text-f1-yellow-500 transition-colors">{t('nav.privacyShort')}</Link>
            <a href="mailto:jameshuntf1prediction@gmail.com" className="hover:text-f1-yellow-500 transition-colors">{t('nav.contact')}</a>
          </div>
          <p className="text-center md:text-right max-w-md">
            {t('footer.disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
