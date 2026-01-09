'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import { getPasskeyCredential, isWebAuthnSupported } from '@/lib/webauthn';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      {/* Header */}
      <header className="p-6 px-8">
        <Link href="/" className="text-2xl font-bold text-[#635bff] no-underline">
          zendfi
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-10">
        <div className="bg-white rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.05)] p-12 max-w-[520px] w-full">
          <h1 className="text-2xl font-semibold text-[#30313d] mb-8">
            Sign in to your account
          </h1>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2.5">
                <label htmlFor="email" className="text-sm font-medium text-[#30313d]">
                  Email
                </label>
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full p-3 border border-[#e0e0e0] rounded-md text-[15px] font-sans transition-all bg-white focus:outline-none focus:border-[#635bff] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.12)]"
                placeholder="you@company.com"
              />
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2.5">
                <label htmlFor="password" className="text-sm font-medium text-[#30313d]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openResetModal}
                  className="text-sm text-[#635bff] hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full p-3 border border-[#e0e0e0] rounded-md text-[15px] font-sans transition-all bg-white focus:outline-none focus:border-[#635bff] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.12)]"
              />
            </div>

            <div className="flex items-center gap-2.5 my-7">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-[18px] h-[18px] accent-[#635bff] cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-sm font-normal text-[#30313d] cursor-pointer"
              >
                Remember me on this device
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full p-3 bg-[#635bff] text-white border-none rounded-md text-[15px] font-medium cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-[#5851ea] disabled:bg-[#a5a5a5] disabled:cursor-not-allowed"
            >
              {isLoading ? <span className="spinner" /> : 'Sign in'}
            </button>
          </form>

          <div className="flex items-center my-7 text-[#8898aa] text-xs uppercase tracking-wide">
            <span className="flex-1 h-px bg-[#e0e0e0]" />
            <span className="px-4">or</span>
            <span className="flex-1 h-px bg-[#e0e0e0]" />
          </div>

          <div className="flex flex-col gap-3.5">
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={isPasskeyLoading || !isWebAuthnSupported()}
              className="w-full p-3 bg-white text-[#30313d] border border-[#e0e0e0] rounded-md text-[15px] font-medium cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-[#f6f9fc] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPasskeyLoading ? (
                <>
                  <span className="spinner spinner-dark" /> Authenticating...
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Sign in with passkey
                </>
              )}
            </button>
          </div>

          <div className="text-center mt-8 pt-6 border-t border-[#e0e0e0] text-sm text-[#697386]">
            New to ZendFi?{' '}
            <Link href="/setup" className="text-[#635bff] hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </main>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetModal(false);
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-[400px] w-[90%] shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
            <h2 className="text-base font-semibold mb-2">Reset your credentials</h2>
            <p className="text-sm text-[#697386] mb-4">
              Enter your email and choose what to reset.
            </p>

            <div className="mb-4">
              <label htmlFor="reset-email" className="text-sm font-medium text-[#30313d] mb-2 block">
                Email
              </label>
              <input
                type="email"
                id="reset-email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full p-3 border border-[#e0e0e0] rounded-md text-[15px] font-sans transition-all bg-white focus:outline-none focus:border-[#635bff] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.12)]"
              />
            </div>

            {resetError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4 text-sm">
                {resetSuccess}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => handleResetRequest('password')}
                disabled={isResetting}
                className="flex-1 p-3 bg-white text-[#30313d] border border-[#e0e0e0] rounded-md text-sm font-medium cursor-pointer hover:bg-[#f6f9fc] disabled:opacity-50"
              >
                {isResetting ? 'Sending...' : 'Reset password'}
              </button>
              <button
                type="button"
                onClick={() => handleResetRequest('passkey')}
                disabled={isResetting}
                className="flex-1 p-3 bg-white text-[#30313d] border border-[#e0e0e0] rounded-md text-sm font-medium cursor-pointer hover:bg-[#f6f9fc] disabled:opacity-50"
              >
                {isResetting ? 'Sending...' : 'Reset passkey'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="w-full mt-3 p-3 bg-white text-[#30313d] border border-[#e0e0e0] rounded-md text-sm font-medium cursor-pointer hover:bg-[#f6f9fc]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
