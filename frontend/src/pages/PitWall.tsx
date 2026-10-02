import { useState, useEffect } from 'react';
import { getMyPitwallIdeas, createPitwallIdea, deleteMyPitwallIdea } from '../services/api';
import InfoBannerRows, { InfoBannerRow } from '../components/InfoBannerRows';

interface Idea {
  id: number;
  kind: 'idea' | 'implementation';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'declined';
  admin_note: string | null;
  created_at: string;
}

const KIND_LABEL: Record<Idea['kind'], string> = {
  idea: 'Idea',
  implementation: 'Implementation',
};

const STATUS_LABEL: Record<Idea['status'], string> = {
  pending: 'Waiting',
  approved: 'Approved',
  declined: 'Declined',
};

// Status chips stay inside the brand palette: yellow = waiting for review,
// white on navy = approved, dimmed = declined.
const STATUS_CLASS: Record<Idea['status'], string> = {
  pending: 'bg-f1-yellow-500 text-black',
  approved: 'bg-white text-f1-blue-dark',
  declined: 'bg-black/30 text-white/70',
};

const PitWall = () => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Idea['kind']>('idea');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadIdeas = async () => {
    try {
      const res = await getMyPitwallIdeas();
      setIdeas(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load your ideas');
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
      await createPitwallIdea(kind, title, description);
      setTitle('');
      setDescription('');
      setSuccess('Thanks! Your suggestion is waiting for review.');
      await loadIdeas();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save your idea');
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
      setError(err.response?.data?.error || 'Failed to remove the idea');
      loadIdeas();
    }
  };

  const count = (status: Idea['status']) => ideas.filter((i) => i.status === status).length;
  const bannerRows: InfoBannerRow[] = [
    { label: 'Pit Wall', value: 'Your ideas' },
    { label: 'Waiting', value: String(count('pending')) },
    { label: 'Approved', value: String(count('approved')) },
    { label: 'Declined', value: String(count('declined')) },
  ];

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">Loading the Pit Wall...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">Pit Wall</h1>
      <p className="text-center text-white text-xs mb-8">
        Got an idea for Poule Position, or a way to build one? Add it here. Only you can see your own list.
      </p>

      <div className="mb-8">
        <InfoBannerRows rows={bannerRows} />
      </div>

      <form onSubmit={handleSubmit} className="card-f1 p-6 mb-8 space-y-5">
        <h2 className="text-xl font-bold text-f1-yellow-500">Add to the Pit Wall</h2>

        <div className="grid grid-cols-2">
          {(Object.keys(KIND_LABEL) as Idea['kind'][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                kind === k ? 'bg-f1-yellow-500 text-black' : 'bg-f1-blue-dark text-white hover:brightness-125'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="pitwall-title" className="block text-sm font-semibold mb-2">Title</label>
          <input
            id="pitwall-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            className="input-f1 w-full"
            placeholder={kind === 'idea' ? 'What should we add?' : 'What would you build?'}
          />
        </div>

        <div>
          <label htmlFor="pitwall-description" className="block text-sm font-semibold mb-2">Details (optional)</label>
          <textarea
            id="pitwall-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            className="input-f1 w-full"
            placeholder="Explain it in a few lines"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-f1-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : 'Submit'}
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

      <h2 className="text-xl font-bold text-f1-yellow-500 mb-3">Your list</h2>
      {ideas.length === 0 ? (
        <div className="card-f1 p-8 text-center text-white">Nothing here yet. Add your first idea above.</div>
      ) : (
        <div>
          {ideas.map((idea, i) => (
            <div key={idea.id} className="flex items-stretch">
              <span className="w-12 shrink-0 flex items-center justify-center bg-f1-yellow-500 text-black font-f1-badge font-bold text-lg">
                {idea.status === 'approved' ? '✓' : idea.status === 'declined' ? '✕' : ideas.length - i}
              </span>
              <div className={`flex-1 min-w-0 px-4 py-3 text-white ${i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-f1 font-bold uppercase tracking-wide text-lg leading-tight break-words">{idea.title}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {KIND_LABEL[idea.kind]} &middot; {new Date(idea.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider flex-shrink-0 ${STATUS_CLASS[idea.status]}`}>
                    {STATUS_LABEL[idea.status]}
                  </span>
                </div>
                {idea.description && (
                  <p className="text-sm text-white/90 mt-2 whitespace-pre-wrap break-words">{idea.description}</p>
                )}
                {idea.admin_note && (
                  <p className="text-xs text-white/70 mt-2 italic">Note from the admin: {idea.admin_note}</p>
                )}
                {idea.status === 'pending' && (
                  <button
                    onClick={() => handleRemove(idea.id)}
                    className="mt-2 text-xs text-white/70 hover:text-f1-yellow-400 underline"
                  >
                    Remove
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
