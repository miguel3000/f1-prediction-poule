import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { registerWithPassword, loginWithPassword, forgotPassword, getNicknameSuggestion, previewInvite } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import LogoMark from '../components/LogoMark';
import { useLang } from '../i18n/LanguageContext';

const Auth = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const { t, tError, lang } = useLang();

  // /auth?join=<code> comes from a group invite link: register by default (&mode=login for the
  // other tab), and the account joins the group once it is created.
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get('join');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [playsInMain, setPlaysInMain] = useState(true);
  useEffect(() => {
    setGroupName(null);
    setInviteInvalid(false);
    if (!joinCode) return;
    let cancelled = false;
    previewInvite(joinCode)
      .then((res) => { if (!cancelled) setGroupName(res.data.name); })
      .catch(() => { if (!cancelled) setInviteInvalid(true); });
    return () => { cancelled = true; };
  }, [joinCode]);

  const [isRegister, setIsRegister] = useState(!!joinCode && searchParams.get('mode') !== 'login');
  const [isForgot, setIsForgot] = useState(false);
  const [nickname, setNickname] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const suggestNickname = async () => {
    setSuggesting(true);
    setSuggestError(false);
    try {
      const response = await getNicknameSuggestion();
      setNickname(response.data.nickname);
    } catch {
      setSuggestError(true);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageOk(false);

    try {
      if (isForgot) {
        await forgotPassword(email);
        setMessage(t('auth.resetSent'));
        setMessageOk(true);
        setLoading(false);
        return;
      }
      if (isRegister) {
        if (password !== confirmPassword) {
          setMessage(t('auth.passwordsMismatch'));
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setMessage(t('auth.passwordTooShort'));
          setLoading(false);
          return;
        }
        const group = joinCode && groupName ? { joinCode, playsInMain } : undefined;
        const response = await registerWithPassword(nickname, email, password, lang, group);
        // Auto-login after registration
        login(response.data.token);
        // A player who came in through a group link lands on How to Play, with a note about the group.
        if (response.data.joinedGroup) {
          navigate('/tutorial', { state: { joinedGroup: response.data.joinedGroup } });
        } else {
          navigate('/');
        }
      } else {
        const response = await loginWithPassword(email, password);
        login(response.data.token);
        // Back to the invite page to accept it.
        navigate(joinCode ? `/join/${encodeURIComponent(joinCode)}` : '/');
      }
    } catch (error: any) {
      setMessage(tError(error.response?.data?.error, 'auth.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <LogoMark className="h-12 w-auto mx-auto mb-8" />
      <div className="card-f1 p-8 shadow-card-hover">
        <h2 className="text-3xl font-bold text-center mb-8 text-f1-yellow-500">
          {isForgot ? t('auth.resetTitle') : isRegister ? t('auth.register') : t('auth.login')}
        </h2>
        {isForgot && (
          <p className="text-white text-center -mt-4 mb-8 text-sm">
            {t('auth.resetIntro')}
          </p>
        )}

        {joinCode && !isForgot && (groupName || inviteInvalid) && (
          <p className="text-center mb-6 text-sm text-white bg-f1-blue-dark px-4 py-3" role="status">
            {groupName ? t('groups.auth.joining', { group: groupName }) : t('groups.auth.invalid')}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <div>
              <label className="block text-sm font-semibold mb-2">{t('auth.nickname')}</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="input-f1 w-full"
                placeholder={t('auth.nicknamePlaceholder')}
                maxLength={30}
              />
              <button
                type="button"
                onClick={suggestNickname}
                disabled={suggesting}
                className="mt-2 text-sm font-semibold text-f1-yellow-500 hover:underline disabled:opacity-60"
              >
                {t('auth.suggestNickname')}
              </button>
              {suggestError && <p className="mt-1 text-sm text-white">{t('auth.suggestFailed')}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-f1 w-full"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          {!isForgot && (
            <div>
              <label className="block text-sm font-semibold mb-2">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-f1 w-full"
                placeholder={t('auth.passwordPlaceholder')}
                minLength={6}
              />
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => { setIsForgot(true); setMessage(''); }}
                  className="mt-2 text-sm text-white/70 hover:text-f1-yellow-400 transition-colors"
                >
                  {t('auth.forgot')}
                </button>
              )}
            </div>
          )}

          {isRegister && !isForgot && (
            <div>
              <label className="block text-sm font-semibold mb-2">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-f1 w-full"
                placeholder={t('auth.confirmPasswordPlaceholder')}
                minLength={6}
              />
            </div>
          )}

          {isRegister && !isForgot && groupName && (
            <div>
              <label htmlFor="auth-plays-in-main" className="flex items-start gap-3 text-sm font-semibold cursor-pointer">
                <input
                  id="auth-plays-in-main"
                  type="checkbox"
                  checked={playsInMain}
                  onChange={(e) => setPlaysInMain(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-f1-yellow-500 flex-shrink-0"
                />
                <span>{t('groups.join.alsoMain')}</span>
              </label>
              <p className="mt-1 ml-7 text-xs text-white/70">{t('groups.join.alsoMainHelp')}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-f1-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {t('auth.processing')}
              </span>
            ) : isForgot ? (
              t('auth.sendReset')
            ) : isRegister ? (
              t('auth.register')
            ) : (
              t('auth.login')
            )}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 border-2 ${
            messageOk
              ? 'bg-green-900/30 border-green-500 text-green-400'
              : 'bg-red-900/30 border-red-500 text-red-400'
          }`}>
            <p className="font-semibold">{message}</p>
          </div>
        )}

        <div className="mt-6 text-center">
          {isForgot && (
            <button
              onClick={() => { setIsForgot(false); setMessage(''); }}
              className="block mx-auto mb-3 text-white hover:text-f1-yellow-400 transition-all duration-300 font-semibold"
            >
              {t('auth.backToLogin')}
            </button>
          )}
          <button
            onClick={() => {
              setIsForgot(false);
              setIsRegister(!isRegister);
              setMessage('');
            }}
            className="text-white hover:text-f1-yellow-400 transition-all duration-300 font-semibold"
          >
            {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
