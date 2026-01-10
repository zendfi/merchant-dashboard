'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isWebAuthnSupported, createPasskeyCredential } from '@/lib/webauthn';

interface SetupStep {
  step: 'info' | 'passkey' | 'password' | 'complete';
}

interface ApiKeys {
  test: string;
  live: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep['step']>('info');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    business_address: '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);
  const [merchantId, setMerchantId] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);

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

      // Backend returns: { merchant: { id, name, ... }, api_keys: { test, live }, ... }
      const merchantId = data.merchant?.id;
      const keys = data.api_keys;
      
      if (!merchantId) {
        throw new Error('Failed to get merchant ID from response');
      }

      if (!keys?.test || !keys?.live) {
        throw new Error('Failed to get API keys from response');
      }

      setMerchantId(merchantId);
      setApiKeys(keys);
      setSuccess('Account created! Now let\'s set up your passkey for secure login.');
      setCurrentStep('passkey');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasDigit) {
      setError('Password must contain uppercase, lowercase, and a number');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/merchants/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to set password');
      }

      setSuccess('Password created successfully!');
      setCurrentStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create password');
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

      setSuccess('Passkey registered successfully! Now create a password for email/password login.');
      setCurrentStep('password');
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
    <div className="min-h-screen flex flex-col bg-[#f6f9fc]">
      {/* Header */}
      <header className="p-6 px-8">
        <Link href="/" className="text-2xl font-bold text-[#635bff] no-underline">
          zendfi
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 pb-16">
        <div className="w-full max-w-[460px]">
          <div className="bg-white rounded-lg border border-[#e3e8ee] shadow-sm overflow-hidden">
            <div className="p-8 px-10">
              {/* Title */}
              <h1 className="text-2xl font-semibold text-[#0a2540] mb-2">
                {currentStep === 'info' && 'Create your account'}
                {currentStep === 'passkey' && 'Set up your passkey'}
                {currentStep === 'password' && 'Create a password'}
                {currentStep === 'complete' && 'Your API Keys'}
              </h1>
              <p className="text-[#697386] text-[15px] mb-8">
                {currentStep === 'info' && 'Start accepting crypto payments in minutes'}
                {currentStep === 'passkey' && 'Secure your account with biometric authentication'}
                {currentStep === 'password' && 'Set up email/password login as a backup'}
                {currentStep === 'complete' && 'Save these keys - they won\'t be shown again'}
              </p>

              {/* Error/Success Messages */}
              {error && (
                <div className="mb-6 p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg">
                  <p className="text-[#dc2626] text-sm">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-6 p-4 bg-[#f0fdf4] border border-[#86efac] rounded-lg">
                  <p className="text-[#16a34a] text-sm">{success}</p>
                </div>
              )}

              {/* Step 1: Account Info */}
              {currentStep === 'info' && (
                <form onSubmit={handleCreateMerchant} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#0a2540]">
                      Business Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Acme Inc."
                      className="w-full px-4 py-3 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#0a2540]">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#0a2540]">
                      Business Address
                    </label>
                    <input
                      type="text"
                      name="business_address"
                      value={formData.business_address}
                      onChange={handleInputChange}
                      placeholder="123 Main St, City, Country"
                      className="w-full px-4 py-3 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 transition-all"
                      required
                    />
                  </div>

                  {!webauthnSupported && (
                    <div className="p-4 bg-[#fff8e6] border border-[#ffc107] rounded-lg">
                      <p className="text-[#856404] text-sm">
                        <strong>Note:</strong> Your browser doesn&apos;t support passkeys. Please use a modern browser.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !webauthnSupported}
                    className="w-full py-3 bg-[#635bff] text-white font-medium rounded-lg text-[15px] hover:bg-[#5851ea] focus:ring-4 focus:ring-[#635bff]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-[#f0f4ff] rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-[#635bff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <h3 className="text-base font-medium text-[#0a2540] mb-2">
                      Secure your account with a passkey
                    </h3>
                    <p className="text-[#697386] text-sm leading-relaxed">
                      Use your device&apos;s biometrics (fingerprint, face, or PIN) for secure, passwordless login
                    </p>
                  </div>

                  <div className="bg-[#f6f9fc] rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#635bff] text-white flex items-center justify-center text-xs flex-shrink-0 font-medium">
                        1
                      </div>
                      <p className="text-sm text-[#425466] pt-0.5">
                        Click the button below to create your passkey
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#635bff] text-white flex items-center justify-center text-xs flex-shrink-0 font-medium">
                        2
                      </div>
                      <p className="text-sm text-[#425466] pt-0.5">
                        Verify using your fingerprint, face, or device PIN
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#635bff] text-white flex items-center justify-center text-xs flex-shrink-0 font-medium">
                        3
                      </div>
                      <p className="text-sm text-[#425466] pt-0.5">
                        Your passkey will be saved securely on your device
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSetupPasskey}
                    disabled={isLoading}
                    className="w-full py-3 bg-[#635bff] text-white font-medium rounded-lg text-[15px] hover:bg-[#5851ea] focus:ring-4 focus:ring-[#635bff]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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

              {/* Step 3: Password Creation */}
              {currentStep === 'password' && (
                <form onSubmit={handleCreatePassword} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#0a2540]">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Must include A-Z, a-z, 0-9"
                      className="w-full px-4 py-3 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 transition-all"
                      required
                      minLength={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[#0a2540]">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full px-4 py-3 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] placeholder:text-[#a3acb9] focus:outline-none focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 transition-all"
                      required
                      minLength={8}
                    />
                  </div>

                  <div className="bg-[#f6f9fc] rounded-lg p-4">
                    <p className="text-xs text-[#425466]">
                      💡 You can use either your passkey or password to sign in. We recommend using your passkey for the best experience.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-[#635bff] text-white font-medium rounded-lg text-[15px] hover:bg-[#5851ea] focus:ring-4 focus:ring-[#635bff]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating Password...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </button>
                </form>
              )}

              {/* Step 4: Complete - API Keys Display */}
              {currentStep === 'complete' && apiKeys && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-[#f0fdf4] rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-[#16a34a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <path d="M22 4L12 14.01l-3-3" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-[#0a2540] mb-2">
                      Account Created!
                    </h3>
                    <p className="text-[#697386] text-[15px]">
                      Your API keys are ready. Copy them now - they won&apos;t be shown again.
                    </p>
                  </div>

                  {/* Test API Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-[#0a2540]">
                        Test API Key
                      </label>
                      <span className="text-xs text-[#697386] bg-[#f6f9fc] px-2 py-1 rounded">
                        Devnet
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={apiKeys.test}
                        readOnly
                        className="w-full px-4 py-3 pr-24 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] bg-[#f6f9fc] font-mono text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(apiKeys.test);
                          setSuccess('Test key copied!');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm text-[#635bff] hover:bg-[#f0f4ff] rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Live API Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-[#0a2540]">
                        Live API Key
                      </label>
                      <span className="text-xs text-[#697386] bg-[#fff8e6] px-2 py-1 rounded">
                        Mainnet
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={apiKeys.live}
                        readOnly
                        className="w-full px-4 py-3 pr-24 border border-[#e3e8ee] rounded-lg text-[15px] text-[#0a2540] bg-[#f6f9fc] font-mono text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(apiKeys.live);
                          setSuccess('Live key copied!');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm text-[#635bff] hover:bg-[#f0f4ff] rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#fff8e6] border border-[#ffc107] rounded-lg p-4">
                    <p className="text-sm text-[#856404]">
                      ⚠️ <strong>Important:</strong> Store these keys securely. For security reasons, we won&apos;t show them again. You can regenerate them later from your dashboard.
                    </p>
                  </div>

                  <Link
                    href="/login"
                    className="inline-block w-full py-3 bg-[#635bff] text-white font-medium rounded-lg text-[15px] hover:bg-[#5851ea] transition-all text-center no-underline"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              )}
            </div>

            {/* Footer */}
            {currentStep === 'info' && (
              <div className="px-10 py-6 border-t border-[#e3e8ee] bg-[#fafbfc]">
                <p className="text-center text-sm text-[#697386]">
                  Already have an account?{' '}
                  <Link href="/login" className="text-[#635bff] hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
