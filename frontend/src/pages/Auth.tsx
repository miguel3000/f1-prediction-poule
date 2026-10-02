import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerWithPassword, loginWithPassword, forgotPassword } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import LogoMark from '../components/LogoMark';

const Auth = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isForgot) {
        await forgotPassword(email);
        setMessage('If that email belongs to an account, a reset link is on its way. It is valid for 1 hour.');
        setLoading(false);
        return;
      }
      if (isRegister) {
        if (password !== confirmPassword) {
          setMessage('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setMessage('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const response = await registerWithPassword(nickname, email, password);
        // Auto-login after registration
        login(response.data.token);
        navigate('/');
      } else {
        const response = await loginWithPassword(email, password);
        login(response.data.token);
        navigate('/');
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <LogoMark className="h-12 w-auto mx-auto mb-8" />
      <div className="card-f1 p-8 shadow-card-hover">
        <h2 className="text-3xl font-bold text-center mb-8 text-f1-yellow-500">
          {isForgot ? 'Reset Password' : isRegister ? 'Register' : 'Login'}
        </h2>
        {isForgot && (
          <p className="text-white text-center -mt-4 mb-8 text-sm">
            Enter your email and we'll send you a link to choose a new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <div>
              <label className="block text-sm font-semibold mb-2">Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="input-f1 w-full"
                placeholder="Your racing nickname"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-f1 w-full"
              placeholder="your.email@example.com"
            />
          </div>

          {!isForgot && (
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-f1 w-full"
                placeholder="Enter your password"
                minLength={6}
              />
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => { setIsForgot(true); setMessage(''); }}
                  className="mt-2 text-sm text-white/70 hover:text-f1-yellow-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {isRegister && !isForgot && (
            <div>
              <label className="block text-sm font-semibold mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-f1 w-full"
                placeholder="Confirm your password"
                minLength={6}
              />
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
                Processing...
              </span>
            ) : isForgot ? (
              'Send reset link'
            ) : isRegister ? (
              'Register'
            ) : (
              'Login'
            )}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 border-2 ${
            message.includes('created') || message.includes('successful') || message.includes('on its way')
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
              Back to login
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
            {isRegister
              ? 'Already have an account? Login'
              : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
