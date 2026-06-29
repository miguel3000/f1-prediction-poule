import { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!user || !token) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-3xl font-bold mb-4 text-gradient-red">Profile</h1>
        <p className="text-f1-gray mb-6">You need to be logged in to view your profile.</p>
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl md:text-display-xl font-bold mb-8 text-center text-gradient-red">
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
                className="w-32 h-32 rounded-full border-4 border-f1-pink-500 shadow-f1-glow mx-auto object-cover"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-f1-neutral-700 bg-f1-neutral-800 mx-auto flex items-center justify-center text-4xl font-bold text-f1-gray">
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
                className="bg-f1-neutral-800 hover:bg-f1-pink-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-300"
              >
                Remove
              </button>
            )}
          </div>

          <p className="text-xs text-f1-gray mt-2">
            Max 5MB. Allowed: JPEG, PNG, GIF, WebP
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* User Information */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-f1-pink-500">Account Information</h2>

          <div className="grid gap-4">
            <div className="bg-f1-neutral-800 p-4 rounded-lg">
              <p className="text-sm text-f1-gray mb-1">Nickname</p>
              <p className="text-lg font-bold">{user.nickname}</p>
            </div>

            <div className="bg-f1-neutral-800 p-4 rounded-lg">
              <p className="text-sm text-f1-gray mb-1">Email</p>
              <p className="text-lg">{user.email}</p>
            </div>

            <div className="bg-f1-neutral-800 p-4 rounded-lg">
              <p className="text-sm text-f1-gray mb-1">Total Points</p>
              <p className="text-2xl font-bold text-f1-pink-500">{user.total_points}</p>
            </div>

            {user.created_at && (
              <div className="bg-f1-neutral-800 p-4 rounded-lg">
                <p className="text-sm text-f1-gray mb-1">Member Since</p>
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
            className="bg-red-600 hover:bg-f1-pink-600 text-white px-6 py-3 rounded-lg font-bold transition-all duration-300"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
