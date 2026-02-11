'use client';

import { useMerchant } from '@/lib/merchant-context';
import { useCurrency } from '@/lib/currency-context';
import DangerZone from '@/components/DangerZone';

interface ProfileTabProps {
  onSwitchTab: (tab: string) => void;
}

export default function ProfileTab({ onSwitchTab }: ProfileTabProps) {
  const { merchant, isLoading } = useMerchant();
  const { currency, toggleCurrency, exchangeRate, isLoadingRate } = useCurrency();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile & Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your account information and preferences</p>
      </div>

      {/* Account Overview */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Business Name
            </span>
            <p className="text-slate-900 dark:text-white mt-1 font-semibold">{merchant?.name}</p>
          </div>

          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Email Address
            </span>
            <p className="text-slate-900 dark:text-white mt-1 break-all">{merchant?.email}</p>
          </div>

          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Account ID
            </span>
            <p className="text-slate-900 dark:text-white mt-1 font-mono text-sm break-all">{merchant?.id}</p>
          </div>

          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Member Since
            </span>
            <p className="text-slate-900 dark:text-white mt-1">
              {merchant?.created_at
                ? new Date(merchant.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Wallet Information */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Wallet Configuration</h2>

        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Settlement Wallet Address
          </span>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm break-all text-slate-900 dark:text-white mt-3">
            {merchant?.wallet_address}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            All payments are automatically settled to this wallet address.
          </p>
        </div>
      </div>

      {/* Security & Access */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security & Access</h2>

        <div className="space-y-3">
          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">key</span>
                <strong className="text-slate-900 dark:text-white">API Keys</strong>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Manage your API keys for integration
              </p>
            </div>
            <button
              onClick={() => onSwitchTab('api-keys')}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-primary text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              View Keys
            </button>
          </div>

          <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">webhook</span>
                <strong className="text-slate-900 dark:text-white">Webhooks</strong>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Configure real-time event notifications
              </p>
            </div>
            <button
              onClick={() => onSwitchTab('webhooks')}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-primary text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Display Preferences</h2>

        <div className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">currency_exchange</span>
              <strong className="text-slate-900 dark:text-white">Display Currency</strong>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Choose how amounts are displayed across the dashboard
            </p>
            {isLoadingRate ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Loading exchange rate...
              </p>
            ) : exchangeRate ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Current rate: ₦{exchangeRate.toFixed(2)} = $1.00
              </p>
            ) : (
              <p className="text-xs text-rose-500 dark:text-rose-400 mt-2">
                Unable to load exchange rate
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${currency === 'USD' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              USD
            </span>
            <button
              type="button"
              onClick={toggleCurrency}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                currency === 'NGN' ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                  currency === 'NGN' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${currency === 'NGN' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              NGN
            </span>
          </div>
        </div>
      </div>

      {/* Wallet Security */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Wallet Security</h2>
        <DangerZone />
      </div>

      {/* Resources */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resources</h2>

        <div className="grid gap-3">
          <a
            href="https://zendfi.tech/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center no-underline hover:border-primary/30 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                <strong className="text-slate-900 dark:text-white">Documentation</strong>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                API reference, guides, and tutorials
              </p>
            </div>
            <span className="material-symbols-outlined text-[20px] text-primary">open_in_new</span>
          </a>

          <a
            href="https://github.com/zendfi"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white dark:bg-[#1f162b] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center no-underline hover:border-primary/30 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">code</span>
                <strong className="text-slate-900 dark:text-white">GitHub</strong>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Open source code and examples
              </p>
            </div>
            <span className="material-symbols-outlined text-[20px] text-primary">open_in_new</span>
          </a>
        </div>
      </div>
    </div>
  );
}
