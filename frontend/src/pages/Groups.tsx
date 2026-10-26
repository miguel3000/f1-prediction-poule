import { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { shareLink } from '../utils/share';
import {
  MyGroup, GroupMember,
  getMyGroups, createGroup, renameGroup, newGroupLink, deleteGroup,
  getGroupMembers, removeGroupMember, leaveGroup,
} from '../services/api';

const inviteUrl = (code: string) => `${window.location.origin}/join/${code}`;

interface GroupCardProps {
  group: MyGroup;
  onChanged: () => void;
}

const GroupCard = ({ group, onChanged }: GroupCardProps) => {
  const { t, tError } = useLang();
  const { user } = useContext(AuthContext);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fail = (err: any) => {
    setNotice('');
    setError(tError(err?.response?.data?.error, 'groups.actionFailed'));
  };

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      after?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const loadMembers = async () => {
    try {
      const res = await getGroupMembers(group.id);
      setMembers(res.data);
    } catch (err) {
      fail(err);
    }
  };

  const toggleMembers = async () => {
    const next = !showMembers;
    setShowMembers(next);
    if (next && members === null) await loadMembers();
  };

  const handleShare = async () => {
    if (!group.inviteCode) return;
    const result = await shareLink({
      title: t('groups.shareTitle'),
      text: t('groups.shareText', { group: group.name }),
      url: inviteUrl(group.inviteCode),
    });
    setError('');
    if (result === 'copied') setNotice(t('groups.invite.copied'));
    else if (result === 'failed') setError(t('groups.invite.copyFailed'));
  };

  const handleNewLink = () => {
    if (!window.confirm(t('groups.invite.newLinkConfirm'))) return;
    run(() => newGroupLink(group.id), onChanged);
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => renameGroup(group.id, name), () => {
      setRenaming(false);
      onChanged();
    });
  };

  const handleRemove = (member: GroupMember) => {
    if (!window.confirm(t('groups.removeConfirm', { name: member.nickname }))) return;
    run(() => removeGroupMember(group.id, member.id), async () => {
      await loadMembers();
      onChanged();
    });
  };

  const handleDelete = () => {
    if (!window.confirm(t('groups.deleteConfirm'))) return;
    run(() => deleteGroup(group.id), onChanged);
  };

  const handleLeave = () => {
    if (!window.confirm(t('groups.leaveConfirm'))) return;
    run(() => leaveGroup(group.id), onChanged);
  };

  return (
    <div className="card-f1 p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {renaming ? (
            <form onSubmit={handleRename} className="flex gap-2 flex-wrap items-center">
              <label htmlFor={`group-name-${group.id}`} className="sr-only">{t('groups.start.name')}</label>
              <input
                id={`group-name-${group.id}`}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                className="input-f1"
              />
              <button type="submit" disabled={busy} className="btn-f1-primary disabled:opacity-50">{t('groups.save')}</button>
              <button
                type="button"
                onClick={() => { setRenaming(false); setName(group.name); setError(''); }}
                className="btn-f1-secondary"
              >
                {t('groups.cancel')}
              </button>
            </form>
          ) : (
            <h2 className="font-f1 font-bold uppercase tracking-wide text-2xl text-f1-yellow-500 break-words">{group.name}</h2>
          )}
          <p className="text-xs text-white/70 uppercase tracking-wide mt-1">
            {group.memberCount === 1 ? t('groups.member1') : t('groups.members', { count: group.memberCount })}
          </p>
        </div>
        {group.isOwner && (
          <span className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider bg-f1-yellow-500 text-black flex-shrink-0">
            {t('groups.owner')}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/leaderboard?poule=${group.id}`} className="btn-f1-primary">{t('groups.viewStandings')}</Link>
        <button type="button" onClick={toggleMembers} className="btn-f1-secondary">
          {showMembers ? t('groups.hideMembers') : t('groups.showMembers')}
        </button>
      </div>

      {group.isOwner && group.inviteCode && (
        <div className="mt-5 bg-f1-blue-dark p-4">
          <h3 className="font-f1 font-bold uppercase tracking-wide text-white mb-1">{t('groups.invite.title')}</h3>
          <p className="text-xs text-white/80 mb-3">{t('groups.invite.help')}</p>
          <label htmlFor={`group-link-${group.id}`} className="sr-only">{t('groups.invite.title')}</label>
          <input
            id={`group-link-${group.id}`}
            type="text"
            readOnly
            value={inviteUrl(group.inviteCode)}
            onFocus={(e) => e.currentTarget.select()}
            className="input-f1 w-full text-xs mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleShare} className="btn-f1-primary">{t('groups.invite.share')}</button>
            <button type="button" onClick={handleNewLink} disabled={busy} className="btn-f1-secondary disabled:opacity-50">
              {t('groups.invite.newLink')}
            </button>
          </div>
        </div>
      )}

      {showMembers && (
        <div className="mt-5">
          <h3 className="font-f1 font-bold uppercase tracking-wide text-white mb-2">{t('groups.membersTitle')}</h3>
          {members === null ? (
            <p className="text-white text-sm">{t('groups.loading')}</p>
          ) : (
            <ul>
              {members.map((m, i) => (
                <li
                  key={m.id}
                  className={`flex items-center justify-between gap-3 px-4 py-2 text-white ${i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}`}
                >
                  <span className="font-f1 font-bold uppercase tracking-wide min-w-0 break-words">{m.nickname}</span>
                  {group.isOwner && m.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m)}
                      disabled={busy}
                      className="text-xs text-white/80 hover:text-f1-yellow-400 underline flex-shrink-0 disabled:opacity-50"
                    >
                      {t('groups.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-4 text-xs">
        {group.isOwner ? (
          <>
            {!renaming && (
              <button type="button" onClick={() => setRenaming(true)} className="text-white/80 hover:text-f1-yellow-400 underline">
                {t('groups.rename')}
              </button>
            )}
            <button type="button" onClick={handleDelete} disabled={busy} className="text-white/80 hover:text-f1-yellow-400 underline disabled:opacity-50">
              {t('groups.delete')}
            </button>
          </>
        ) : (
          <button type="button" onClick={handleLeave} disabled={busy} className="text-white/80 hover:text-f1-yellow-400 underline disabled:opacity-50">
            {t('groups.leave')}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 border-2 bg-red-900/30 border-red-500 text-red-400" role="alert">
          <p className="font-semibold">{error}</p>
        </div>
      )}
      {notice && (
        <div className="mt-4 p-4 border-2 bg-green-900/30 border-green-500 text-green-400" role="status">
          <p className="font-semibold">{notice}</p>
        </div>
      )}
    </div>
  );
};

const Groups = () => {
  const { t, tError } = useLang();
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getMyGroups();
      setGroups(res.data.groups);
      setLoadError('');
    } catch (err: any) {
      setLoadError(tError(err?.response?.data?.error, 'groups.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createGroup(newName);
      setNewName('');
      await load();
    } catch (err: any) {
      setCreateError(tError(err?.response?.data?.error, 'groups.actionFailed'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-f1-yellow-500 mx-auto" />
        <p className="mt-4 text-white">{t('groups.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-2 text-center text-f1-yellow-500">{t('groups.title')}</h1>
      <p className="text-center text-white text-xs mb-8">{t('groups.intro')}</p>

      {loadError && (
        <div className="mb-6 p-4 border-2 bg-red-900/30 border-red-500 text-red-400" role="alert">
          <p className="font-semibold">{loadError}</p>
        </div>
      )}

      {user?.can_start_groups && (
        <form onSubmit={handleCreate} className="card-f1 p-6 mb-8 space-y-4">
          <h2 className="text-xl font-bold text-f1-yellow-500">{t('groups.start.title')}</h2>
          <div>
            <label htmlFor="new-group-name" className="block text-sm font-semibold mb-2">{t('groups.start.name')}</label>
            <input
              id="new-group-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              minLength={3}
              maxLength={40}
              className="input-f1 w-full"
            />
            <p className="text-xs text-white/70 mt-2">{t('groups.start.hint')}</p>
          </div>
          <button type="submit" disabled={creating} className="btn-f1-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {creating ? t('groups.start.creating') : t('groups.start.button')}
          </button>
          {createError && (
            <div className="p-4 border-2 bg-red-900/30 border-red-500 text-red-400" role="alert">
              <p className="font-semibold">{createError}</p>
            </div>
          )}
        </form>
      )}

      {groups.length === 0 ? (
        <div className="card-f1 p-8 text-center text-white">{t('groups.none')}</div>
      ) : (
        groups.map((g) => <GroupCard key={`${g.id}-${g.inviteCode ?? ''}`} group={g} onChanged={load} />)
      )}
    </div>
  );
};

export default Groups;
