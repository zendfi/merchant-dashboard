'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '@/lib/notifications';
import {
  shops as shopsApi,
  Shop,
  ShopProduct,
} from '@/lib/api';
import CreateShopModal from '@/components/CreateShopModal';
import CreateProductModal from '@/components/CreateProductModal';

const SHOP_BASE = process.env.NEXT_PUBLIC_SHOP_BASE_DOMAIN || 'zendfi.app';

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────
function shopUrl(slug: string) {
  return `https://${slug}.${SHOP_BASE}`;
}

function formatPrice(price: number, token: string) {
  return `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${token}`;
}

// ────────────────────────────────────────────────────────────────────────────────
// ProductCard
// ────────────────────────────────────────────────────────────────────────────────
function ProductCard({
  product,
  themeColor,
  onDelete,
  onToggleActive,
}: {
  product: ShopProduct;
  themeColor: string;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasImage = product.media_urls && product.media_urls.length > 0;

  const handleDelete = async () => {
    setDeleting(true);
    onDelete();
  };

  return (
    <div className="group relative bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-[20px] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 flex flex-col h-full">
      {/* Product Image */}
      <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-800/50 relative overflow-hidden shrink-0">
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.media_urls[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/80">
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 drop-shadow-sm" style={{ fontSize: 48 }}>image</span>
          </div>
        )}

        {/* Subtle gradient overlay at top for icons */}
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-0" />

        {/* Top-right actions */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-8 h-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 border border-black/5 dark:border-white/5"
            >
              <span className="material-symbols-outlined text-slate-700 dark:text-slate-300" style={{ fontSize: 18 }}>more_horiz</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 w-40 bg-white/95 dark:bg-[#2a1f3d]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-2xl overflow-hidden z-20 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => { onToggleActive(); setMenuOpen(false); }}
                  className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {product.is_active ? 'visibility_off' : 'visibility'}
                  </span>
                  {product.is_active ? 'Hide Product' : 'Show Product'}
                </button>
                <div className="h-px w-full bg-slate-100 dark:bg-slate-800 mx-auto max-w-[90%]" />
                <button
                  onClick={() => { handleDelete(); setMenuOpen(false); }}
                  disabled={deleting}
                  className="w-full px-3 py-2.5 text-left text-[13px] font-semibold text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2.5 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Inactive badge */}
        {!product.is_active && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300 z-0">
            <span className="flex items-center gap-1.5 text-white text-[11px] font-bold tracking-wider uppercase bg-black/60 px-3 py-1.5 rounded-full shadow-lg border border-white/10">
              <span className="material-symbols-outlined text-[14px]">visibility_off</span>
              Hidden
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 flex flex-col flex-1 pb-5">
        <h4 className="text-[15px] leading-tight font-bold text-slate-900 dark:text-white line-clamp-2 hover:text-primary transition-colors cursor-default mb-1">
          {product.name}
        </h4>

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <p className="text-[16px] font-extrabold tracking-tight drop-shadow-sm" style={{ color: themeColor }}>
            {formatPrice(product.price_usd, product.token)}
          </p>

          {product.quantity_type === 'limited' ? (
            <span className="shrink-0 inline-flex items-center justify-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-[10px] font-bold text-slate-600 dark:text-slate-400">
              {Math.max(0, (product.quantity_available ?? 0) - product.quantity_sold)} left
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center justify-center px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-800/50">
              Unlimited
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ShopDetail (expanded view of one shop)
// ────────────────────────────────────────────────────────────────────────────────
function ShopDetail({
  shop: initialShop,
  onBack,
  onShopUpdated,
}: {
  shop: Shop;
  onBack: () => void;
  onShopUpdated: (shop: Shop) => void;
}) {
  const { showNotification } = useNotification();
  const [shop, setShop] = useState(initialShop);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [togglingLive, setTogglingLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCustomise, setShowCustomise] = useState(false);
  const [savingCustomise, setSavingCustomise] = useState(false);
  // Customise form state (initialised from shop)
  const [welcomeMsg, setWelcomeMsg] = useState(initialShop.welcome_message || '');
  const [about, setAbout] = useState(initialShop.about || '');
  const [contactEmail, setContactEmail] = useState(initialShop.contact_email || '');
  const [twitterUrl, setTwitterUrl] = useState(initialShop.twitter_url || '');
  const [facebookUrl, setFacebookUrl] = useState(initialShop.facebook_url || '');
  const [instagramUrl, setInstagramUrl] = useState(initialShop.instagram_url || '');
  const [location, setLocation] = useState(initialShop.shop_location || '');
  const [nationwideDelivery, setNationwideDelivery] = useState(initialShop.can_deliver_nationwide || false);
  const [is24Hours, setIs24Hours] = useState(initialShop.is_24_hours || false);
  const [openTime, setOpenTime] = useState(initialShop.open_time || '');
  const [closeTime, setCloseTime] = useState(initialShop.close_time || '');

  const loadProducts = useCallback(async () => {
    try {
      const detail = await shopsApi.get(shop.id);
      setProducts(detail.products);
    } finally {
      setLoadingProducts(false);
    }
  }, [shop.id]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleToggleLive = async () => {
    setTogglingLive(true);
    try {
      const updated = await shopsApi.update(shop.id, { is_live: !shop.is_live });
      setShop(updated);
      onShopUpdated(updated);
      showNotification(updated.is_live ? 'Shop is now live!' : 'Shop taken offline', undefined, 'info');
    } catch {
      showNotification('Failed to update shop status', undefined, 'error');
    } finally {
      setTogglingLive(false);
    }
  };

  const handleSaveCustomise = async () => {
    setSavingCustomise(true);
    try {
      const updated = await shopsApi.update(shop.id, {
        welcome_message: welcomeMsg.trim() || undefined,
        about: about.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        twitter_url: twitterUrl.trim() || undefined,
        facebook_url: facebookUrl.trim() || undefined,
        instagram_url: instagramUrl.trim() || undefined,
        shop_location: location.trim() || undefined,
        can_deliver_nationwide: nationwideDelivery,
        is_24_hours: is24Hours,
        open_time: is24Hours ? null : (openTime || null),
        close_time: is24Hours ? null : (closeTime || null),
      });
      setShop(updated);
      onShopUpdated(updated);
      showNotification('Shop customisation saved!', undefined, 'success');
    } catch {
      showNotification('Failed to save', undefined, 'error');
    } finally {
      setSavingCustomise(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(shopUrl(shop.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProductCreated = (product: ShopProduct) => {
    setProducts((prev) => [product, ...prev]);
    setShowCreateProduct(false);
    showNotification('Product added!', undefined, 'success');
  };

  const handleDeleteProduct = async (product: ShopProduct) => {
    try {
      await shopsApi.deleteProduct(shop.id, product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      showNotification('Product removed', undefined, 'info');
    } catch {
      showNotification('Failed to remove product', undefined, 'error');
    }
  };

  const handleToggleProductActive = async (product: ShopProduct) => {
    try {
      const updated = await shopsApi.updateProduct(shop.id, product.id, {
        is_active: !product.is_active,
      });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      showNotification('Failed to update product', undefined, 'error');
    }
  };

  const activeProducts = products.filter((p) => p.is_active);
  const hiddenProducts = products.filter((p) => !p.is_active);

  return (
    <>
      {showCreateProduct && (
        <CreateProductModal
          shopId={shop.id}
          onClose={() => setShowCreateProduct(false)}
          onCreated={handleProductCreated}
        />
      )}

      {/* Back + Title bar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{shop.name}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{shopUrl(shop.slug)}</p>
        </div>
        {/* Live toggle */}
        <button
          onClick={handleToggleLive}
          disabled={togglingLive}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${shop.is_live
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${shop.is_live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
          />
          {togglingLive ? '…' : shop.is_live ? 'Live' : 'Offline'}
        </button>
      </div>

      {/* Shop URL bar */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-700/50">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: shop.theme_color + '20', color: shop.theme_color }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>storefront</span>
        </div>
        <p className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
          {shopUrl(shop.slug)}
        </p>
        <button
          onClick={handleCopyUrl}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* ── Customise Section ── */}
      <div className="mb-5 rounded-2xl border border-slate-200/70 dark:border-slate-700/50 overflow-hidden">
        <button
          onClick={() => setShowCustomise((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>tune</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Customise</span>
          </div>
          <span
            className="material-symbols-outlined text-slate-400 transition-transform duration-200"
            style={{ fontSize: 18, transform: showCustomise ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        </button>

        {showCustomise && (
          <div className="px-4 py-4 space-y-4 bg-white dark:bg-slate-900/40">
            {/* Welcome message */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Welcome Message
              </label>
              <input
                type="text"
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                placeholder="e.g. Welcome to our store!"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>

            {/* About */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                About Your Shop
              </label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Tell customers about your business…"
                rows={4}
                maxLength={1000}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
              />
            </div>

            {/* Contact email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@yourbrand.com"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>

            {/* Social links */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Social Links
              </label>
              {[
                { label: 'Twitter / X', icon: 'open_in_new', value: twitterUrl, set: setTwitterUrl, placeholder: 'https://twitter.com/yourhandle' },
                { label: 'Facebook', icon: 'open_in_new', value: facebookUrl, set: setFacebookUrl, placeholder: 'https://facebook.com/yourpage' },
                { label: 'Instagram', icon: 'open_in_new', value: instagramUrl, set: setInstagramUrl, placeholder: 'https://instagram.com/yourhandle' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium select-none">{label}</span>
                  <input
                    type="url"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-[7.5rem] pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                </div>
              ))}
            </div>

            {/* Shop Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Shop Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 123 Main St, Lagos, Nigeria"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>

            {/* Delivery & 24/7 Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>local_shipping</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Nationwide Delivery</span>
                </div>
                <button
                  onClick={() => setNationwideDelivery(!nationwideDelivery)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${nationwideDelivery ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${nationwideDelivery ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500" style={{ fontSize: 18 }}>schedule</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Open 24/7</span>
                </div>
                <button
                  onClick={() => setIs24Hours(!is24Hours)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${is24Hours ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${is24Hours ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Opening Hours (if not 24/7) */}
            {!is24Hours && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveCustomise}
              disabled={savingCustomise}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: shop.theme_color }}
            >
              {savingCustomise ? 'Saving…' : 'Save Customisations'}
            </button>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Products
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            ({activeProducts.length} active{hiddenProducts.length > 0 ? `, ${hiddenProducts.length} hidden` : ''})
          </span>
        </h3>
        <button
          onClick={() => setShowCreateProduct(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          Add Product
        </button>
      </div>

      {loadingProducts ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 animate-pulse">
              <div className="aspect-square" />
              <div className="p-3 space-y-1.5">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>inventory_2</span>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No products yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Add your first product and start selling in minutes.
          </p>
          <button
            onClick={() => setShowCreateProduct(true)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition"
          >
            Add Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              themeColor={shop.theme_color}
              onDelete={() => handleDeleteProduct(product)}
              onToggleActive={() => handleToggleProductActive(product)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ShopCard (list view card)
// ────────────────────────────────────────────────────────────────────────────────
function ShopCard({
  shop,
  onClick,
  onDuplicate,
  onDelete,
}: {
  shop: Shop;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(shopUrl(shop.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="relative bg-white dark:bg-[#1f162b] border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-4 cursor-pointer hover:shadow-md transition group"
      onClick={onClick}
    >
      {/* Color dot + name */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: shop.theme_color + '20', color: shop.theme_color }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>storefront</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{shop.name}</p>
            {shop.is_live && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">{shop.slug}.{SHOP_BASE}</p>
          <p className="text-xs text-slate-400 mt-1">
            {shop.product_count ?? 0} product{(shop.product_count ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: 16 }}>more_horiz</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-36 bg-white dark:bg-[#2a1f3d] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-20">
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(e); setMenuOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link</span>
                {copied ? 'Copied!' : 'Copy URL'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(); setMenuOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                Duplicate
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main ShopTab
// ────────────────────────────────────────────────────────────────────────────────
export default function ShopTab() {
  const { showNotification } = useNotification();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeShop, setActiveShop] = useState<Shop | null>(null);

  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const list = await shopsApi.list();
      setShops(list);
    } catch {
      showNotification('Failed to load shops', undefined, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { loadShops(); }, [loadShops]);

  const handleShopCreated = (shop: Shop) => {
    setShops((prev) => [shop, ...prev]);
    setShowCreate(false);
    setActiveShop(shop);
    showNotification('Shop created!', undefined, 'success');
  };

  const handleDuplicate = async (shop: Shop) => {
    try {
      const copy = await shopsApi.duplicate(shop.id);
      setShops((prev) => [copy, ...prev]);
      showNotification('Shop duplicated', undefined, 'success');
    } catch {
      showNotification('Failed to duplicate shop', undefined, 'error');
    }
  };

  const handleDelete = async (shop: Shop) => {
    if (!confirm(`Delete "${shop.name}"? This cannot be undone.`)) return;
    try {
      await shopsApi.delete(shop.id);
      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      showNotification('Shop deleted', undefined, 'info');
    } catch {
      showNotification('Failed to delete shop', undefined, 'error');
    }
  };

  const handleShopUpdated = (updated: Shop) => {
    setShops((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    setActiveShop(updated);
  };

  if (activeShop) {
    return (
      <ShopDetail
        shop={activeShop}
        onBack={() => setActiveShop(null)}
        onShopUpdated={handleShopUpdated}
      />
    );
  }

  return (
    <>
      {showCreate && (
        <CreateShopModal
          onClose={() => setShowCreate(false)}
          onCreated={handleShopCreated}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Shop</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create a storefront and start selling in minutes.
          </p>
        </div>
        {shops.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition active:scale-[0.98]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New Shop
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>storefront</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create your first shop</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
            Build a beautiful mobile storefront for your products. Live on your own subdomain in under 3 minutes.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition active:scale-[0.98]"
          >
            Create Shop
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              onClick={() => setActiveShop(shop)}
              onDuplicate={() => handleDuplicate(shop)}
              onDelete={() => handleDelete(shop)}
            />
          ))}
        </div>
      )}
    </>
  );
}
