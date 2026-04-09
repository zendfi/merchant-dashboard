'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  shops as shopsApi,
  CreateProductRequest,
  ProductPreferenceDefinition,
  ProductRelationshipType,
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

type Step = 1 | 2 | 3 | 4;

interface PreferenceDraft {
  label: string;
  required: boolean;
  optionsText: string;
}

interface RelatedProductDraft {
  related_product_id: string;
  relationship_type: ProductRelationshipType;
}

const RELATIONSHIP_TYPES: Array<{ label: string; value: ProductRelationshipType }> = [
  { label: 'Upsell', value: 'upsell' },
  { label: 'Cross-sell', value: 'cross_sell' },
  { label: 'Bundle', value: 'bundle' },
];

function toOptionValue(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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
  const [relatedProducts, setRelatedProducts] = useState<RelatedProductDraft[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ShopProduct[]>([]);
  const [loadingRelatedProducts, setLoadingRelatedProducts] = useState(false);

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
        label: pref.label,
        required: !!pref.required,
        optionsText: (pref.options || []).map((opt) => opt.label).join(', '),
      })),
    );
    setRelatedProducts(
      (initialProduct.related_products || [])
        .slice()
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((rel) => ({
          related_product_id: rel.related_product_id,
          relationship_type: rel.relationship_type,
        })),
    );
  }, [initialProduct]);

  useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      setLoadingRelatedProducts(true);
      try {
        const detail = await shopsApi.get(shopId);
        if (!cancelled) {
          setAvailableProducts(detail.products || []);
        }
      } catch {
        if (!cancelled) {
          setAvailableProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRelatedProducts(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [shopId]);

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
        const label = pref.label.trim();
        const options = pref.optionsText
          .split(',')
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0);

        if (!label) {
          throw new Error('Each preference needs a label (e.g. Size, Color)');
        }
        if (options.length === 0) {
          throw new Error(`Preference "${label}" needs at least one option`);
        }

        const seen = new Set<string>();
        const mapped = options.map((optionLabel, optionIndex) => {
          const value = toOptionValue(optionLabel);
          if (seen.has(value)) {
            throw new Error(`Preference "${label}" has duplicate options`);
          }
          seen.add(value);
          return {
            value,
            label: optionLabel,
            upcharge_usd: 0,
            display_order: optionIndex,
            is_active: true,
          };
        });

        return {
          key: toOptionValue(label),
          label,
          type: 'select',
          required: pref.required,
          constraints_json: {},
          display_order: idx,
          is_active: true,
          options: mapped,
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
        related_products: relatedProducts.length > 0
          ? relatedProducts.map((relation, index) => ({
            related_product_id: relation.related_product_id,
            relationship_type: relation.relationship_type,
            display_order: index,
          }))
          : undefined,
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

  const selectableRelatedProducts = availableProducts.filter((product) => {
    if (!product.is_active) return false;
    if (isEditMode && initialProduct && product.id === initialProduct.id) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#13131f] rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEditMode ? 'Edit Product' : 'Add Product'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Step {step} of 4</p>
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
          {([1, 2, 3, 4] as Step[]).map((s) => (
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
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Enable Naira Payments</p>
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

          {/* Step 3: Media & Related Products */}
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
                    Related Products <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <button
                    type="button"
                    disabled={loadingRelatedProducts || selectableRelatedProducts.length === 0}
                    onClick={() =>
                      setRelatedProducts((prev) => {
                        const selected = new Set(prev.map((relation) => relation.related_product_id));
                        const candidate = selectableRelatedProducts.find((product) => !selected.has(product.id));
                        if (!candidate) return prev;
                        return [
                          ...prev,
                          {
                            related_product_id: candidate.id,
                            relationship_type: 'cross_sell',
                          },
                        ];
                      })
                    }
                    className="text-xs font-semibold text-primary disabled:opacity-40"
                  >
                    + Add
                  </button>
                </div>

                {loadingRelatedProducts ? (
                  <p className="text-xs text-slate-400">Loading products...</p>
                ) : selectableRelatedProducts.length === 0 ? (
                  <p className="text-xs text-slate-400">No other active products are available to relate yet.</p>
                ) : relatedProducts.length === 0 ? (
                  <p className="text-xs text-slate-400">Suggest complementary products on storefront PDPs.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {relatedProducts.map((relation, idx) => {
                      const selectedIds = new Set(
                        relatedProducts
                          .filter((_, relationIndex) => relationIndex !== idx)
                          .map((item) => item.related_product_id),
                      );
                      const options = selectableRelatedProducts.filter(
                        (product) => product.id === relation.related_product_id || !selectedIds.has(product.id),
                      );

                      return (
                        <div key={`${relation.related_product_id}-${idx}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 bg-slate-50/60 dark:bg-slate-800/40 grid grid-cols-12 gap-2 items-center">
                          <select
                            value={relation.related_product_id}
                            onChange={(e) => setRelatedProducts((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, related_product_id: e.target.value } : item))}
                            className="col-span-7 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                            {options.map((product) => (
                              <option key={product.id} value={product.id}>{product.name}</option>
                            ))}
                          </select>
                          <select
                            value={relation.relationship_type}
                            onChange={(e) => setRelatedProducts((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, relationship_type: e.target.value as ProductRelationshipType } : item))}
                            className="col-span-4 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                            {RELATIONSHIP_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setRelatedProducts((prev) => prev.filter((_, relationIndex) => relationIndex !== idx))}
                            className="col-span-1 text-rose-500 text-[11px]"
                            aria-label="Remove related product"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-[2] py-3.5 rounded-xl bg-primary text-white font-semibold text-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* Step 4: Preferences */}
          {step === 4 && (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Help shoppers choose quickly</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create simple options like Size, Color, or Plan. Separate choices with commas.</p>
                <p className="text-[11px] text-slate-400 mt-1">Example: Label = Size, Options = Small, Medium, Large</p>
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
                          label: '',
                          required: false,
                          optionsText: '',
                        },
                      ])
                    }
                    className="text-xs font-semibold text-primary"
                  >
                    + Add
                  </button>
                </div>

                {preferences.length === 0 ? (
                  <p className="text-xs text-slate-400">No preferences yet. Add one if customers need to pick variants.</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {preferences.map((pref, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={pref.label}
                            onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, label: e.target.value } : p))}
                            placeholder="Label (e.g. Size)"
                            className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <input
                            value={pref.optionsText}
                            onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, optionsText: e.target.value } : p))}
                            placeholder="Options (e.g. Small, Medium, Large)"
                            className="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-xs inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={pref.required}
                              onChange={(e) => setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, required: e.target.checked } : p))}
                            />
                            Required selection
                          </label>
                          <button
                            type="button"
                            onClick={() => setPreferences((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-xs text-rose-500"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
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
