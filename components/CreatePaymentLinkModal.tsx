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

  // Load API keys on mount
  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
      loadExchangeRate();
    }
  }, [isOpen]);

  // Update USD amount when NGN changes
  useEffect(() => {
    if (ngnAmount && exchangeRate) {
      const usdValue = parseFloat(ngnAmount) / exchangeRate;
      setAmount(usdValue.toFixed(2));
    }
  }, [ngnAmount, exchangeRate]);

  // Reset form when modal closes
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
      // Filter keys by current mode
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
      if (!response.ok) {
        throw new Error('Failed to fetch rates');
      }
      const data = await response.json();
      // Backend returns PajRates directly: { on_ramp_rate: { rate, ... }, off_ramp_rate: { ... } }
      setExchangeRate(data.on_ramp_rate?.rate || data.onRampRate?.rate);
    } catch (err) {
      console.error('Failed to load exchange rate:', err);
    } finally {
      setLoadingRate(false);
    }
  };

  const getApiKey = (): string => {
    if (showManualInput) {
      return manualApiKey;
    }
    // For security, we need the full key. Show manual input if no keys available
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
      // Calculate expiration if set
      let expiresAt: string | undefined;
      if (expiresIn) {
        const hours = parseInt(expiresIn);
        if (hours > 0) {
          const date = new Date();
          date.setHours(date.getHours() + hours);
          expiresAt = date.toISOString();
        }
      }

      const link = await paymentLinks.create(apiKey, {
        amount: parseFloat(amount),
        currency,
        token,
        description: description || undefined,
        max_uses: maxUses ? parseInt(maxUses) : undefined,
        expires_at: expiresAt,
        onramp,
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
        className="fixed inset-0 bg-black/50 z-[200] transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white z-[201] shadow-[-4px_0_20px_rgba(0,0,0,0.1)] transform transition-transform duration-300 ease-out overflow-hidden flex flex-col"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e3e8ee] flex items-center justify-between bg-white">
          <div>
            <h2 className="text-lg font-semibold text-[#0a2540] m-0">
              {step === 'form' ? 'Create Payment Link' : 'Payment Link Created'}
            </h2>
            <p className="text-sm text-[#697386] mt-0.5">
              {step === 'form'
                ? 'Generate a shareable link for customers to pay'
                : 'Share this link with your customer'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f6f9fc] flex items-center justify-center text-[#697386] hover:bg-[#e3e8ee] hover:text-[#0a2540] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mode indicator */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                mode === 'live' 
                  ? 'bg-[#00D924]/10 text-[#00A91C]' 
                  : 'bg-[#635BFF]/10 text-[#635BFF]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-[#00D924]' : 'bg-[#635BFF]'}`} />
                {mode === 'live' ? 'Live Mode' : 'Test Mode'}
              </div>

              {/* API Key Section */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#0a2540]">
                  API Key <span className="text-red-500">*</span>
                </label>
                
                {apiKeysList.length > 0 && !showManualInput ? (
                  <div className="space-y-2">
                    <select
                      value={selectedKeyId}
                      onChange={(e) => setSelectedKeyId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
                    >
                      {apiKeysList.map((key) => (
                        <option key={key.id} value={key.id}>
                          {key.prefix}••••••••
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-[#697386]">
                      For security, please{' '}
                      <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="text-[#635BFF] hover:underline"
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
                      className="w-full px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
                    />
                    {apiKeysList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowManualInput(false)}
                        className="text-xs text-[#635BFF] hover:underline"
                      >
                        Select from saved keys
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#0a2540]">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#697386]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        // Clear NGN when manually editing USD
                        if (ngnAmount) setNgnAmount('');
                      }}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
                    />
                  </div>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
                  >
                    <option value="USD">USD</option>
                  </select>
                </div>

                {/* NGN Calculator Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCalculator(!showCalculator)}
                  className="text-xs text-[#635BFF] hover:underline flex items-center gap-1.5"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${showCalculator ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {showCalculator ? 'Hide' : 'Show'} NGN Calculator
                </button>

                {/* NGN Calculator */}
                {showCalculator && (
                  <div className="mt-3 p-3 bg-[#F0F0FF] border border-[#635BFF]/20 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#635BFF"
                        strokeWidth="2"
                      >
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      <span className="text-xs font-semibold text-[#635BFF]">
                        NGN to USD Calculator
                      </span>
                    </div>
                    
                    {loadingRate ? (
                      <div className="text-xs text-[#697386] py-2">Loading exchange rate...</div>
                    ) : exchangeRate ? (
                      <>
                        <div className="text-xs text-[#697386]">
                          Current rate: <span className="font-semibold text-[#0a2540]">₦{exchangeRate.toFixed(2)} = $1.00</span>
                        </div>
                        
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#697386] text-sm">₦</span>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={ngnAmount}
                            onChange={(e) => setNgnAmount(e.target.value)}
                            placeholder="Enter NGN amount"
                            className="w-full pl-7 pr-3 py-2.5 border border-[#635BFF]/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] bg-white"
                          />
                        </div>

                        {ngnAmount && parseFloat(ngnAmount) > 0 && (
                          <div className="flex items-center justify-between p-2.5 bg-white border border-[#635BFF]/20 rounded-lg">
                            <span className="text-xs text-[#697386]">USD Equivalent:</span>
                            <span className="text-sm font-bold text-[#635BFF]">
                              ${(parseFloat(ngnAmount) / exchangeRate).toFixed(2)}
                            </span>
                          </div>
                        )}
                        
                        <div className="text-[10px] text-[#697386] leading-relaxed">
                          💡 Enter your NGN amount to automatically calculate the USD price. Rate provided by PAJ Ramp.
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-red-600">Failed to load exchange rate</div>
                    )}
                  </div>
                )}
              </div>

              {/* Token */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#0a2540]">
                  Payment Token
                </label>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#0a2540]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this payment for?"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF] resize-none"
                />
              </div>

              {/* Advanced Options */}
              <div className="pt-4 border-t border-[#e3e8ee]">
                <h3 className="text-sm font-medium text-[#0a2540] mb-4">Advanced Options</h3>
                
                <div className="space-y-4">
                  {/* Max Uses */}
                  <div className="space-y-2">
                    <label className="block text-sm text-[#697386]">
                      Max Uses (leave empty for unlimited)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
                    />
                  </div>

                  {/* Expiration */}
                  <div className="space-y-2">
                    <label className="block text-sm text-[#697386]">
                      Expires in (hours)
                    </label>
                    <select
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[#e3e8ee] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#635BFF]"
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
                      <label className="block text-sm font-medium text-[#0a2540]">
                        Enable Fiat Onramp
                      </label>
                      <p className="text-xs text-[#697386] mt-0.5">
                        Allow customers to pay with card via PAJ Ramp
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnramp(!onramp)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        onramp ? 'bg-[#635BFF]' : 'bg-[#e3e8ee]'
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#635BFF] text-white rounded-lg font-medium hover:bg-[#5851ea] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
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
                <div className="w-16 h-16 mx-auto bg-[#00D924]/10 rounded-full flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00D924" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#0a2540]">Link Created!</h3>
                <p className="text-sm text-[#697386] mt-1">
                  Share this link with your customer to receive payment
                </p>
              </div>

              {/* Amount Display */}
              <div className="text-center py-4 bg-[#f6f9fc] rounded-xl">
                <div className="text-3xl font-bold text-[#0a2540]">
                  ${createdLink?.amount.toFixed(2)}
                </div>
                <div className="text-sm text-[#697386] mt-1">
                  {createdLink?.currency} • {createdLink?.token}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white border border-[#e3e8ee] rounded-xl">
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
                  <label className="block text-xs font-medium text-[#697386] uppercase tracking-wide">
                    Checkout Page
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdLink?.hosted_page_url || ''}
                      className="flex-1 px-3 py-2.5 bg-[#f6f9fc] border border-[#e3e8ee] rounded-lg text-sm font-mono text-[#0a2540] truncate"
                    />
                    <button
                      onClick={() => copyToClipboard(createdLink?.hosted_page_url || '', 'hosted')}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        copied === 'hosted'
                          ? 'bg-[#00D924] text-white'
                          : 'bg-[#635BFF] text-white hover:bg-[#5851ea]'
                      }`}
                    >
                      {copied === 'hosted' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Direct Payment URL */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#697386] uppercase tracking-wide">
                    Direct Pay URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdLink?.payment_url || ''}
                      className="flex-1 px-3 py-2.5 bg-[#f6f9fc] border border-[#e3e8ee] rounded-lg text-sm font-mono text-[#0a2540] truncate"
                    />
                    <button
                      onClick={() => copyToClipboard(createdLink?.payment_url || '', 'direct')}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        copied === 'direct'
                          ? 'bg-[#00D924] text-white'
                          : 'bg-[#635BFF] text-white hover:bg-[#5851ea]'
                      }`}
                    >
                      {copied === 'direct' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Link Code */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#697386] uppercase tracking-wide">
                    Link Code
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-[#f6f9fc] border border-[#e3e8ee] rounded-lg text-sm font-mono text-[#0a2540]">
                      {createdLink?.link_code}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdLink?.link_code || '', 'code')}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        copied === 'code'
                          ? 'bg-[#00D924] text-white'
                          : 'bg-[#635BFF] text-white hover:bg-[#5851ea]'
                      }`}
                    >
                      {copied === 'code' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 bg-[#f6f9fc] rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#697386]">Status</span>
                  <span className="text-[#00D924] font-medium">Active</span>
                </div>
                {createdLink?.description && (
                  <div className="flex justify-between">
                    <span className="text-[#697386]">Description</span>
                    <span className="text-[#0a2540]">{createdLink.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#697386]">Max Uses</span>
                  <span className="text-[#0a2540]">{createdLink?.max_uses || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#697386]">Onramp</span>
                  <span className="text-[#0a2540]">{createdLink?.onramp ? 'Enabled' : 'Disabled'}</span>
                </div>
                {createdLink?.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-[#697386]">Expires</span>
                    <span className="text-[#0a2540]">
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
                  className="flex-1 py-2.5 border border-[#e3e8ee] text-[#0a2540] rounded-lg font-medium hover:bg-[#f6f9fc] transition-colors"
                >
                  Create Another
                </button>
                <button
                  onClick={() => window.open(createdLink?.hosted_page_url, '_blank')}
                  className="flex-1 py-2.5 bg-[#635BFF] text-white rounded-lg font-medium hover:bg-[#5851ea] transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
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
