'use client';

import { useState } from 'react';
import { shops as shopsApi, CreateShopRequest, Shop } from '@/lib/api';

interface CreateShopModalProps {
  onClose: () => void;
  onCreated: (shop: Shop) => void;
}

const THEME_COLORS = [
  { value: '#8B7BF7', label: 'Violet' },
  { value: '#0EA5E9', label: 'Sky' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#1E293B', label: 'Slate' },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CreateShopModal({ onClose, onCreated }: CreateShopModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [themeColor, setThemeColor] = useState('#8B7BF7');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = slugify(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const req: CreateShopRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        theme_color: themeColor,
      };
      const shop = await shopsApi.create(req);
      onCreated(shop);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f162b] rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Shop</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Go live in under 3 minutes</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Adaeze Designs"
              maxLength={80}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
            {previewSlug && (
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                <span className="font-medium text-primary">{previewSlug}</span>.zendfi.app
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Description <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers what you sell..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
            />
          </div>

          {/* Theme Color */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Brand Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {THEME_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setThemeColor(c.value)}
                  className={`w-9 h-9 rounded-full transition-transform ${
                    themeColor === c.value ? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1f162b] ring-current' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value, color: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating…' : 'Create Shop'}
          </button>
        </form>
      </div>
    </div>
  );
}
