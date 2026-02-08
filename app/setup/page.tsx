'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { isWebAuthnSupported, createPasskeyCredential } from '@/lib/webauthn';

interface SetupStep {
  step: 'info' | 'passkey' | 'password' | 'complete';
}

interface ApiKeys {
  test: string;
  live: string;
}

const STEPS = [
  { key: 'info', label: 'Account', icon: 'person' },
  { key: 'passkey', label: 'Passkey', icon: 'fingerprint' },
  { key: 'password', label: 'Password', icon: 'lock' },
  { key: 'complete', label: 'Complete', icon: 'check_circle' },
] as const;

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webauthnSupported, setWebauthnSupported] = useState(true);
  const [merchantId, setMerchantId] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setWebauthnSupported(isWebAuthnSupported());
  }, []);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const copyKey = async (key: string, label: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
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

      const merchantId = data.merchant?.id;
      const keys = data.api_keys;

      if (!merchantId) throw new Error('Failed to get merchant ID from response');
      if (!keys?.test || !keys?.live) throw new Error('Failed to get API keys from response');

      setMerchantId(merchantId);
      setApiKeys(keys);
      setSuccess('Account created! Now let\'s set up your passkey.');
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

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
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

      if (!credential) throw new Error('Passkey creation was cancelled');

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

      setSuccess('Passkey registered! Now create a backup password.');
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
            Start accepting<br />payments today
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-sm">
            Create your merchant account in under 2 minutes and start receiving Solana payments instantly.
          </p>

          {/* Progress Stepper */}
          <div className="flex flex-col gap-3 pt-4">
            {STEPS.map((step, i) => {
              const isComplete = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`size-8 rounded-lg flex items-center justify-center transition-all ${
                    isComplete ? 'bg-white/30' : isCurrent ? 'bg-white/20 ring-2 ring-white/50' : 'bg-white/10'
                  }`}>
                    <span className="material-symbols-outlined text-white text-lg" style={isComplete ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      {isComplete ? 'check_circle' : step.icon}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${isCurrent ? 'text-white' : isComplete ? 'text-white/80' : 'text-white/40'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
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
            {/* Mobile Step Indicator */}
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              {STEPS.map((step, i) => (
                <div key={step.key} className={`h-1 flex-1 rounded-full transition-all ${
                  i <= currentStepIndex ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`} />
              ))}
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {currentStep === 'info' && 'Create your account'}
                {currentStep === 'passkey' && 'Set up your passkey'}
                {currentStep === 'password' && 'Create a password'}
                {currentStep === 'complete' && 'You\'re all set!'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {currentStep === 'info' && 'Start accepting crypto payments in minutes'}
                {currentStep === 'passkey' && 'Secure your account with biometric authentication'}
                {currentStep === 'password' && 'Set up email/password login as a backup'}
                {currentStep === 'complete' && 'Save your API keys — they won\'t be shown again'}
              </p>
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

            {/* Step 1: Account Info */}
            {currentStep === 'info' && (
              <form onSubmit={handleCreateMerchant} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Name</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">storefront</span>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Acme Inc."
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@company.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Address</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">location_on</span>
                    <input
                      type="text"
                      name="business_address"
                      value={formData.business_address}
                      onChange={handleInputChange}
                      placeholder="123 Main St, City, Country"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {!webauthnSupported && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">warning</span>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Your browser doesn&apos;t support passkeys. Please use a modern browser.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !webauthnSupported}
                  className="w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? <><span className="spinner" /> Creating account...</> : 'Continue'}
                </button>

                <p className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">Sign in</Link>
                </p>
              </form>
            )}

            {/* Step 2: Passkey Setup */}
            {currentStep === 'passkey' && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="size-16 mx-auto mb-4 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-3xl">fingerprint</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Use your device&apos;s biometrics (fingerprint, face, or PIN) for secure, passwordless login.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                  {[
                    'Click the button below to create your passkey',
                    'Verify using your fingerprint, face, or device PIN',
                    'Your passkey is saved securely on your device',
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-primary text-white flex items-center justify-center text-xs shrink-0 font-semibold">
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSetupPasskey}
                  disabled={isLoading}
                  className="w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <><span className="spinner" /> Setting up passkey...</>
                  ) : (
                    <><span className="material-symbols-outlined text-lg">fingerprint</span> Create Passkey</>
                  )}
                </button>
              </div>
            )}

            {/* Step 3: Password Creation */}
            {currentStep === 'password' && (
              <form onSubmit={handleCreatePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 chars: A-Z, a-z, 0-9"
                      required
                      minLength={8}
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
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <span className="material-symbols-outlined text-lg">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">info</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    You can use either your passkey or password to sign in. We recommend passkey for the best experience.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <><span className="spinner" /> Creating password...</> : 'Continue'}
                </button>
              </form>
            )}

            {/* Step 4: Complete — API Keys */}
            {currentStep === 'complete' && apiKeys && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="size-20 mx-auto mb-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-500 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                </div>

                {/* Test API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Test API Key</label>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Devnet</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={apiKeys.test}
                      readOnly
                      className="w-full px-4 py-2.5 pr-20 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyKey(apiKeys.test, 'test')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      {copiedKey === 'test' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Live API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Live API Key</label>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md">Mainnet</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={apiKeys.live}
                      readOnly
                      className="w-full px-4 py-2.5 pr-20 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyKey(apiKeys.live, 'live')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      {copiedKey === 'live' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">warning</span>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Store these keys securely. They won&apos;t be shown again. You can regenerate them from your dashboard.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="block w-full p-3 bg-primary text-white rounded-xl text-sm font-semibold text-center transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 no-underline"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
