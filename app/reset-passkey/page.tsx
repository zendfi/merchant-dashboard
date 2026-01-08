'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
          <h1 className="text-2xl font-semibold text-[#30313d] mb-2 flex items-center gap-2.5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#635bff"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Reset your passkey
          </h1>
          <p className="text-[#697386] mb-8 text-sm">
            Register a new passkey for your account
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
            <div>
              {email && (
                <div className="text-center mb-6 p-3 bg-[#f6f9fc] rounded-md text-[#30313d] text-sm font-medium">
                  {email}
                </div>
              )}

              <div className="bg-[#f6f9fc] border-l-[3px] border-[#635bff] p-4 my-6 text-sm text-[#697386] leading-relaxed rounded-r-md">
                <strong className="block text-[#30313d] mb-1">What happens next?</strong>
                Your old passkey will be removed and you&apos;ll register a new one using
                Face ID, Touch ID, or your security key.
              </div>

              <button
                type="button"
                onClick={handleResetPasskey}
                disabled={isRegistering || !isWebAuthnSupported()}
                className="w-full p-3 bg-[#635bff] text-white border-none rounded-md text-[15px] font-medium cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-[#5851ea] disabled:bg-[#a5a5a5] disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <>
                    <span className="spinner" /> Registering...
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
                    Register new passkey
                  </>
                )}
              </button>
            </div>
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

export default function ResetPasskeyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f9fc]">
        <div className="spinner spinner-dark" />
      </div>
    }>
      <ResetPasskeyContent />
    </Suspense>
  );
}
