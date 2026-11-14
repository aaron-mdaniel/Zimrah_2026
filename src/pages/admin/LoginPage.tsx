import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, User, Lock, AlertCircle, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Password reset state
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    '/portal/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!username || !password) {
        throw new Error('Please enter both username and password.');
      }
      const res = await signIn(username, password);
      if (!res.success) {
        setError(res.error || 'Authentication failed. Please verify credentials.');
        return;
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resetEmail) {
      setError('Please enter your administrator email address.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await resetPassword(resetEmail);
      if (!res.success) {
        setError(res.error || 'Failed to send password reset email.');
      } else {
        setResetSuccess(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request password reset.';
      setError(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#064e3b_0%,_transparent_60%)] opacity-40 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Branding Header */}
        <div className="text-center mb-6">
          <img
            src="/logos/zimrah_logo.png"
            alt="ZIMRAH 2026"
            className="h-16 w-auto mx-auto object-contain bg-white/10 rounded-xl p-2 mb-3 shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/zimrah_logo.png';
            }}
          />
          <h1 className="text-2xl font-black text-white tracking-tight">
            ZIMRAH <span className="text-zim-gold">2026</span>
          </h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
            Result Management & Administration Portal
          </p>
        </div>

        <Card className="border-slate-800 bg-white/95 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-slate-900">
              {isResetMode ? 'Password Recovery' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-center text-xs">
              {isResetMode
                ? 'Enter your registered administrator email to receive reset instructions'
                : 'Enter your official administrative credentials to access the portal'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {isResetMode ? (
              resetSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">Recovery Instructions Sent</h3>
                  <p className="text-xs text-slate-600">
                    If an account matches <span className="font-semibold text-slate-800">{resetEmail}</span>,
                    a secure password reset link has been dispatched.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsResetMode(false);
                      setResetSuccess(false);
                      setResetEmail('');
                      setError(null);
                    }}
                    className="mt-2 text-xs"
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <FormField label="Administrator Email" required>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        className="pl-9"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="admin@zimrah2026.org"
                        required
                      />
                    </div>
                  </FormField>

                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="w-full gap-2 mt-2 font-bold"
                    disabled={resetLoading}
                  >
                    <Mail className="h-4 w-4" />
                    {resetLoading ? 'Sending Instructions...' : 'Send Reset Link'}
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(false);
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Return to Sign In
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Username or Email" required>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      className="pl-9"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin or super_admin@zimrah.org"
                      required
                    />
                  </div>
                </FormField>

                <FormField label="Password" required>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="password"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                    />
                  </div>
                </FormField>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Authentication Session</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setError(null);
                    }}
                    className="text-[11px] text-zim-primary font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  className="w-full gap-2 mt-2 font-bold"
                  disabled={loading}
                >
                  <Shield className="h-4 w-4" />
                  {loading ? 'Authenticating...' : 'Enter Admin Portal'}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <a
                href="/"
                className="text-xs font-semibold text-slate-500 hover:text-zim-primary transition-colors"
              >
                &larr; Return to Public Scoreboard
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
