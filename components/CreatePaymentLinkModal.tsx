'use client';

import { useState, useEffect } from 'react';
import { useMode } from '@/lib/mode-context';
import { apiKeys as apiKeysApi, paymentLinks, ApiKey, PaymentLink } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

interface CreatePaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'form' | 'success';

export default function CreatePaymentLinkModal({ isOpen, onClose }: CreatePaymentLinkModalProps) {
  const { mode } = useMode();
  const [step, setStep] = useState<Step>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // API Keys state
  const [apiKeysList, setApiKeysList] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [manualApiKey, setManualApiKey] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [token, setToken] = useState('USDC');
  const [description, setDescription] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [onramp, setOnramp] = useState(false);

  // Success state
  const [createdLink, setCreatedLink] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // NGN Calculator state
  const [showCalculator, setShowCalculator] = useState(false);
  const [ngnAmount, setNgnAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
      loadExchangeRate();
    }
  }, [isOpen]);

  useEffect(() => {
    if (ngnAmount && exchangeRate) {
      const usdValue = parseFloat(ngnAmount) / exchangeRate;
      setAmount(usdValue.toFixed(2));
    }
  }, [ngnAmount, exchangeRate]);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('form');
        setError('');
        setAmount('');
        setDescription('');
        setMaxUses('');
        setExpiresIn('');
        setOnramp(false);
        setCreatedLink(null);
        setManualApiKey('');
        setShowManualInput(false);
      }, 300);
    }
  }, [isOpen]);

  const loadApiKeys = async () => {
    try {
      const response = await apiKeysApi.list();
      const filteredKeys = response.api_keys.filter(key => key.mode === mode && key.is_active);
      setApiKeysList(filteredKeys);
      if (filteredKeys.length > 0) {
        setSelectedKeyId(filteredKeys[0].id);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  const loadExchangeRate = async () => {
    setLoadingRate(true);
    try {
      const response = await fetch('/api/v1/onramp/rates');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const data = await response.json();
      setExchangeRate(data.on_ramp_rate?.rate || data.onRampRate?.rate);
    } catch (err) {
      console.error('Failed to load exchange rate:', err);
    } finally {
      setLoadingRate(false);
    }
  };

  const getApiKey = (): string => {
    if (showManualInput) return manualApiKey;
    return manualApiKey;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Please enter your API key');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);

    try {
      let expiresAt: string | undefined;
      if (expiresIn) {
        const hours = parseInt(expiresIn);
        if (hours > 0) {
          const date = new Date();
          date.setHours(date.getHours() + hours);
          expiresAt = date.toISOString();
        }
      }

      const amountNgn = ngnAmount && parseFloat(ngnAmount) > 0 ? parseFloat(ngnAmount) : undefined;

      const link = await paymentLinks.create(apiKey, {
        amount: parseFloat(amount),
        currency,
        token,
        description: description || undefined,
        max_uses: maxUses ? parseInt(maxUses) : undefined,
        expires_at: expiresAt,
        onramp,
        amount_ngn: amountNgn,
      });

      setCreatedLink(link);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[200] transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full sm:max-w-[480px] bg-white dark:bg-[#1f162b] z-[201] shadow-2xl transform transition-transform duration-300 ease-out overflow-hidden flex flex-col"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {step === 'form' ? 'Create Payment Link' : 'Payment Link Created'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {step === 'form'
                ? 'Generate a shareable link for customers to pay'
                : 'Share this link with your customer'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mode indicator */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                mode === 'live'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-primary/10 text-primary'
              }`}>
                <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-emerald-500' : 'bg-primary'}`} />
                {mode === 'live' ? 'Live Mode' : 'Test Mode'}
              </div>

              {/* API Key Section */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  API Key <span className="text-rose-500">*</span>
                </label>

                {apiKeysList.length > 0 && !showManualInput ? (
                  <div className="space-y-2">
                    <select
                      value={selectedKeyId}
                      onChange={(e) => setSelectedKeyId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {apiKeysList.map((key) => (
                        <option key={key.id} value={key.id}>
                          {key.prefix}••••••••
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      For security, please{' '}
                      <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="text-primary hover:underline"
                      >
                        enter your full API key
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={manualApiKey}
                      onChange={(e) => setManualApiKey(e.target.value)}
                      placeholder={mode === 'live' ? 'sk_live_...' : 'sk_test_...'}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {apiKeysList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowManualInput(false)}
                        className="text-xs text-primary hover:underline"
                      >
                        Select from saved keys
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Amount <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (ngnAmount) setNgnAmount('');
                      }}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="USD">USD</option>
                  </select>
                </div>

                {/* NGN Calculator Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCalculator(!showCalculator)}
                  className="text-xs text-primary hover:underline flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-[14px] transition-transform ${showCalculator ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                  {showCalculator ? 'Hide' : 'Show'} NGN Calculator
                </button>

                {/* NGN Calculator */}
                {showCalculator && (
                  <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">calculate</span>
                      <span className="text-xs font-semibold text-primary">NGN to USD Calculator</span>
                    </div>

                    {loadingRate ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 py-2">Loading exchange rate...</div>
                    ) : exchangeRate ? (
                      <>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Current rate: <span className="font-semibold text-slate-900 dark:text-white">₦{exchangeRate.toFixed(2)} = $1.00</span>
                        </div>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={ngnAmount}
                            onChange={(e) => setNgnAmount(e.target.value)}
                            placeholder="Enter NGN amount"
                            className="w-full pl-7 pr-3 py-2.5 border border-primary/30 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>

                        {ngnAmount && parseFloat(ngnAmount) > 0 && (
                          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-primary/20 rounded-xl">
                            <span className="text-xs text-slate-500 dark:text-slate-400">USD Equivalent:</span>
                            <span className="text-sm font-bold text-primary">
                              ${(parseFloat(ngnAmount) / exchangeRate).toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          💡 Enter your NGN amount to automatically calculate the USD price. Rate provided by PAJ Ramp.
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-rose-600">Failed to load exchange rate</div>
                    )}
                  </div>
                )}
              </div>

              {/* Token */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Payment Token
                </label>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this payment for?"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Advanced Options */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Advanced Options</h3>

                <div className="space-y-4">
                  {/* Max Uses */}
                  <div className="space-y-2">
                    <label className="block text-sm text-slate-500 dark:text-slate-400">
                      Max Uses (leave empty for unlimited)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  {/* Expiration */}
                  <div className="space-y-2">
                    <label className="block text-sm text-slate-500 dark:text-slate-400">
                      Expires in (hours)
                    </label>
                    <select
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Never expires</option>
                      <option value="1">1 hour</option>
                      <option value="24">24 hours</option>
                      <option value="72">3 days</option>
                      <option value="168">1 week</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>

                  {/* Onramp Toggle */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 dark:text-white">
                        Enable Fiat Onramp
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Allow customers to pay with card via PAJ Ramp
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnramp(!onramp)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        onramp ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          onramp ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    Create Payment Link
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Success View */
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[32px] text-emerald-500">check_circle</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Link Created!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Share this link with your customer to receive payment
                </p>
              </div>

              {/* Amount Display */}
              <div className="text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                  ${createdLink?.amount.toFixed(2)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {createdLink?.currency} • {createdLink?.token}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl border border-slate-200 dark:border-slate-700">
                  <QRCodeSVG
                    value={createdLink?.hosted_page_url || ''}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Links */}
              <div className="space-y-3">
                {/* Hosted Page URL */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Checkout Page
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdLink?.hosted_page_url || ''}
                      className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white truncate"
                    />
                    <button
                      onClick={() => copyToClipboard(createdLink?.hosted_page_url || '', 'hosted')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        copied === 'hosted'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {copied === 'hosted' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Direct Payment URL */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Direct Pay URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdLink?.payment_url || ''}
                      className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white truncate"
                    />
                    <button
                      onClick={() => copyToClipboard(createdLink?.payment_url || '', 'direct')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        copied === 'direct'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {copied === 'direct' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Link Code */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Link Code
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white">
                      {createdLink?.link_code}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdLink?.link_code || '', 'code')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        copied === 'code'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {copied === 'code' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className="text-emerald-500 font-medium">Active</span>
                </div>
                {createdLink?.description && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Description</span>
                    <span className="text-slate-900 dark:text-white">{createdLink.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Max Uses</span>
                  <span className="text-slate-900 dark:text-white">{createdLink?.max_uses || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Onramp</span>
                  <span className="text-slate-900 dark:text-white">{createdLink?.onramp ? 'Enabled' : 'Disabled'}</span>
                </div>
                {createdLink?.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Expires</span>
                    <span className="text-slate-900 dark:text-white">
                      {new Date(createdLink.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('form');
                    setCreatedLink(null);
                    setAmount('');
                    setDescription('');
                  }}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Create Another
                </button>
                <button
                  onClick={() => window.open(createdLink?.hosted_page_url, '_blank')}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  Open Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
