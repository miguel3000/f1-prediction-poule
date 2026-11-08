import { useState, useEffect } from 'react';
import { getMyPitwallIdeas, createPitwallIdea, deleteMyPitwallIdea } from '../services/api';
import InfoBannerRows, { InfoBannerRow } from '../components/InfoBannerRows';
import { useLang, TranslationKey } from '../i18n/LanguageContext';

interface Idea {
  id: number;
  kind: 'idea' | 'implementation' | 'message';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'declined' | 'handled';
  admin_note: string | null;
  created_at: string;
}

const KIND_KEY: Record<Idea['kind'], TranslationKey> = {
  idea: 'pw.kindIdea',
  implementation: 'pw.kindImplementation',
  message: 'pw.kindMessage',
};

const STATUS_KEY: Record<Idea['status'], TranslationKey> = {
  pending: 'pw.waiting',
  approved: 'pw.approved',
  declined: 'pw.declined',
  handled: 'pw.handled',
};

// A message is not reviewed for approval, so while it waits it is simply "sent".
const statusKey = (idea: Idea): TranslationKey =>
  idea.kind === 'message' && idea.status === 'pending' ? 'pw.sent' : STATUS_KEY[idea.status];

// Status chips stay inside the brand palette: yellow = waiting for review,
// white on navy = approved or handled, dimmed = declined.
const STATUS_CLASS: Record<Idea['status'], string> = {
  pending: 'bg-f1-yellow-500 text-black',
  approved: 'bg-white text-f1-blue-dark',
  declined: 'bg-black/30 text-white/70',
  handled: 'bg-white text-f1-blue-dark',
};

const PitWall = () => {
  const { t, tError, locale } = useLang();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Idea['kind']>('idea');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const isMessage = kind === 'message';
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadIdeas = async () => {
    try {
      const res = await getMyPitwallIdeas();
      setIdeas(res.data);
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to load your ideas'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIdeas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      // A message is one text: it goes in the description and the server makes the title from it.
      await createPitwallIdea(kind, isMessage ? '' : title, description);
      setTitle('');
      setDescription('');
      setSuccess(t(isMessage ? 'pw.thanksMessage' : 'pw.thanks'));
      await loadIdeas();
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to save your idea'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    setError('');
    setSuccess('');
    try {
      await deleteMyPitwallIdea(id);
      await loadIdeas();
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to remove the idea'));
      loadIdeas();
    }
  };

  // The counts in the banner are about ideas; messages are not approved or declined.
  const count = (status: Idea['status']) => ideas.filter((i) => i.kind !== 'message' && i.status === status).length;
  const bannerRows: InfoBannerRow[] = [
    { label: t('pw.bannerLabel'), value: t('pw.bannerValue') },
    { label: t('pw.waiting'), value: String(count('pending')) },
    { label: t('pw.approved'), value: String(count('approved')) },
    { label: t('pw.declined'), value: String(count('declined')) },
  ];

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">{t('pw.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">{t('pw.title')}</h1>
      <p className="text-center text-white text-xs mb-8">
        {t('pw.intro')}
      </p>

      <div className="mb-8">
        <InfoBannerRows rows={bannerRows} />
      </div>

      <form onSubmit={handleSubmit} className="card-f1 p-6 mb-8 space-y-5">
        <h2 className="text-xl font-bold text-f1-yellow-500">{t(isMessage ? 'pw.sendMessage' : 'pw.add')}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3">
          {(Object.keys(KIND_KEY) as Idea['kind'][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                k === 'message' ? 'col-span-2 sm:col-span-1' : ''
              } ${kind === k ? 'bg-f1-yellow-500 text-black' : 'bg-f1-blue-dark text-white hover:brightness-125'}`}
            >
              {t(KIND_KEY[k])}
            </button>
          ))}
        </div>

        {!isMessage && (
          <div>
            <label htmlFor="pitwall-title" className="block text-sm font-semibold mb-2">{t('pw.fieldTitle')}</label>
            <input
              id="pitwall-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
              className="input-f1 w-full"
              placeholder={kind === 'idea' ? t('pw.titleIdea') : t('pw.titleImpl')}
            />
          </div>
        )}

        <div>
          <label htmlFor="pitwall-description" className="block text-sm font-semibold mb-2">
            {t(isMessage ? 'pw.fieldMessage' : 'pw.details')}
          </label>
          <textarea
            id="pitwall-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required={isMessage}
            minLength={isMessage ? 3 : undefined}
            maxLength={2000}
            rows={isMessage ? 6 : 4}
            className="input-f1 w-full"
            placeholder={t(isMessage ? 'pw.messagePlaceholder' : 'pw.detailsPlaceholder')}
          />
        </div>

        <button type="submit" disabled={saving} className="btn-f1-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? t('pw.saving') : t(isMessage ? 'pw.sendButton' : 'pw.submit')}
        </button>

        {error && (
          <div className="p-4 border-2 bg-red-900/30 border-red-500 text-red-400">
            <p className="font-semibold">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 border-2 bg-green-900/30 border-green-500 text-green-400">
            <p className="font-semibold">{success}</p>
          </div>
        )}
      </form>

      <h2 className="text-xl font-bold text-f1-yellow-500 mb-3">{t('pw.yourList')}</h2>
      {ideas.length === 0 ? (
        <div className="card-f1 p-8 text-center text-white">{t('pw.empty')}</div>
      ) : (
        <div>
          {ideas.map((idea, i) => (
            <div key={idea.id} className="flex items-stretch">
              <span className="w-12 shrink-0 flex items-center justify-center bg-f1-yellow-500 text-black font-f1-badge font-bold text-lg">
                {idea.status === 'approved' || idea.status === 'handled' ? '✓' : idea.status === 'declined' ? '✕' : ideas.length - i}
              </span>
              <div className={`flex-1 min-w-0 px-4 py-3 text-white ${i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    {/* A message is just its text: its title is only the first line of it, so it is not repeated here */}
                    {idea.kind !== 'message' && (
                      <p className="font-f1 font-bold uppercase tracking-wide text-lg leading-tight break-words">{idea.title}</p>
                    )}
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {t(KIND_KEY[idea.kind])} &middot; {new Date(idea.created_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider flex-shrink-0 ${STATUS_CLASS[idea.status]}`}>
                    {t(statusKey(idea))}
                  </span>
                </div>
                {(idea.kind === 'message' ? idea.description || idea.title : idea.description) && (
                  <p className="text-sm text-white/90 mt-2 whitespace-pre-wrap break-words">
                    {idea.kind === 'message' ? idea.description || idea.title : idea.description}
                  </p>
                )}
                {idea.admin_note && (
                  <p className="text-xs text-white/70 mt-2 italic">{t('pw.adminNote', { note: idea.admin_note })}</p>
                )}
                {idea.status === 'pending' && (
                  <button
                    onClick={() => handleRemove(idea.id)}
                    className="mt-2 text-xs text-white/70 hover:text-f1-yellow-400 underline"
                  >
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PitWall;
