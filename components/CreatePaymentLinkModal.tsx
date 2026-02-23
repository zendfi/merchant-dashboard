'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { paymentLinks, apiKeys as apiKeysApi } from '@/lib/api';
import type { PaymentLink, ApiKey } from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'live' | 'test';
  onCreated?: () => void;
}

type Step = 1 | 2 | 3 | 'success';

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const STEP_LABELS: Record<number, string> = {
  1: 'Amount',
  2: 'Details',
  3: 'API Key',
};

export default function CreatePaymentLinkModal({
  isOpen,
  onClose,
  mode,
  onCreated,
}: Props) {
  // ── Step ────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── Step 1 state ─────────────────────────────────────────────────────────-
  const [amount, setAmount] = useState('');
  const [currency] = useState('USD');
  const [token, setToken] = useState('USDC');
  const [onramp, setOnramp] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [ngnAmount, setNgnAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // ── Step 2 state ─────────────────────────────────────────────────────────-
  const [description, setDescription] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [payerServiceCharge, setPayerServiceCharge] = useState(true);
  const [collectCustomerInfo, setCollectCustomerInfo] = useState(false);

  // ── Step 3 state ─────────────────────────────────────────────────────────-
  const [apiKeysList, setApiKeysList] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [manualApiKey, setManualApiKey] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // ── Load exchange rate ────────────────────────────────────────────────────
  const loadExchangeRate = useCallback(async () => {
    if (exchangeRate) return;
    setLoadingRate(true);
    try {
      const resp = await fetch('/api/v1/onramp/rates');
      const data = await resp.json();
      const rate =
        data.on_ramp_rate?.rate || data.onRampRate?.rate || null;
      if (rate) setExchangeRate(parseFloat(rate));
    } catch {
      // ignore
    } finally {
      setLoadingRate(false);
    }
  }, [exchangeRate]);

  // ── Load API keys ────────────────────────────────────────────────────────-
  const loadApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const response = await apiKeysApi.list();
      const filtered = (response.api_keys ?? response).filter(
        (k: ApiKey) => k.mode === mode && k.is_active,
      );
      setApiKeysList(filtered);
      if (filtered.length > 0) setSelectedKeyId(filtered[0].id);
    } catch {
      setShowManualInput(true);
    } finally {
      setLoadingKeys(false);
    }
  }, [mode]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAmount('');
      setToken('USDC');
      setOnramp(false);
      setShowCalculator(false);
      setNgnAmount('');
      setDescription('');
      setMaxUses('');
      setExpiresIn('');
      setPayerServiceCharge(true);
      setCollectCustomerInfo(false);
      setManualApiKey('');
      setShowManualInput(false);
      setError('');
      setCreatedLink(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (showCalculator && !exchangeRate) loadExchangeRate();
  }, [showCalculator, exchangeRate, loadExchangeRate]);

  useEffect(() => {
    if (step === 3) loadApiKeys();
  }, [step, loadApiKeys]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const ngnUsd =
    ngnAmount && exchangeRate
      ? parseFloat(ngnAmount) / exchangeRate
      : null;

  const getApiKey = (): string => manualApiKey.trim();

  // ── Validation per step ───────────────────────────────────────────────────
  const canProceedStep1 = (): string => {
    if (onramp) {
      if (!ngnAmount) return 'Enter NGN amount for fiat onramp.';
      if (parseFloat(ngnAmount) < 1000) return 'Minimum onramp amount is ₦1,000.';
    } else {
      const usd = ngnUsd ?? parseFloat(amount);
      if (!amount && !ngnAmount) return 'Enter an amount.';
      if (isNaN(usd) || usd <= 0) return 'Enter a valid amount.';
    }
    return '';
  };

  const canProceedStep3 = (): string => {
    const key = getApiKey();
    if (!key) return 'Provide a valid API key.';
    return '';
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = () => {
    setError('');
    if (step === 1) {
      const err = canProceedStep1();
      if (err) { setError(err); return; }
      if (ngnUsd !== null && ngnUsd > 0) setAmount(ngnUsd.toFixed(2));
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const goBack = () => {
    setError('');
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const keyErr = canProceedStep3();
    if (keyErr) { setError(keyErr); return; }

    const finalAmount = parseFloat(amount);
    const key = getApiKey();

    setIsLoading(true);
    setError('');
    try {
      const body = {
        amount: finalAmount,
        currency,
        token,
        onramp,
        payer_service_charge: onramp ? payerServiceCharge : false,
        collect_customer_info: collectCustomerInfo,
        ...(description.trim() && { description: description.trim() }),
        ...(maxUses && { max_uses: parseInt(maxUses, 10) }),
        ...(expiresIn && { expires_at: new Date(Date.now() + parseInt(expiresIn, 10) * 60 * 60 * 1000).toISOString() }),
        ...(onramp && ngnAmount && { amount_ngn: parseFloat(ngnAmount) }),
      };

      const created = await paymentLinks.create(key, body);
      setCreatedLink(created);
      setStep('success');
      onCreated?.();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Failed to create payment link.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetAndCreateAnother = () => {
    setStep(1);
    setCreatedLink(null);
    setAmount('');
    setNgnAmount('');
    setDescription('');
    setMaxUses('');
    setExpiresIn('');
    setOnramp(false);
    setShowCalculator(false);
    setPayerServiceCharge(true);
    setCollectCustomerInfo(false);
    setManualApiKey('');
    setError('');
  };

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-primary">link</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {step === 'success' ? 'Link Created!' : 'New Payment Link'}
              </h2>
              {step !== 'success' && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Step {step} of 3 — {STEP_LABELS[step as number]}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              mode === 'live'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {mode}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* ── Step progress bar ───────────────────────────────────────────── */}
        {step !== 'success' && (
          <div className="px-6 pt-3 pb-1">
            <div className="flex gap-1.5">
              {([1, 2, 3] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    (step as number) >= s ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ════════ STEP 1 — Amount & Type ════════════════════════════════ */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">Amount</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); if (ngnAmount) setNgnAmount(''); }}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <span className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                    USD
                  </span>
                </div>
              </div>

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

              {showCalculator && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">calculate</span>
                    <span className="text-xs font-semibold text-primary">NGN to USD Calculator</span>
                  </div>
                  {loadingRate ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 py-2">Loading exchange rate…</div>
                  ) : exchangeRate ? (
                    <>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Current rate:{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">₦{exchangeRate.toFixed(2)} = $1.00</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={ngnAmount}
                          onChange={(e) => { setNgnAmount(e.target.value); if (e.target.value) setAmount(''); }}
                          placeholder="Enter NGN amount"
                          className="w-full pl-7 pr-3 py-2.5 border border-primary/30 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      {ngnUsd !== null && ngnUsd > 0 && (
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-primary/20 rounded-xl">
                          <span className="text-xs text-slate-500 dark:text-slate-400">USD Equivalent:</span>
                          <span className="text-sm font-bold text-primary">${ngnUsd.toFixed(2)}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        💡 Enter your NGN amount to auto-calculate the USD price. Rate by PAJ Ramp.
                      </p>
                    </>
                  ) : (
                    <div className="text-xs text-rose-600">Failed to load exchange rate.</div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">Payment Token</label>
                <div className="grid grid-cols-2 gap-2">
                  {['USDC', 'SOL'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setToken(t)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        token === t
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/40'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Enable Fiat Onramp</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allow customers to pay via card (PAJ Ramp)</p>
                </div>
                <Toggle checked={onramp} onChange={() => setOnramp(!onramp)} />
              </div>
            </>
          )}

          {/* ════════ STEP 2 — Details ══════════════════════════════════════ */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this payment for?"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                  Max Uses <span className="text-slate-400 font-normal">(empty = unlimited)</span>
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

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">Expires In</label>
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

              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Checkout Options
                </p>

                <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Collect Customer Details</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ask for name, phone, company &amp; address</p>
                  </div>
                  <Toggle checked={collectCustomerInfo} onChange={() => setCollectCustomerInfo(!collectCustomerInfo)} />
                </div>

                {onramp && (
                  <div className="flex items-center justify-between py-2.5 px-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Charge Service Fee to Payer</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Turn off to cover it yourself</p>
                    </div>
                    <Toggle checked={payerServiceCharge} onChange={() => setPayerServiceCharge(!payerServiceCharge)} />
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Summary</p>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Amount</span>
                  <span className="font-semibold text-slate-900 dark:text-white">${parseFloat(amount || '0').toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Token</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Onramp</span>
                  <span className={`font-semibold ${onramp ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {onramp ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ════════ STEP 3 — API Key ═══════════════════════════════════════ */}
          {step === 3 && (
            <>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">info</span>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Your API key is sent directly to the server and never stored in the browser. Use a{' '}
                  <strong>{mode === 'live' ? 'live' : 'test'}</strong> key with{' '}
                  <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">write</code> scope.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white">API Key</label>
                <input
                  type="password"
                  value={manualApiKey}
                  onChange={(e) => setManualApiKey(e.target.value)}
                  placeholder={mode === 'live' ? 'sk_live_…' : 'sk_test_…'}
                  autoComplete="off"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                />
              </div>

              {!loadingKeys && apiKeysList.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your {mode} API keys (enter the full key above):
                  </p>
                  <div className="space-y-1">
                    {apiKeysList.map((k) => (
                      <div key={k.id} className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400">
                        {k.prefix}••••••••
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════ SUCCESS ════════════════════════════════════════════════ */}
          {step === 'success' && createdLink && (
            <>
              <div className="text-center space-y-1">
                <div className="w-14 h-14 mx-auto bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-emerald-500">check_circle</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-3">${createdLink.amount.toFixed(2)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {createdLink.currency} · {createdLink.token}
                  {createdLink.onramp && <span className="ml-2 text-emerald-500 font-medium">· Onramp enabled</span>}
                </p>
              </div>

              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl border border-slate-200 dark:border-slate-700">
                  <QRCodeSVG value={createdLink.hosted_page_url || ''} size={160} level="H" includeMargin={false} />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Checkout Page', value: createdLink.hosted_page_url || '', key: 'hosted' },
                  { label: 'Direct Pay URL', value: createdLink.payment_url || '', key: 'direct' },
                  { label: 'Link Code', value: createdLink.link_code, key: 'code' },
                ].map(({ label, value, key }) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={value}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-white truncate"
                      />
                      <button
                        onClick={() => copyToClipboard(value, key)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                          copied === key ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90'
                        }`}
                      >
                        {copied === key ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className="text-emerald-500 font-medium">Active</span>
                </div>
                {createdLink.description && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">Description</span>
                    <span className="text-slate-900 dark:text-white text-right">{createdLink.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Max Uses</span>
                  <span className="text-slate-900 dark:text-white">{createdLink.max_uses || 'Unlimited'}</span>
                </div>
                {createdLink.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Expires</span>
                    <span className="text-slate-900 dark:text-white">{new Date(createdLink.expires_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 pb-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {step === 'success' ? (
            <div className="flex gap-3">
              <button
                onClick={resetAndCreateAnother}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Create Another
              </button>
              <button
                onClick={() => window.open(createdLink?.hosted_page_url, '_blank')}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open Page
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {(step as number) > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                  Cancel
                </button>
              )}

              {step === 3 ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">link</span>
                      Create Link
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  Next
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
