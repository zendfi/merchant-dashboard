'use client';

import { useState, useRef } from 'react';
import { shops as shopsApi, CreateProductRequest, ShopProduct } from '@/lib/api';

interface CreateProductModalProps {
  shopId: string;
  onClose: () => void;
  onCreated: (product: ShopProduct) => void;
}

const TOKENS = ['USDC', 'USDT', 'SOL'];

type Step = 1 | 2 | 3;

export default function CreateProductModal({ shopId, onClose, onCreated }: CreateProductModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [token, setToken] = useState('USDC');
  const [quantityType, setQuantityType] = useState<'unlimited' | 'limited'>('unlimited');
  const [quantityAvailable, setQuantityAvailable] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const req: CreateProductRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        price_usd: parseFloat(priceUsd),
        token,
        quantity_type: quantityType,
        quantity_available: quantityType === 'limited' ? parseInt(quantityAvailable) : undefined,
        media_urls: mediaUrls,
      };
      const product = await shopsApi.createProduct(shopId, req);
      onCreated(product);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = parseFloat(priceUsd) > 0 && (quantityType === 'unlimited' || parseInt(quantityAvailable) > 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f162b] rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Product</h2>
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
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
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

          {/* Step 2: Price & Quantity */}
          {step === 2 && (
            <>
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

              {/* Quantity */}
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
                      className={`py-2.5 rounded-xl text-sm font-medium transition border ${
                        quantityType === qt
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
                  {loading ? 'Adding…' : 'Add Product'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
