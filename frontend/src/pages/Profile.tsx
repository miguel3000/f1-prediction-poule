import { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { changeEmail as changeEmailRequest, changeNickname as changeNicknameRequest, deleteAccount as deleteAccountRequest } from '../services/api';

const Profile = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, tError, locale } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showNicknameForm, setShowNicknameForm] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user || !token) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold mb-4 text-f1-yellow-500">{t('profile.title')}</h1>
        <p className="text-white mb-6">{t('profile.needLogin')}</p>
        <a href="/auth" className="btn-f1-primary">
          {t('auth.login')}
        </a>
      </div>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('profile.invalidFile'));
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile.fileTooBig'));
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      await axios.post('/api/upload/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      setSuccess(t('profile.avatarUploaded'));

      // Reload the page to show new avatar
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to upload avatar'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm(t('profile.confirmRemoveAvatar'))) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await axios.delete('/api/upload/avatar', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setSuccess(t('profile.avatarRemoved'));

      // Reload the page
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to delete avatar'));
    }
  };

  const handleChangeNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setNicknameSaving(true);

    try {
      await changeNicknameRequest(newNickname);
      setSuccess(t('profile.usernameUpdated'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to change username'));
      setNicknameSaving(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setEmailSaving(true);

    try {
      await changeEmailRequest(newEmail, emailPassword);
      setSuccess(t('profile.emailUpdated'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to change email'));
      setEmailSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDeleting(true);

    try {
      await deleteAccountRequest(deletePassword);
      logout();
      navigate('/');
    } catch (err: any) {
      setError(tError(err.response?.data?.error || 'Failed to delete account'));
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-f1-yellow-500">
        {t('profile.title')}
      </h1>

      <div className="card-f1 space-y-6">
        {/* Avatar Section */}
        <div className="text-center pb-6 border-b border-f1-neutral-700">
          <div className="mb-4">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.nickname}
                className="w-32 h-32 border-4 border-f1-yellow-500 mx-auto object-cover"
              />
            ) : (
              <div className="w-32 h-32 border-4 border-f1-neutral-700 bg-f1-neutral-800 mx-auto flex items-center justify-center text-4xl font-bold text-white">
                {user.nickname.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
          />

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-f1-primary"
            >
              {uploading ? t('profile.uploading') : user.avatar_url ? t('profile.changeAvatar') : t('profile.uploadAvatar')}
            </button>

            {user.avatar_url && (
              <button
                onClick={handleDeleteAvatar}
                className="bg-f1-neutral-800 hover:bg-f1-yellow-600 hover:text-black text-white px-6 py-3 font-bold transition-all duration-300"
              >
                {t('common.remove')}
              </button>
            )}
          </div>

          <p className="text-xs text-white mt-2">
            {t('profile.avatarHint')}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3">
            {success}
          </div>
        )}

        {/* User Information */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-f1-yellow-500">{t('profile.accountInfo')}</h2>

          <div className="grid gap-4">
            <div className="bg-f1-neutral-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white mb-1">{t('profile.username')}</p>
                  <p className="text-lg font-bold">{user.nickname}</p>
                </div>
                {!showNicknameForm && (
                  <button
                    onClick={() => { setShowNicknameForm(true); setNewNickname(user.nickname); setError(''); setSuccess(''); }}
                    className="text-sm text-f1-yellow-500 hover:underline flex-shrink-0"
                  >
                    {t('profile.change')}
                  </button>
                )}
              </div>

              {showNicknameForm && (
                <form onSubmit={handleChangeNickname} className="mt-4 space-y-3 pt-4 border-t border-f1-neutral-700">
                  <div>
                    <label className="block text-sm text-white mb-1">{t('profile.newUsername')}</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={30}
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      className="w-full bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-white focus:outline-none focus:border-f1-yellow-500"
                    />
                    <p className="text-xs text-white/60 mt-1">{t('profile.usernameHint')}</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={nicknameSaving} className="btn-f1-primary text-sm px-4 py-2">
                      {nicknameSaving ? t('profile.saving') : t('profile.saveUsername')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNicknameForm(false); setError(''); }}
                      className="text-sm text-white hover:underline px-2"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-f1-neutral-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white mb-1">{t('profile.email')}</p>
                  <p className="text-lg">{user.email}</p>
                </div>
                {!showEmailForm && (
                  <button
                    onClick={() => { setShowEmailForm(true); setNewEmail(user.email); setError(''); setSuccess(''); }}
                    className="text-sm text-f1-yellow-500 hover:underline flex-shrink-0"
                  >
                    {t('profile.change')}
                  </button>
                )}
              </div>

              {showEmailForm && (
                <form onSubmit={handleChangeEmail} className="mt-4 space-y-3 pt-4 border-t border-f1-neutral-700">
                  <div>
                    <label className="block text-sm text-white mb-1">{t('profile.newEmail')}</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-white focus:outline-none focus:border-f1-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white mb-1">{t('profile.currentPassword')}</label>
                    <input
                      type="password"
                      required
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      className="w-full bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-white focus:outline-none focus:border-f1-yellow-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={emailSaving} className="btn-f1-primary text-sm px-4 py-2">
                      {emailSaving ? t('profile.saving') : t('profile.saveEmail')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowEmailForm(false); setEmailPassword(''); setError(''); }}
                      className="text-sm text-white hover:underline px-2"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-f1-neutral-800 p-4">
              <p className="text-sm text-white mb-1">{t('profile.totalPoints')}</p>
              <p className="text-2xl font-bold text-f1-yellow-500">{user.total_points}</p>
            </div>

            {user.created_at && (
              <div className="bg-f1-neutral-800 p-4">
                <p className="text-sm text-white mb-1">{t('profile.memberSince')}</p>
                <p className="text-lg">{new Date(user.created_at).toLocaleDateString(locale)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-f1-neutral-700 flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn-f1-secondary flex-1"
          >
            {t('mypred.backHome')}
          </button>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-f1-yellow-600 hover:text-black text-white px-6 py-3 font-bold transition-all duration-300"
          >
            {t('profile.logout')}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t border-f1-neutral-700">
          <h2 className="text-lg font-bold text-red-400 mb-3">{t('profile.dangerZone')}</h2>

          {user.is_admin ? (
            <p className="text-sm text-white">
              {t('profile.adminNoDelete')}
            </p>
          ) : !showDeleteForm ? (
            <button
              onClick={() => { setShowDeleteForm(true); setError(''); setSuccess(''); }}
              className="text-sm text-red-400 hover:underline"
            >
              {t('profile.deleteAccount')}
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <p className="text-sm text-white">
                {t('profile.deleteWarning')}
              </p>
              <div>
                <label className="block text-sm text-white mb-1">{t('profile.confirmPassword')}</label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-bold transition-colors"
                >
                  {deleting ? t('profile.deleting') : t('profile.deleteForever')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteForm(false); setDeletePassword(''); setError(''); }}
                  className="text-sm text-white hover:underline px-2"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
