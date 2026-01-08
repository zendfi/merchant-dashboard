'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
          <h1 className="text-2xl font-semibold text-[#30313d] mb-2">
            Reset your password
          </h1>
          <p className="text-[#697386] mb-8 text-sm">
            Enter a new password for your account
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4 text-sm">
              {success}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-5 text-[#697386]">
              <p>Verifying your reset link...</p>
            </div>
          )}

          {!isLoading && !token && (
            <div className="text-center">
              <p className="text-red-600 mb-5">
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/login"
                className="inline-block w-full p-3 bg-[#635bff] text-white rounded-md text-[15px] font-medium text-center hover:bg-[#5851ea]"
              >
                Back to Login
              </Link>
            </div>
          )}

          {!isLoading && token && !isValid && (
            <div className="text-center">
              <p className="text-red-600 mb-5">
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/login"
                className="inline-block w-full p-3 bg-[#635bff] text-white rounded-md text-[15px] font-medium text-center hover:bg-[#5851ea]"
              >
                Back to Login
              </Link>
            </div>
          )}

          {!isLoading && isValid && !success && (
            <form onSubmit={handleSubmit}>
              {email && (
                <div className="text-center mb-6 p-3 bg-[#f6f9fc] rounded-md text-[#30313d] text-sm">
                  {email}
                </div>
              )}

              <div className="mb-6">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2.5 text-[#30313d]"
                >
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                  autoComplete="new-password"
                  className="w-full p-3 border border-[#e0e0e0] rounded-md text-[15px] font-sans transition-all focus:outline-none focus:border-[#635bff] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.12)]"
                />
                <p className="text-[#697386] text-xs mt-2">
                  Must be at least 8 characters with uppercase, lowercase, and a number
                </p>
              </div>

              <div className="mb-6">
                <label
                  htmlFor="confirm"
                  className="block text-sm font-medium mb-2.5 text-[#30313d]"
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  autoComplete="new-password"
                  className="w-full p-3 border border-[#e0e0e0] rounded-md text-[15px] font-sans transition-all focus:outline-none focus:border-[#635bff] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.12)]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full p-3 bg-[#635bff] text-white border-none rounded-md text-[15px] font-medium cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-[#5851ea] disabled:bg-[#a5a5a5] disabled:cursor-not-allowed"
              >
                {isSubmitting ? <span className="spinner" /> : 'Reset password'}
              </button>
            </form>
          )}

          <div className="text-center mt-8 pt-6 border-t border-[#e0e0e0] text-sm text-[#697386]">
            <Link href="/login" className="text-[#635bff] hover:underline">
              ← Back to Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f9fc]">
        <div className="spinner spinner-dark" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
