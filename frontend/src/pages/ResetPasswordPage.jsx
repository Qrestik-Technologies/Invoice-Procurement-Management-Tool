import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/FormFields';
import AuthShell, { OtpInput } from '../components/auth/AuthShell';
import { resetPassword } from '../api/auth';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilled = location.state?.email || '';
  const [email, setEmail] = useState(prefilled);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      toast.success('Password updated \u2014 please sign in');
      navigate('/login', { state: { email } });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle={email ? `Enter the code sent to ${email}` : 'Enter your reset code and a new password'}
      footer={
        <Link to="/login" className="font-medium text-primary">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {!prefilled && (
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@qrestik.com"
          />
        )}
        <div>
          <label className="mb-2 block text-sm font-medium text-[#374151]">Reset code</label>
          <OtpInput value={code} onChange={setCode} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#374151]">New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border py-2 pl-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Updating\u2026' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}
