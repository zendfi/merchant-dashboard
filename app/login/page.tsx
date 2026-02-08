'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/lib/api';
import { getPasskeyCredential, isWebAuthnSupported } from '@/lib/webauthn';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const hideMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    hideMessages();

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const data = await auth.loginPassword(email, password);

      if (data.success) {
        setSuccess(`Welcome back, ${data.name}!`);
        setTimeout(() => {
          router.push('/');
        }, 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.includes('needs_password_setup')) {
        setError('No password set. Please use passkey login or reset your password.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    hideMessages();

    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setIsPasskeyLoading(true);

    try {
      const { session_id, webauthn_options } = await auth.loginStart(email);
      const publicKey = webauthn_options.publicKey || webauthn_options;

      const credential = await getPasskeyCredential({
        challenge: (publicKey as { challenge: string }).challenge,
        allowCredentials: (publicKey as { allowCredentials: Array<{ id: string; type: string }> }).allowCredentials,
        timeout: (publicKey as { timeout?: number }).timeout,
        rpId: (publicKey as { rpId?: string }).rpId,
        userVerification: (publicKey as { userVerification?: string }).userVerification,
      });

      if (!credential) {
        throw new Error('Authentication cancelled');
      }

      const data = await auth.loginVerify(session_id, credential);

      if (data.success) {
        setSuccess(`Welcome back, ${data.merchant.name}!`);
        setTimeout(() => {
          router.push('/');
        }, 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      if (message.includes('no_passkey')) {
        setError('No passkey found for this account.');
      } else {
        setError(message);
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleResetRequest = async (type: 'password' | 'passkey') => {
    setResetError('');
    setResetSuccess('');

    if (!resetEmail) {
      setResetError('Please enter your email address');
      return;
    }

    setIsResetting(true);

    try {
      await auth.requestReset(resetEmail, type);
      setResetSuccess(
        `Check your email! If an account exists, you'll receive a ${type} reset link shortly.`
      );
      setTimeout(() => {
        setShowResetModal(false);
        setSuccess('Reset email sent! Check your inbox.');
      }, 2000);
    } catch {
      setResetError('Failed to send reset email. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const openResetModal = () => {
    setShowResetModal(true);
    setResetEmail(email);
    setResetError('');
    setResetSuccess('');
  };

  return (
    <div className="min-h-screen flex bg-background-light dark:bg-background-dark">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-primary relative overflow-hidden flex-col justify-between p-12">
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
            Accept crypto<br />payments with ease
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            The simplest way for merchants to accept Solana payments. Fast, secure, and built for scale.
          </p>
          <div className="flex flex-col gap-4 pt-4">
            {[
              { icon: 'bolt', text: 'Instant settlement on Solana' },
              { icon: 'shield', text: 'Enterprise-grade security' },
              { icon: 'code', text: 'Simple API integration' },
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

      {/* Right Login Panel */}
      <div className="flex-1 flex flex-col">
        <header className="lg:hidden p-6">
          <Link href="/">
            <Image src="/logo.png" alt="ZendFi" width={120} height={32} className="h-8 w-auto" priority />
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome back</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to your merchant dashboard</p>
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

            {/* Passkey — Primary CTA */}
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={isPasskeyLoading || !isWebAuthnSupported()}
              className="w-full p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2.5 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed mb-5"
            >
              {isPasskeyLoading ? (
                <><span className="spinner" /> Authenticating...</>
              ) : (
                <><span className="material-symbols-outlined text-lg">fingerprint</span> Sign in with Passkey</>
              )}
            </button>

            <div className="flex items-center gap-4 mb-5">
              <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">or continue with email</span>
              <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                  <button type="button" onClick={openResetModal} className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 accent-primary cursor-pointer rounded"
                />
                <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                  Remember me on this device
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <span className="spinner" /> : 'Sign in'}
              </button>
            </form>

            <p className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
              New to ZendFi?{' '}
              <Link href="/setup" className="text-primary hover:text-primary/80 font-semibold transition-colors">Create an account</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Reset Credentials Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetModal(false); }}
        >
          <div className="bg-white dark:bg-[#1f162b] rounded-2xl p-6 max-w-[400px] w-full shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reset credentials</h2>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Enter your email and choose what to reset.</p>

            <div className="mb-4">
              <label htmlFor="reset-email" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Email</label>
              <input
                type="email"
                id="reset-email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
              />
            </div>

            {resetError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                <p className="text-sm text-rose-700 dark:text-rose-300">{resetError}</p>
              </div>
            )}
            {resetSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{resetSuccess}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleResetRequest('password')}
                disabled={isResetting}
                className="flex-1 p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {isResetting ? 'Sending...' : 'Reset password'}
              </button>
              <button
                type="button"
                onClick={() => handleResetRequest('passkey')}
                disabled={isResetting}
                className="flex-1 p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {isResetting ? 'Sending...' : 'Reset passkey'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
