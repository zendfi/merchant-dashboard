'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isWebAuthnSupported, createPasskeyCredential } from '@/lib/webauthn';

interface SetupStep {
  step: 'info' | 'passkey' | 'complete';
}

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep['step']>('info');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    business_address: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);
  const [merchantId, setMerchantId] = useState<string>('');

  useEffect(() => {
    setWebauthnSupported(isWebAuthnSupported());
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.email || !formData.business_address) {
      setError('Please fill in all fields');
      return;
    }

    if (!webauthnSupported) {
      setError('Your browser does not support passkeys. Please use a modern browser.');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create the merchant account
      const response = await fetch('/api/v1/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          business_address: formData.business_address,
          wallet_generation_method: 'mpc_passkey',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create account');
      }

      setMerchantId(data.merchant_id);
      setSuccess('Account created! Now let\'s set up your passkey for secure login.');
      setCurrentStep('passkey');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPasskey = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Step 2: Start WebAuthn registration
      const startResponse = await fetch('/api/v1/webauthn/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          email: formData.email,
          display_name: formData.name,
        }),
      });

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        throw new Error(startData.message || 'Failed to start passkey registration');
      }

      // Step 3: Create passkey using browser WebAuthn API
      const options = startData.options.publicKey || startData.options;
      const credential = await createPasskeyCredential({
        challenge: options.challenge,
        rp: options.rp,
        user: options.user,
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation,
      });

      if (!credential) {
        throw new Error('Passkey creation was cancelled');
      }

      // Step 4: Finish WebAuthn registration
      const finishResponse = await fetch('/api/v1/webauthn/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: startData.challenge_id,
          credential,
        }),
      });

      const finishData = await finishResponse.json();

      if (!finishResponse.ok) {
        throw new Error(finishData.message || 'Failed to complete passkey registration');
      }

      setSuccess('Passkey registered successfully! Redirecting to login...');
      setCurrentStep('complete');
      
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register passkey';
      if (message.includes('NotAllowedError') || message.includes('cancelled')) {
        setError('Passkey creation was cancelled. Please try again.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-xl border border-[#e3e8ee] shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-[28px] font-bold text-[#635bff] tracking-[-0.5px]">
            ZendFi
          </div>
          <p className="text-[#697386] text-sm mt-2">Create your merchant account</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`flex items-center gap-2 ${currentStep === 'info' ? 'text-[#635bff]' : 'text-[#697386]'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'info' ? 'bg-[#635bff] text-white' : 'bg-[#635bff] text-white'
            }`}>
              {currentStep === 'info' ? '1' : '✓'}
            </div>
            <span className="text-sm font-medium hidden sm:inline">Account</span>
          </div>
          <div className="w-8 h-[2px] bg-[#e3e8ee]" />
          <div className={`flex items-center gap-2 ${currentStep === 'passkey' ? 'text-[#635bff]' : 'text-[#697386]'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'passkey' || currentStep === 'complete' ? 'bg-[#635bff] text-white' : 'bg-[#e3e8ee] text-[#697386]'
            }`}>
              {currentStep === 'complete' ? '✓' : '2'}
            </div>
            <span className="text-sm font-medium hidden sm:inline">Passkey</span>
          </div>
          <div className="w-8 h-[2px] bg-[#e3e8ee]" />
          <div className={`flex items-center gap-2 ${currentStep === 'complete' ? 'text-[#635bff]' : 'text-[#697386]'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'complete' ? 'bg-[#635bff] text-white' : 'bg-[#e3e8ee] text-[#697386]'
            }`}>
              3
            </div>
            <span className="text-sm font-medium hidden sm:inline">Done</span>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-[#fdf2f2] border border-[#fecaca] rounded-lg text-[#dc2626] text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-[#f0fdf4] border border-[#86efac] rounded-lg text-[#16a34a] text-sm">
            {success}
          </div>
        )}

        {/* Step 1: Account Info */}
        {currentStep === 'info' && (
          <form onSubmit={handleCreateMerchant} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#0a2540] mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Acme Inc."
                className="w-full px-3.5 py-2.5 border border-[#e3e8ee] rounded-lg text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0a2540] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 border border-[#e3e8ee] rounded-lg text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0a2540] mb-1.5">
                Business Address
              </label>
              <input
                type="text"
                name="business_address"
                value={formData.business_address}
                onChange={handleInputChange}
                placeholder="123 Main St, City, Country"
                className="w-full px-3.5 py-2.5 border border-[#e3e8ee] rounded-lg text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] transition-all"
                required
              />
            </div>

            {!webauthnSupported && (
              <div className="p-3 bg-[#fef3cd] border border-[#ffc107] rounded-lg text-[#856404] text-sm">
                <strong>Note:</strong> Your browser doesn&apos;t support passkeys. You&apos;ll need to use a modern browser like Chrome, Safari, or Edge.
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !webauthnSupported}
              className="w-full py-2.5 bg-[#635bff] text-white font-medium rounded-lg hover:bg-[#5851ea] focus:ring-2 focus:ring-[#635bff] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        )}

        {/* Step 2: Passkey Setup */}
        {currentStep === 'passkey' && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#f0f4ff] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[#635bff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#0a2540] mb-2">
                Set Up Your Passkey
              </h3>
              <p className="text-[#697386] text-sm">
                Passkeys provide secure, passwordless authentication using your device&apos;s biometrics (fingerprint or face).
              </p>
            </div>

            <div className="bg-[#f7f8fa] rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#635bff] text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  1
                </div>
                <p className="text-sm text-[#425466]">
                  Click the button below to create your passkey
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#635bff] text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  2
                </div>
                <p className="text-sm text-[#425466]">
                  Verify using your fingerprint, face, or device PIN
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#635bff] text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  3
                </div>
                <p className="text-sm text-[#425466]">
                  Your passkey will be saved securely on your device
                </p>
              </div>
            </div>

            <button
              onClick={handleSetupPasskey}
              disabled={isLoading}
              className="w-full py-2.5 bg-[#635bff] text-white font-medium rounded-lg hover:bg-[#5851ea] focus:ring-2 focus:ring-[#635bff] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Setting up passkey...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Create Passkey
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Complete */}
        {currentStep === 'complete' && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-[#f0fdf4] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[#16a34a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0a2540]">
              Account Created!
            </h3>
            <p className="text-[#697386] text-sm">
              Your merchant account is ready. You&apos;ll be redirected to the login page shortly.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-2.5 bg-[#635bff] text-white font-medium rounded-lg hover:bg-[#5851ea] transition-all text-center"
            >
              Go to Login
            </Link>
          </div>
        )}

        {/* Footer */}
        {currentStep === 'info' && (
          <div className="text-center mt-8 pt-6 border-t border-[#e3e8ee] text-sm text-[#697386]">
            Already have an account?{' '}
            <Link href="/login" className="text-[#635bff] hover:underline">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
