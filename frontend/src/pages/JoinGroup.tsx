import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import LogoMark from '../components/LogoMark';
import { getMyGroups, joinGroup, previewInvite } from '../services/api';

type Preview = { state: 'loading' } | { state: 'invalid' } | { state: 'ok'; name: string };

// The page behind a group invite link (/join/<code>). Open to everyone: a stranger sees the group
// name and is sent to sign up, a signed-in player is asked whether to join.
const JoinGroup = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { t, tError } = useLang();
  const { user, token } = useContext(AuthContext);

  const [preview, setPreview] = useState<Preview>({ state: 'loading' });
  const [memberGroupId, setMemberGroupId] = useState<number | null>(null);
  const [alsoMain, setAlsoMain] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPreview({ state: 'loading' });
    previewInvite(code)
      .then((res) => { if (!cancelled) setPreview({ state: 'ok', name: res.data.name }); })
      .catch(() => { if (!cancelled) setPreview({ state: 'invalid' }); });
    return () => { cancelled = true; };
  }, [code]);

  // The profile arrives a moment after the token is read from storage.
  const signedIn = !!token && !!user;
  const profileLoading = !!token && !user;

  useEffect(() => {
    if (!signedIn || preview.state !== 'ok') return;
    getMyGroups()
      .then((res) => {
        // Keep the player's own choice about the main poule unless they change it here.
        setAlsoMain(res.data.playsInMain);
        // Group names are unique, so the name identifies the group.
        const mine = res.data.groups.find((g) => g.name === preview.name);
        setMemberGroupId(mine ? mine.id : null);
      })
      .catch(() => setMemberGroupId(null));
  }, [signedIn, preview]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      const res = await joinGroup(code, alsoMain);
      navigate(`/leaderboard?poule=${res.data.groupId}`);
    } catch (err: any) {
      setError(tError(err?.response?.data?.error, 'groups.actionFailed'));
      setJoining(false);
    }
  };

  if (preview.state === 'loading' || profileLoading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
      </div>
    );
  }

  if (preview.state === 'invalid') {
    return (
      <div className="max-w-md mx-auto mt-16">
        <LogoMark className="h-12 w-auto mx-auto mb-8" />
        <div className="card-f1 p-8 text-center">
          <h1 className="text-2xl font-bold text-f1-yellow-500 mb-3">{t('groups.join.invalidTitle')}</h1>
          <p className="text-white mb-6">{t('groups.join.invalidText')}</p>
          <Link to="/" className="btn-f1-primary inline-block">{t('groups.join.home')}</Link>
        </div>
      </div>
    );
  }

  const authLink = (extra = '') => `/auth?join=${encodeURIComponent(code)}${extra}`;

  return (
    <div className="max-w-md mx-auto mt-16">
      <LogoMark className="h-12 w-auto mx-auto mb-8" />
      <div className="card-f1 p-8 shadow-card-hover">
        {!signedIn ? (
          <>
            <h1 className="text-3xl font-bold text-center mb-3 text-f1-yellow-500 break-words">{preview.name}</h1>
            <p className="text-white text-center mb-6">{t('groups.join.loggedOutIntro', { group: preview.name })}</p>
            <div className="space-y-3">
              <Link to={authLink()} className="btn-f1-primary block text-center">{t('groups.join.register')}</Link>
              <Link to={authLink('&mode=login')} className="btn-f1-secondary block text-center">{t('groups.join.login')}</Link>
            </div>
          </>
        ) : memberGroupId !== null ? (
          <>
            <h1 className="text-2xl font-bold text-center mb-6 text-f1-yellow-500 break-words">
              {t('groups.join.already', { group: preview.name })}
            </h1>
            <Link to={`/leaderboard?poule=${memberGroupId}`} className="btn-f1-primary block text-center">
              {t('groups.viewStandings')}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-center mb-6 text-f1-yellow-500 break-words">
              {t('groups.join.title', { group: preview.name })}
            </h1>
            <label htmlFor="join-plays-in-main" className="flex items-start gap-3 text-sm font-semibold cursor-pointer">
              <input
                id="join-plays-in-main"
                type="checkbox"
                checked={alsoMain}
                onChange={(e) => setAlsoMain(e.target.checked)}
                className="mt-1 h-4 w-4 accent-f1-yellow-500 flex-shrink-0"
              />
              <span>{t('groups.join.alsoMain')}</span>
            </label>
            <p className="mt-1 ml-7 mb-6 text-xs text-white/70">{t('groups.join.alsoMainHelp')}</p>
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="btn-f1-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? t('groups.join.joining') : t('groups.join.button')}
            </button>
            {error && (
              <div className="mt-4 p-4 border-2 bg-red-900/30 border-red-500 text-red-400" role="alert">
                <p className="font-semibold">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default JoinGroup;
