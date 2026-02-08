'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/lib/api';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const data = await auth.verifyResetToken(token);
        if (data.valid) {
          setIsValid(true);
          setEmail(data.email || '');
        }
      } catch {
        // Token invalid
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(
        'Password must be at least 8 characters with uppercase, lowercase, and a number'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await auth.resetPassword(token!, password, confirmPassword);
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background-light dark:bg-background-dark">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-gradient-to-br from-primary via-purple-500 to-indigo-600 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/">
            <Image src="/logo.png" alt="ZendFi" width={140} height={36} className="h-9 w-auto brightness-0 invert" priority />
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight">
            Secure your<br />account
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Choose a strong password to keep your merchant account protected.
          </p>
          <div className="flex flex-col gap-4 pt-4">
            {[
              { icon: 'lock', text: 'Strong password requirements' },
              { icon: 'verified_user', text: 'Encrypted at rest' },
              { icon: 'sync_lock', text: 'Can be changed anytime' },
            ].map((item) => (
              <div key={item.icon} className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg">{item.icon}</span>
                </div>
                <span className="text-white/90 text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/40 text-xs">
          &copy; {new Date().getFullYear()} ZendFi. All rights reserved.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col">
        <header className="lg:hidden p-6">
          <Link href="/">
            <Image src="/logo.png" alt="ZendFi" width={120} height={32} className="h-8 w-auto" priority />
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Reset your password</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enter a new password for your account</p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-rose-500 text-lg shrink-0 mt-0.5">error</span>
                <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-500 text-lg shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <span className="spinner spinner-dark" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Verifying your reset link...</p>
              </div>
            )}

            {!isLoading && (!token || (token && !isValid)) && (
              <div className="text-center space-y-5">
                <div className="size-16 mx-auto bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-rose-500 text-3xl">link_off</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This reset link is invalid or has expired.
                </p>
                <Link
                  href="/login"
                  className="block w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold text-center transition-all hover:bg-primary/90 no-underline"
                >
                  Back to Login
                </Link>
              </div>
            )}

            {!isLoading && isValid && !success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {email && (
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">mail</span>
                      {email}
                    </span>
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your new password"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                  {/* Strength indicators */}
                  <div className="flex gap-1.5 mt-2">
                    {[
                      password.length >= 8,
                      /[A-Z]/.test(password),
                      /[a-z]/.test(password),
                      /[0-9]/.test(password),
                    ].map((met, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${met ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {[
                      { label: '8+ chars', met: password.length >= 8 },
                      { label: 'Uppercase', met: /[A-Z]/.test(password) },
                      { label: 'Lowercase', met: /[a-z]/.test(password) },
                      { label: 'Number', met: /[0-9]/.test(password) },
                    ].map((req) => (
                      <span key={req.label} className={`text-xs flex items-center gap-1 ${req.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        <span className="material-symbols-outlined text-xs" style={req.met ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                          {req.met ? 'check_circle' : 'circle'}
                        </span>
                        {req.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      id="confirm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <span className="material-symbols-outlined text-lg">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <span className="spinner" /> : 'Reset password'}
                </button>
              </form>
            )}

            <p className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
              <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <span className="spinner spinner-dark" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
