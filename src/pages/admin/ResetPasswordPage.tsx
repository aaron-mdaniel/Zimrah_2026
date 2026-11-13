import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

export const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await updatePassword(newPassword);
      if (!res.success) {
        setError(res.error || 'Failed to update password.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/portal/login', { replace: true });
        }, 2500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while updating your password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#064e3b_0%,_transparent_60%)] opacity-40 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <img
            src="/logos/zimrah_logo.png"
            alt="ZIMRAH 2026"
            className="h-14 w-auto mx-auto object-contain bg-white/10 rounded-xl p-2 mb-3 shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/zimrah_logo.png';
            }}
          />
          <h1 className="text-2xl font-black text-white tracking-tight">
            ZIMRAH <span className="text-zim-gold">2026</span>
          </h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
            Secure Account Recovery
          </p>
        </div>

        <Card className="border-slate-800 bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-slate-900 flex items-center justify-center gap-2">
              <KeyRound className="h-5 w-5 text-zim-primary" />
              Set New Password
            </CardTitle>
            <CardDescription className="text-center text-xs">
              Enter your new administrative password below to update your security credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {success ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">Password Updated Successfully</h3>
                <p className="text-xs text-slate-600">
                  Your credentials have been securely updated. Redirecting to the login screen...
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/portal/login')}
                  className="mt-2 text-xs"
                >
                  Go to Login Now
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="New Password" required helpText="Minimum 8 characters">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                  />
                </FormField>

                <FormField label="Confirm Password" required>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                  />
                </FormField>

                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full gap-2 mt-2 font-bold"
                  disabled={loading}
                >
                  <KeyRound className="h-4 w-4" />
                  {loading ? 'Updating Password...' : 'Save New Password'}
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/portal/login')}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
