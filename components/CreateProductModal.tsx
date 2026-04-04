'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  shops as shopsApi,
  CreateProductRequest,
  ProductPreferenceDefinition,
  ShopProduct,
} from '@/lib/api';

interface CreateProductModalProps {
  shopId: string;
  onClose: () => void;
  onCreated: (product: ShopProduct) => void;
  initialProduct?: ShopProduct | null;
  onUpdated?: (product: ShopProduct) => void;
}

const TOKENS = ['USDC', 'USDT', 'SOL'];

type Step = 1 | 2 | 3;

interface PreferenceOptionDraft {
  label: string;
  value: string;
  upchargeUsd: string;
}

interface PreferenceDraft {
  key: string;
  label: string;
  type: 'select' | 'dropdown' | 'text' | 'number' | 'boolean';
  required: boolean;
  options: PreferenceOptionDraft[];
  maxLength: string;
  min: string;
  max: string;
}

function toOptionValue(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function moveOption(
  options: PreferenceOptionDraft[],
  fromIndex: number,
  toIndex: number,
): PreferenceOptionDraft[] {
  if (fromIndex === toIndex) return options;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= options.length || toIndex >= options.length) {
    return options;
  }
  const next = [...options];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
        }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${checked ? 'translate-x-5' : 'translate-x-0'
          }`}
      />
    </button>
  );
}

export default function CreateProductModal({ shopId, onClose, onCreated, initialProduct, onUpdated }: CreateProductModalProps) {
  const [step, setStep] = useState<Step>(1);
  const isEditMode = !!initialProduct;

  // Step 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 — price & payment
  const [onramp, setOnramp] = useState(false);
  const [priceUsd, setPriceUsd] = useState('');
  const [priceNgn, setPriceNgn] = useState('');
  const [token, setToken] = useState('USDC');
  const [quantityType, setQuantityType] = useState<'unlimited' | 'limited'>('unlimited');
  const [quantityAvailable, setQuantityAvailable] = useState('');
  const [payerServiceCharge, setPayerServiceCharge] = useState(true);
  const [collectCustomerInfo, setCollectCustomerInfo] = useState(false);

  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // Step 3 — media
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preferences, setPreferences] = useState<PreferenceDraft[]>([]);

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialProduct) return;
    setName(initialProduct.name || '');
    setDescription(initialProduct.description || '');
    setOnramp(initialProduct.onramp);
    setPriceUsd(initialProduct.price_usd ? String(initialProduct.price_usd) : '');
    setPriceNgn(initialProduct.amount_ngn ? String(initialProduct.amount_ngn) : '');
    setToken(initialProduct.token || 'USDC');
    setQuantityType(initialProduct.quantity_type || 'unlimited');
    setQuantityAvailable(initialProduct.quantity_available ? String(initialProduct.quantity_available) : '');
    setCollectCustomerInfo(initialProduct.collect_customer_info);
    setMediaUrls(initialProduct.media_urls || []);
    setPreferences(
      (initialProduct.preferences || []).map((pref) => ({
        key: pref.key,
        label: pref.label,
        type: pref.type,
        required: !!pref.required,
        options: (pref.options || []).map((opt) => ({
          label: opt.label,
          value: opt.value,
          upchargeUsd: String(opt.upcharge_usd ?? 0),
        })),
        maxLength: typeof pref.constraints_json?.max_length === 'number' ? String(pref.constraints_json.max_length) : '',
        min: typeof pref.constraints_json?.min === 'number' ? String(pref.constraints_json.min) : '',
        max: typeof pref.constraints_json?.max === 'number' ? String(pref.constraints_json.max) : '',
      })),
    );
  }, [initialProduct]);

  // Fetch NGN→USD exchange rate
  const loadExchangeRate = useCallback(async () => {
    if (exchangeRate) return;
    setLoadingRate(true);
    try {
      const resp = await fetch('/api/v1/onramp/rates');
      const data = await resp.json();
      const rate = data.on_ramp_rate?.rate || data.onRampRate?.rate || null;
      if (rate) setExchangeRate(parseFloat(rate));
    } catch {
      // ignore
    } finally {
      setLoadingRate(false);
    }
  }, [exchangeRate]);

  useEffect(() => {
    if (onramp) loadExchangeRate();
  }, [onramp, loadExchangeRate]);

  // Derived NGN → USD
  const ngnUsd = priceNgn && exchangeRate ? parseFloat(priceNgn) / exchangeRate : null;

  const handleMediaUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { upload_url, public_url } = await shopsApi.getUploadUrl({
        shop_id: shopId,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
      const res = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error('Upload failed');
      setMediaUrls((prev) => [...prev, public_url]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Resolve final USD price
      let finalPriceUsd: number;
      if (onramp) {
        if (!priceNgn || !exchangeRate) throw new Error('NGN amount required');
        finalPriceUsd = parseFloat(priceNgn) / exchangeRate;
      } else {
        finalPriceUsd = parseFloat(priceUsd);
      }

      const parsedPreferences: ProductPreferenceDefinition[] = preferences.map((pref, idx) => {
        const constraints: Record<string, unknown> = {};
        if (pref.type === 'text' && pref.maxLength) constraints.max_length = parseInt(pref.maxLength, 10);
        if (pref.type === 'number' && pref.min) constraints.min = parseFloat(pref.min);
        if (pref.type === 'number' && pref.max) constraints.max = parseFloat(pref.max);

        const normalizedType = pref.type === 'dropdown' ? 'select' : pref.type;

        let options;
        if (normalizedType === 'select') {
          const seenValues = new Set<string>();
          const cleaned = pref.options
            .map((opt, optionIndex) => {
              const label = opt.label.trim();
              const value = (opt.value.trim() || toOptionValue(label));
              if (!label || !value) return null;

              const upcharge = opt.upchargeUsd.trim() ? parseFloat(opt.upchargeUsd) : 0;
              if (!Number.isFinite(upcharge) || upcharge < 0) {
                throw new Error(`Preference "${pref.label || pref.key}" has an invalid upcharge value`);
              }
              if (seenValues.has(value)) {
                throw new Error(`Preference "${pref.label || pref.key}" has duplicate option values`);
              }
              seenValues.add(value);

              return {
                value,
                label,
                upcharge_usd: upcharge,
                display_order: optionIndex,
                is_active: true,
              };
            })
            .filter((opt): opt is NonNullable<typeof opt> => !!opt);

          if (cleaned.length === 0) {
            throw new Error(`Preference "${pref.label || pref.key}" needs at least one option`);
          }
          options = cleaned;
        }

        return {
          key: pref.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          label: pref.label.trim(),
          type: normalizedType,
          required: pref.required,
          constraints_json: constraints,
          display_order: idx,
          is_active: true,
          options,
        };
      });

      const req: CreateProductRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        price_usd: finalPriceUsd,
        token,
        quantity_type: quantityType,
        quantity_available: quantityType === 'limited' ? parseInt(quantityAvailable) : undefined,
        media_urls: mediaUrls,
        onramp,
        collect_customer_info: collectCustomerInfo,
        payer_service_charge: onramp ? payerServiceCharge : false,
        amount_ngn: onramp && priceNgn ? parseFloat(priceNgn) : undefined,
        preferences: parsedPreferences.length > 0 ? parsedPreferences : undefined,
      };
      if (isEditMode && initialProduct) {
        const updated = await shopsApi.updateProduct(shopId, initialProduct.id, req);
        onUpdated?.(updated);
      } else {
        const product = await shopsApi.createProduct(shopId, req);
        onCreated(product);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} product`);
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = (() => {
    if (onramp) {
      if (!priceNgn || parseFloat(priceNgn) < 1000) return false;
    } else {
      if (!priceUsd || parseFloat(priceUsd) <= 0) return false;
    }
    if (quantityType === 'limited' && (!quantityAvailable || parseInt(quantityAvailable) <= 0)) return false;
    return true;
  })();

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#13131f] rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEditMode ? 'Edit Product' : 'Add Product'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Step {step} of 3</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-1 px-6 mb-5">
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Step 1: Name & Description */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hand-painted tote bag"
                  maxLength={120}
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Description <span className="normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                />
              </div>
              <button
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </>
          )}

          {/* Step 2: Price, Payment & Options */}
          {step === 2 && (
            <>
              {/* Enable Fiat toggle */}
              <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Enable Fiat Payments</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Let customers pay via bank transfer (PAJ Ramp)</p>
                </div>
                <Toggle checked={onramp} onChange={() => setOnramp((v) => !v)} />
              </div>

              {/* Price input */}
              {onramp ? (
                /* NGN input */
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Price (NGN)
                  </label>
                  {loadingRate ? (
                    <div className="text-xs text-slate-400 py-2">Loading exchange rate…</div>
                  ) : exchangeRate ? (
                    <>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                        <input
                          type="number"
                          value={priceNgn}
                          onChange={(e) => setPriceNgn(e.target.value)}
                          placeholder="e.g. 5000"
                          min="1000"
                          step="1"
                          autoFocus
                          className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 px-1">
                        <p className="text-[11px] text-slate-400">Rate: ₦{exchangeRate.toFixed(2)} = $1.00 (PAJ Ramp)</p>
                        {ngnUsd !== null && ngnUsd > 0 && (
                          <p className="text-[11px] font-semibold text-primary">≈ ${ngnUsd.toFixed(2)} USD</p>
                        )}
                      </div>
                      {priceNgn && parseFloat(priceNgn) < 1000 && (
                        <p className="text-[11px] text-red-500 mt-1">Minimum onramp amount is ₦1,000</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-red-500">Failed to load exchange rate. Try toggling fiat off and on.</p>
                  )}
                </div>
              ) : (
                /* USD + Token */
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Price (USD)
                    </label>
                    <input
                      type="number"
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(e.target.value)}
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      required
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Token
                    </label>
                    <select
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    >
                      {TOKENS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Service charge — only when fiat enabled */}
              {onramp && (
                <div className="flex items-center justify-between py-2.5 px-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Charge Service Fee to Customer</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Turn off to absorb the fee yourself</p>
                  </div>
                  <Toggle checked={payerServiceCharge} onChange={() => setPayerServiceCharge((v) => !v)} />
                </div>
              )}

              {/* Quantity / Stock */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Stock
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['unlimited', 'limited'] as const).map((qt) => (
                    <button
                      key={qt}
                      type="button"
                      onClick={() => setQuantityType(qt)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition border ${quantityType === qt
                          ? 'bg-primary text-white border-primary'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/30'
                        }`}
                    >
                      {qt.charAt(0).toUpperCase() + qt.slice(1)}
                    </button>
                  ))}
                </div>
                {quantityType === 'limited' && (
                  <input
                    type="number"
                    value={quantityAvailable}
                    onChange={(e) => setQuantityAvailable(e.target.value)}
                    placeholder="How many units available?"
                    min="1"
                    step="1"
                    className="w-full mt-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                )}
              </div>

              {/* Collect customer info */}
              <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Collect Customer Details</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ask for name, phone & address at checkout</p>
                </div>
                <Toggle checked={collectCustomerInfo} onChange={() => setCollectCustomerInfo((v) => !v)} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  ← Back
                </button>
                <button
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                  className="flex-[2] py-3.5 rounded-xl bg-primary text-white font-semibold text-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* Step 3: Media */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Product Images <span className="normal-case font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {mediaUrls.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>close</span>
                      </button>
                    </div>
                  ))}
                  {mediaUrls.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center hover:border-primary/40 transition-colors disabled:opacity-60"
                    >
                      {uploading ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-slate-400 text-xl">add_photo_alternate</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Add</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMediaUpload(file);
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-slate-400">Up to 5 images · JPG, PNG, WebP · Max 10MB each</p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Product Preferences <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPreferences((prev) => [
                        ...prev,
                        {
                          key: '',
                          label: '',
                          type: 'select',
                          required: false,
                          options: [{ label: '', value: '', upchargeUsd: '0' }],
                          maxLength: '',
                          min: '',
                          max: '',
                        },
                      ])
                    }
                    className="text-xs font-semibold text-primary"
                  >
                    + Add
                  </button>
                </div>

                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {preferences.map((pref, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={pref.key}
                          onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, key: e.target.value } : p))}
                          placeholder="key (e.g. size)"
                          className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                        <input
                          value={pref.label}
                          onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, label: e.target.value } : p))}
                          placeholder="Label"
                          className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <select
                          value={pref.type}
                          onChange={(e) => setPreferences((prev) => prev.map((p, i) => {
                            if (i !== idx) return p;
                            const nextType = e.target.value as PreferenceDraft['type'];
                            if ((nextType === 'select' || nextType === 'dropdown') && p.options.length === 0) {
                              return { ...p, type: nextType, options: [{ label: '', value: '', upchargeUsd: '0' }] };
                            }
                            return { ...p, type: nextType };
                          }))}
                          className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="select">Select</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                        </select>
                        <label className="text-xs inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={pref.required}
                            onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, required: e.target.checked } : p))}
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() => setPreferences((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-rose-500 justify-self-end"
                        >
                          Remove
                        </button>
                      </div>
                      {(pref.type === 'select' || pref.type === 'dropdown') && (
                        <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-900">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Options</p>
                            <button
                              type="button"
                              onClick={() => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, options: [...p.options, { label: '', value: '', upchargeUsd: '0' }] } : p))}
                              className="text-[11px] font-semibold text-primary"
                            >
                              + Add option
                            </button>
                          </div>
                          <div className="space-y-2">
                            {pref.options.map((opt, optionIdx) => (
                              <div
                                key={optionIdx}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', String(optionIdx));
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const from = Number(e.dataTransfer.getData('text/plain'));
                                  if (Number.isNaN(from)) return;
                                  setPreferences((prev) => prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    return { ...p, options: moveOption(p.options, from, optionIdx) };
                                  }));
                                }}
                                className="grid grid-cols-12 gap-1.5 items-center cursor-grab active:cursor-grabbing"
                                title="Drag to reorder"
                              >
                                <span className="col-span-1 text-slate-400 text-xs text-center" aria-hidden="true">::</span>
                                <input
                                  value={opt.label}
                                  onChange={(e) => setPreferences((prev) => prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    return {
                                      ...p,
                                      options: p.options.map((o, oi) => oi === optionIdx ? { ...o, label: e.target.value } : o),
                                    };
                                  }))}
                                  placeholder="Label"
                                  className="col-span-3 px-2 py-1.5 rounded-md text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                                <input
                                  value={opt.value}
                                  onChange={(e) => setPreferences((prev) => prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    return {
                                      ...p,
                                      options: p.options.map((o, oi) => oi === optionIdx ? { ...o, value: e.target.value } : o),
                                    };
                                  }))}
                                  placeholder="value"
                                  className="col-span-4 px-2 py-1.5 rounded-md text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={opt.upchargeUsd}
                                  onChange={(e) => setPreferences((prev) => prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    return {
                                      ...p,
                                      options: p.options.map((o, oi) => oi === optionIdx ? { ...o, upchargeUsd: e.target.value } : o),
                                    };
                                  }))}
                                  placeholder="+USD"
                                  className="col-span-3 px-2 py-1.5 rounded-md text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreferences((prev) => prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    return { ...p, options: p.options.filter((_, oi) => oi !== optionIdx) };
                                  }))}
                                  className="col-span-1 text-rose-500 text-[11px]"
                                  aria-label="Remove option"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400">Drag rows by :: to reorder. If value is empty, it is auto-generated from label.</p>
                        </div>
                      )}
                      {pref.type === 'text' && (
                        <input
                          value={pref.maxLength}
                          onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, maxLength: e.target.value } : p))}
                          placeholder="Max length (optional)"
                          className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      )}
                      {pref.type === 'number' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={pref.min}
                            onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, min: e.target.value } : p))}
                            placeholder="Min"
                            className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <input
                            value={pref.max}
                            onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, max: e.target.value } : p))}
                            placeholder="Max"
                            className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  ← Back
                </button>
                <button
                  disabled={loading}
                  onClick={handleSubmit}
                  className="flex-[2] py-3.5 rounded-xl bg-primary text-white font-semibold text-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (isEditMode ? 'Saving…' : 'Adding…') : (isEditMode ? 'Save Changes' : 'Add Product')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
