import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api';
import LogoMark from '../components/LogoMark';
import { useLang } from '../i18n/LanguageContext';

// Landing page for the link in the password reset email.
const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const { t, tError } = useLang();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/auth'), 2500);
    } catch (err: any) {
      setError(tError(err.response?.data?.error, 'auth.somethingWrong'));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <LogoMark className="h-12 w-auto mx-auto mb-8" />
      <div className="card-f1 p-8 shadow-card-hover">
        <h2 className="text-3xl font-bold text-center mb-8 text-f1-yellow-500">{t('reset.title')}</h2>

        {!token ? (
          <div className="text-center">
            <p className="text-white mb-6">{t('reset.incomplete')}</p>
            <Link to="/auth" className="btn-f1-primary inline-block">
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : done ? (
          <div className="p-4 border-2 bg-green-900/30 border-green-500 text-green-400">
            <p className="font-semibold">{t('reset.done')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">{t('reset.newPassword')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-f1 w-full"
                placeholder={t('reset.newPasswordPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">{t('reset.confirm')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="input-f1 w-full"
                placeholder={t('reset.confirmPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-f1-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('reset.saving') : t('reset.save')}
            </button>

            {error && (
              <div className="p-4 border-2 bg-red-900/30 border-red-500 text-red-400">
                <p className="font-semibold">{error}</p>
                {error === tError('This reset link is invalid or has expired. Please request a new one.') && (
                  <Link to="/auth" className="underline text-sm">
                    {t('reset.requestNew')}
                  </Link>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
