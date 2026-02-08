'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth, webauthn as webauthnApi } from '@/lib/api';
import { createPasskeyCredential, isWebAuthnSupported } from '@/lib/webauthn';

function ResetPasskeyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const data = await auth.verifyResetToken(token);
        if (data.valid && data.token_type === 'passkey') {
          setIsValid(true);
          setEmail(data.email || '');
          setMerchantId(data.merchant_id || '');
        }
      } catch {
        // Token invalid
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleResetPasskey = async () => {
    if (!isWebAuthnSupported()) {
      setError('Passkeys are not supported in this browser');
      return;
    }

    setIsRegistering(true);
    setError('');

    try {
      const startData = await webauthnApi.registerStart({
        merchant_id: merchantId,
        email: `reset-${merchantId}@zendfi.local`,
        display_name: 'ZendFi Merchant',
        is_reset: true,
      });

      const options = startData.options as {
        publicKey: {
          challenge: string;
          rp: { name: string; id: string };
          user: { id: string; name: string; displayName: string };
          pubKeyCredParams: Array<{ type: string; alg: number }>;
          timeout?: number;
          attestation?: string;
          authenticatorSelection?: {
            residentKey?: string;
            userVerification?: string;
          };
        };
      };

      const credential = await createPasskeyCredential({
        challenge: options.publicKey.challenge,
        rp: options.publicKey.rp,
        user: options.publicKey.user,
        pubKeyCredParams: options.publicKey.pubKeyCredParams,
        timeout: options.publicKey.timeout,
        attestation: options.publicKey.attestation,
        authenticatorSelection: options.publicKey.authenticatorSelection,
      });

      if (!credential) {
        throw new Error('Passkey registration cancelled');
      }

      await webauthnApi.registerFinish({
        challenge_id: startData.challenge_id,
        credential: credential,
      });

      await auth.resetPassword(token!, 'passkey_reset', 'passkey_reset');

      setSuccess('Passkey registered successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register passkey');
    } finally {
      setIsRegistering(false);
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
            Passwordless<br />security
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Passkeys use your device&apos;s biometrics for the most secure authentication experience.
          </p>
          <div className="flex flex-col gap-4 pt-4">
            {[
              { icon: 'fingerprint', text: 'Biometric authentication' },
              { icon: 'phishing', text: 'Phishing-resistant by design' },
              { icon: 'devices', text: 'Works across your devices' },
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
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-primary text-2xl">fingerprint</span>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset your passkey</h1>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Register a new passkey for your account</p>
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
              <div className="space-y-5">
                {email && (
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">mail</span>
                      {email}
                    </span>
                  </div>
                )}

                <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">info</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">What happens next?</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Your old passkey will be removed and you&apos;ll register a new one using Face ID, Touch ID, or your security key.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetPasskey}
                  disabled={isRegistering || !isWebAuthnSupported()}
                  className="w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegistering ? (
                    <><span className="spinner" /> Registering...</>
                  ) : (
                    <><span className="material-symbols-outlined text-lg">fingerprint</span> Register new passkey</>
                  )}
                </button>
              </div>
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

export default function ResetPasskeyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <span className="spinner spinner-dark" />
      </div>
    }>
      <ResetPasskeyContent />
    </Suspense>
  );
}
