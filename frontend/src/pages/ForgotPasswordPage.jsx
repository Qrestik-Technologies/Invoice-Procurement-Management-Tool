import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/FormFields';
import AuthShell from '../components/auth/AuthShell';
import { forgotPassword } from '../api/auth';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      toast.success('If that account exists, a reset code was sent');
      navigate('/reset-password', { state: { email } });
    } catch {
      toast.error('Something went wrong, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset code"
      footer={
        <Link to="/login" className="font-medium text-primary">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@qrestik.com"
          autoComplete="email"
        />
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Sending\u2026' : 'Send reset code'}
        </Button>
      </form>
    </AuthShell>
  );
}
