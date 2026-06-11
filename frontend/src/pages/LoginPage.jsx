import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/FormFields';
import AuthShell from '../components/auth/AuthShell';
import { login, fetchMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      const user = await fetchMe();
      setUser(user);
      toast.dismiss();
      toast.success('Signed in successfully');
      navigate('/');
    } catch (err) {
      if (err.response?.status === 403) {
        toast('Please verify your email to continue', { icon: '✉️' });
        navigate('/verify-email', { state: { email } });
      } else {
        setError(err.response?.data?.detail || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage invoices, milestones, and payments"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          required
          autoComplete="email"
          placeholder="you@qrestik.com"
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-[#374151]">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              required
              autoComplete="current-password"
              className={`w-full rounded-lg border py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                error ? 'border-red-400 focus:border-red-400' : 'border-border focus:border-primary'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </AuthShell>
  );
}
