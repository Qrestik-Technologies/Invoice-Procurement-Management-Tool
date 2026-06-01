import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/FormFields';
import AuthShell, { OtpInput } from '../components/auth/AuthShell';
import { verifyEmail, resendCode } from '../api/auth';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilled = location.state?.email || '';
  const [email, setEmail] = useState(prefilled);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(email, code);
      toast.success('Email verified \u2014 please sign in');
      navigate('/login', { state: { email } });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Enter your email first');
      return;
    }
    try {
      await resendCode(email);
      toast.success('A new code is on its way');
      setCooldown(30);
    } catch {
      toast.error('Could not resend code');
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle={email ? `We sent a 6-digit code to ${email}` : 'Enter the 6-digit code we emailed you'}
      footer={
        <Link to="/login" className="font-medium text-primary">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleVerify} className="space-y-6">
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
          <label className="mb-2 block text-sm font-medium text-[#374151]">Verification code</label>
          <OtpInput value={code} onChange={setCode} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Verifying\u2026' : 'Verify email'}
        </Button>
        <p className="text-center text-sm text-[#6B7280]">
          Didn&apos;t get it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="font-medium text-primary disabled:text-[#9CA3AF]"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
