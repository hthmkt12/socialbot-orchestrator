import { useState } from 'react';
import { Workflow, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import Spinner from '../components/ui/Spinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const addToast = useUIStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    setLoading(false);

    if (result.error) {
      addToast(result.error, 'error');
    } else if (isSignUp) {
      addToast('Account created. You can now sign in.', 'success');
      setIsSignUp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/25">
            <Workflow className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">SocialBot Orchestrator</h1>
          <p className="text-sm text-gray-400">Social Media Automation Platform</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all pr-10"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-gray-400 hover:text-sky-400 transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
