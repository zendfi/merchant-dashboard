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
    <div className="group relative bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl overflow-hidden transition hover:shadow-md">
      {/* Product Image */}
      <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.media_urls[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600" style={{ fontSize: 40 }}>image</span>
          </div>
        )}
        {/* Top-right actions */}
        <div className="absolute top-2 right-2">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-7 h-7 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:bg-white dark:hover:bg-slate-900 transition"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-300" style={{ fontSize: 16 }}>more_horiz</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 w-36 bg-white dark:bg-[#2a1f3d] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-20">
                <button
                  onClick={() => { onToggleActive(); setMenuOpen(false); }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {product.is_active ? 'visibility_off' : 'visibility'}
                  </span>
                  {product.is_active ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => { handleDelete(); setMenuOpen(false); }}
                  disabled={deleting}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Inactive badge */}
        {!product.is_active && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-black/40 px-2 py-1 rounded-lg">Hidden</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{product.name}</p>
        <p className="text-xs font-bold mt-0.5" style={{ color: themeColor }}>
          {formatPrice(product.price_usd, product.token)}
        </p>
        {product.quantity_type === 'limited' && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {(product.quantity_available ?? 0) - product.quantity_sold} left
          </p>
        )}
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
            shop.is_live
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
      <div className="flex items-center gap-2 mb-6 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-700/50">
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
