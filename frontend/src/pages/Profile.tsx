import { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { changeEmail as changeEmailRequest, deleteAccount as deleteAccountRequest } from '../services/api';

const Profile = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        <h1 className="text-3xl font-bold mb-4 text-f1-yellow-500">Profile</h1>
        <p className="text-white mb-6">You need to be logged in to view your profile.</p>
        <a href="/auth" className="btn-f1-primary">
          Login
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
      setError('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
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

      setSuccess('Avatar uploaded successfully! Refreshing...');

      // Reload the page to show new avatar
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('Are you sure you want to remove your avatar?')) {
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

      setSuccess('Avatar removed successfully! Refreshing...');

      // Reload the page
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove avatar');
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setEmailSaving(true);

    try {
      await changeEmailRequest(newEmail, emailPassword);
      setSuccess('Email updated successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change email');
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
      setError(err.response?.data?.error || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-f1-yellow-500">
        Profile
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
              {uploading ? 'Uploading...' : user.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
            </button>

            {user.avatar_url && (
              <button
                onClick={handleDeleteAvatar}
                className="bg-f1-neutral-800 hover:bg-f1-yellow-600 hover:text-black text-white px-6 py-3 font-bold transition-all duration-300"
              >
                Remove
              </button>
            )}
          </div>

          <p className="text-xs text-white mt-2">
            Max 5MB. Allowed: JPEG, PNG, GIF, WebP
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
          <h2 className="text-2xl font-bold text-f1-yellow-500">Account Information</h2>

          <div className="grid gap-4">
            <div className="bg-f1-neutral-800 p-4">
              <p className="text-sm text-white mb-1">Nickname</p>
              <p className="text-lg font-bold">{user.nickname}</p>
            </div>

            <div className="bg-f1-neutral-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white mb-1">Email</p>
                  <p className="text-lg">{user.email}</p>
                </div>
                {!showEmailForm && (
                  <button
                    onClick={() => { setShowEmailForm(true); setNewEmail(user.email); setError(''); setSuccess(''); }}
                    className="text-sm text-f1-yellow-500 hover:underline flex-shrink-0"
                  >
                    Change
                  </button>
                )}
              </div>

              {showEmailForm && (
                <form onSubmit={handleChangeEmail} className="mt-4 space-y-3 pt-4 border-t border-f1-neutral-700">
                  <div>
                    <label className="block text-sm text-white mb-1">New email</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-f1-neutral-900 border border-f1-neutral-700 px-3 py-2 text-white focus:outline-none focus:border-f1-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white mb-1">Current password</label>
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
                      {emailSaving ? 'Saving...' : 'Save Email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowEmailForm(false); setEmailPassword(''); setError(''); }}
                      className="text-sm text-white hover:underline px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-f1-neutral-800 p-4">
              <p className="text-sm text-white mb-1">Total Points</p>
              <p className="text-2xl font-bold text-f1-yellow-500">{user.total_points}</p>
            </div>

            {user.created_at && (
              <div className="bg-f1-neutral-800 p-4">
                <p className="text-sm text-white mb-1">Member Since</p>
                <p className="text-lg">{new Date(user.created_at).toLocaleDateString()}</p>
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
            Back to Homepage
          </button>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-f1-yellow-600 hover:text-black text-white px-6 py-3 font-bold transition-all duration-300"
          >
            Logout
          </button>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t border-f1-neutral-700">
          <h2 className="text-lg font-bold text-red-400 mb-3">Danger Zone</h2>

          {user.is_admin ? (
            <p className="text-sm text-white">
              Admin accounts can't be deleted from here. Ask another admin to remove it from the Pitlane.
            </p>
          ) : !showDeleteForm ? (
            <button
              onClick={() => { setShowDeleteForm(true); setError(''); setSuccess(''); }}
              className="text-sm text-red-400 hover:underline"
            >
              Delete my account
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <p className="text-sm text-white">
                This permanently deletes your account and all of your predictions. This can't be undone.
              </p>
              <div>
                <label className="block text-sm text-white mb-1">Confirm your password</label>
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
                  {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteForm(false); setDeletePassword(''); setError(''); }}
                  className="text-sm text-white hover:underline px-2"
                >
                  Cancel
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
