'use client';

import { useCallback, useEffect, useState } from 'react';
import { merchant as merchantApi, MerchantSettings, BridgeKycStatus } from '@/lib/api';
import { useMerchant } from '@/lib/merchant-context';
import { useCurrency } from '@/lib/currency-context';
import { useDeveloperOptions } from '@/lib/developer-options-context';
import { useNotification } from '@/lib/notifications';
import DangerZone from '@/components/DangerZone';

interface ProfileTabProps {
  onSwitchTab: (tab: string) => void;
  onModalToggle?: (open: boolean) => void;
}

export default function ProfileTab({ onSwitchTab, onModalToggle }: ProfileTabProps) {
  const { merchant, isLoading, refreshMerchant } = useMerchant();
  const { showNotification } = useNotification();
  const { currency, toggleCurrency, exchangeRate, isLoadingRate } = useCurrency();
  const {
    showDeveloperOptions,
    showTerminalTab,
    toggleDeveloperOptions,
    toggleTerminalTabVisibility,
  } = useDeveloperOptions();

  const [settings, setSettings] = useState<MerchantSettings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [savingField, setSavingField] = useState<'name' | 'email' | 'address' | 'wallet' | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [merchantUserName, setMerchantUserName] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState<null | { candidate: string; available: boolean }>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [bridgeKyc, setBridgeKyc] = useState<BridgeKycStatus | null>(null);
  const [isBridgeLoading, setIsBridgeLoading] = useState(false);
  const [isStartingBridgeKyc, setIsStartingBridgeKyc] = useState(false);
  const [settlementWalletAddress, setSettlementWalletAddress] = useState('');
  const [walletRiskAcknowledged, setWalletRiskAcknowledged] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!merchant) return;

    setIsSettingsLoading(true);
    try {
      const data = await merchantApi.getSettings();
      setSettings(data);
      setBusinessName(data.name || merchant.name || '');
      setBusinessEmail(data.email || merchant.email || '');
      setBusinessAddress(data.business_address || '');
      setMerchantUserName(data.merchant_user_name || merchant.merchant_user_name || '');
      setSettlementWalletAddress(data.wallet_address || merchant.wallet_address || '');
    } catch (error) {
      showNotification(
        'Failed to Load Profile Settings',
        error instanceof Error ? error.message : 'Could not load merchant settings',
        'error'
      );
    } finally {
      setIsSettingsLoading(false);
    }
  }, [merchant, showNotification]);

  useEffect(() => {
    if (!merchant) return;
    setBusinessName(merchant.name || '');
    setBusinessEmail(merchant.email || '');
    setMerchantUserName(merchant.merchant_user_name || '');
    setSettlementWalletAddress(merchant.wallet_address || '');
  }, [merchant]);

  useEffect(() => {
    if (!merchant?.id) return;
    void loadSettings();
  }, [merchant?.id, loadSettings]);

  const loadBridgeKyc = useCallback(async () => {
    if (!merchant) return;
    setIsBridgeLoading(true);
    try {
      const data = await merchantApi.getBridgeKycStatus();
      setBridgeKyc(data.kyc);
    } catch (error) {
      showNotification(
        'Failed to Load Bridge KYC',
        error instanceof Error ? error.message : 'Could not load Bridge KYC status',
        'error'
      );
    } finally {
      setIsBridgeLoading(false);
    }
  }, [merchant, showNotification]);

  useEffect(() => {
    if (!merchant?.id) return;
    void loadBridgeKyc();
  }, [merchant?.id, loadBridgeKyc]);

  const refreshProfileData = async () => {
    await refreshMerchant();
    await loadSettings();
    await loadBridgeKyc();
  };

  const handleCheckUsernameAvailability = async () => {
    const candidate = merchantUserName.trim().toLowerCase();
    if (!candidate) {
      setUsernameAvailability(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const result = await merchantApi.getUsernameAvailability(candidate);
      setUsernameAvailability(result);
    } catch (error) {
      showNotification(
        'Username Check Failed',
        error instanceof Error ? error.message : 'Could not verify username availability',
        'error'
      );
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleSaveUsername = async () => {
    const candidate = merchantUserName.trim().toLowerCase();
    if (!candidate) {
      showNotification('Invalid Username', 'Username is required', 'error');
      return;
    }

    setIsSavingUsername(true);
    try {
      const result = await merchantApi.updateUsername(candidate);
      showNotification(
        'Username Updated',
        `Public link updated to ${result.public_link_url}`,
        'success'
      );
      await refreshProfileData();
    } catch (error) {
      showNotification(
        'Failed to Update Username',
        error instanceof Error ? error.message : 'Could not update username',
        'error'
      );
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleStartOrResumeBridgeKyc = async (skipForNow: boolean) => {
    setIsStartingBridgeKyc(true);
    try {
      const data = await merchantApi.startBridgeKyc({ skip_for_now: skipForNow });
      setBridgeKyc(data.kyc);

      if (skipForNow) {
        showNotification(
          'KYC Deferred',
          'Bridge features remain blocked until KYC is approved.',
          'warning'
        );
        return;
      }

      if (data.kyc.latest_kyc_link) {
        window.open(data.kyc.latest_kyc_link, '_blank', 'noopener,noreferrer');
      }

      showNotification('Bridge KYC Started', 'Complete KYC in the opened Bridge page.', 'success');
    } catch (error) {
      showNotification(
        'Bridge KYC Failed',
        error instanceof Error ? error.message : 'Could not start Bridge KYC',
        'error'
      );
    } finally {
      setIsStartingBridgeKyc(false);
    }
  };

  const handleUpdateName = async () => {
    const trimmedName = businessName.trim();
    if (!trimmedName) {
      showNotification('Invalid Name', 'Business name is required', 'error');
      return;
    }

    setSavingField('name');
    try {
      const result = await merchantApi.updateName(trimmedName);
      showNotification('Business Name Updated', result.message, 'success');
      await refreshProfileData();
    } catch (error) {
      showNotification(
        'Failed to Update Name',
        error instanceof Error ? error.message : 'Could not update business name',
        'error'
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdateEmail = async () => {
    const trimmedEmail = businessEmail.trim();
    if (!trimmedEmail) {
      showNotification('Invalid Email', 'Email is required', 'error');
      return;
    }

    setSavingField('email');
    try {
      const result = await merchantApi.updateEmail(trimmedEmail);
      showNotification('Email Updated', result.message, 'success');
      await refreshProfileData();
    } catch (error) {
      showNotification(
        'Failed to Update Email',
        error instanceof Error ? error.message : 'Could not update email',
        'error'
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdateAddress = async () => {
    const trimmedAddress = businessAddress.trim();
    if (!trimmedAddress) {
      showNotification('Invalid Address', 'Business address is required', 'error');
      return;
    }

    setSavingField('address');
    try {
      const result = await merchantApi.updateAddress(trimmedAddress);
      showNotification('Business Address Updated', result.message, 'success');
      await refreshProfileData();
    } catch (error) {
      showNotification(
        'Failed to Update Address',
        error instanceof Error ? error.message : 'Could not update business address',
        'error'
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdateSettlementWallet = async () => {
    const trimmedWallet = settlementWalletAddress.trim();
    if (!trimmedWallet) {
      showNotification('Invalid Wallet Address', 'Settlement wallet address is required', 'error');
      return;
    }

    if (!walletRiskAcknowledged) {
      showNotification(
        'Acknowledgement Required',
        'Please acknowledge the risk warning before updating settlement wallet preference.',
        'warning'
      );
      return;
    }

    setSavingField('wallet');
    try {
      const result = await merchantApi.updateSettlementWalletPreference({
        wallet_address: trimmedWallet,
        wallet_preference: 'external',
        acknowledge_wallet_change_risk: true,
      });

      showNotification('Settlement Wallet Updated', result.message, 'success');
      showNotification('Strict Warning', result.warning, 'warning');
      setWalletRiskAcknowledged(false);
      await refreshProfileData();
    } catch (error) {
      showNotification(
        'Failed to Update Settlement Wallet',
        error instanceof Error ? error.message : 'Could not update settlement wallet preference',
        'error'
      );
    } finally {
      setSavingField(null);
    }
  };

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
          <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Business Name
            </span>
            <p className="text-slate-900 dark:text-white mt-1 font-semibold">{merchant?.name}</p>
          </div>

          <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Email Address
            </span>
            <p className="text-slate-900 dark:text-white mt-1 break-all">{merchant?.email}</p>
          </div>

          <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Business Address
            </span>
            <p className="text-slate-900 dark:text-white mt-1 break-words">
              {settings?.business_address || 'Not set'}
            </p>
          </div>

          <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Public Link
            </span>
            <p className="text-slate-900 dark:text-white mt-1 break-all font-mono text-sm">
              {settings?.public_link_url || merchant?.public_link_url || 'Not set'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-xs break-all">
              Request template: {settings?.request_link_template || 'Not available'}
            </p>
          </div>

          <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Account ID
            </span>
            <p className="text-slate-900 dark:text-white mt-1 font-mono text-sm break-all">{merchant?.id}</p>
          </div>

          <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
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

      {/* Username & Public Link */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Public Username</h2>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">Username (zdfi.me/username)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={merchantUserName}
              onChange={(e) => setMerchantUserName(e.target.value)}
              className="w-full p-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="your-brand-name"
            />
            <button
              type="button"
              onClick={handleCheckUsernameAvailability}
              disabled={isCheckingUsername}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {isCheckingUsername ? 'Checking...' : 'Check'}
            </button>
            <button
              type="button"
              onClick={handleSaveUsername}
              disabled={isSavingUsername}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {isSavingUsername ? 'Saving...' : 'Save Username'}
            </button>
          </div>
          {usernameAvailability && (
            <p className={`text-xs ${usernameAvailability.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {usernameAvailability.available
                ? `${usernameAvailability.candidate} is available`
                : `${usernameAvailability.candidate} is already taken`}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your public links: {settings?.public_link_url || merchant?.public_link_url || 'not set'}
          </p>
        </div>
      </div>

      {/* Bridge KYC */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bridge KYC</h2>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
          {isBridgeLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading Bridge KYC status...</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${bridgeKyc?.is_approved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {bridgeKyc?.is_approved ? 'Approved' : 'Pending / Required'}
                </span>
                {bridgeKyc?.bridge_features_blocked && (
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                    Bridge features blocked
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
                Bridge customer ID: {bridgeKyc?.bridge_customer_id || 'Not created yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                KYC status: {bridgeKyc?.kyc_status || 'unknown'} | TOS status: {bridgeKyc?.tos_status || 'unknown'}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartOrResumeBridgeKyc(false)}
                  disabled={isStartingBridgeKyc}
                  className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {isStartingBridgeKyc ? 'Starting...' : 'Start / Resume KYC'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartOrResumeBridgeKyc(true)}
                  disabled={isStartingBridgeKyc}
                  className="px-4 py-2.5 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-xl text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                >
                  Skip for now
                </button>
                {bridgeKyc?.latest_kyc_link && (
                  <a
                    href={bridgeKyc.latest_kyc_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Open Latest KYC Link
                  </a>
                )}
              </div>

              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                You can skip KYC during onboarding, but any Bridge-related flow remains blocked until approval.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Editable Merchant Settings */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Merchant Details</h2>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-5">
          {isSettingsLoading && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Refreshing latest merchant settings...</p>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">Business Name</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={100}
                className="w-full p-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Enter business name"
              />
              <button
                type="button"
                onClick={handleUpdateName}
                disabled={savingField === 'name'}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingField === 'name' ? 'Saving...' : 'Save Name'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">Email Address</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="w-full p-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Enter email address"
              />
              <button
                type="button"
                onClick={handleUpdateEmail}
                disabled={savingField === 'email'}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingField === 'email' ? 'Saving...' : 'Save Email'}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Email updates run deliverability and domain checks before saving.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">Business Address</label>
            <textarea
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full p-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-y"
              placeholder="Enter business address"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{businessAddress.length}/500 characters</p>
              <button
                type="button"
                onClick={handleUpdateAddress}
                disabled={savingField === 'address'}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingField === 'address' ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Information */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Wallet Configuration</h2>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Current Settlement Wallet
          </span>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-sm break-all text-slate-900 dark:text-white mt-3">
            {settings?.wallet_address || merchant?.wallet_address}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Wallet type: <strong>{settings?.wallet_type || merchant?.wallet_type || 'unknown'}</strong>
          </p>

          <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              Update Settlement Wallet Preference (External Wallet)
            </label>

            <input
              type="text"
              value={settlementWalletAddress}
              onChange={(e) => setSettlementWalletAddress(e.target.value)}
              className="w-full p-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono"
              placeholder="Enter external Solana wallet address"
            />

            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">
              <p className="font-semibold">Strict warning</p>
              <p className="mt-1">
                Changing settlement wallet to an external wallet disables private key export and revokes active MPC wallet capabilities.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={walletRiskAcknowledged}
                onChange={(e) => setWalletRiskAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 cursor-pointer accent-rose-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                I understand this change disables private key export and deactivates MPC settlement usage.
              </span>
            </label>

            <button
              type="button"
              onClick={handleUpdateSettlementWallet}
              disabled={savingField === 'wallet'}
              className="px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingField === 'wallet' ? 'Updating...' : 'Update Settlement Wallet'}
            </button>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Private key export currently: {settings?.private_key_export_enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </div>

      {/* Security & Access */}
      {showDeveloperOptions && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security & Access</h2>

          <div className="space-y-3">
            <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
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

            <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
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
      )}

      {/* Display Preferences */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Display Preferences</h2>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
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
              className={`relative w-11 h-6 rounded-full transition-colors ${currency === 'NGN' ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${currency === 'NGN' ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
            <span className={`text-sm font-medium ${currency === 'NGN' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              NGN
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">terminal</span>
              <strong className="text-slate-900 dark:text-white">Developer Options</strong>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Enable advanced features like API Keys and Webhooks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDeveloperOptions}
              className={`relative w-11 h-6 rounded-full transition-colors ${showDeveloperOptions ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${showDeveloperOptions ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">point_of_sale</span>
              <strong className="text-slate-900 dark:text-white">Terminal Tab</strong>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Show or hide Terminal in dashboard navigation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTerminalTabVisibility}
              className={`relative w-11 h-6 rounded-full transition-colors ${showTerminalTab ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${showTerminalTab ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Security */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Wallet Security</h2>
        <DangerZone onModalToggle={onModalToggle} />
      </div>

      {/* Resources */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resources</h2>

        <div className="grid gap-3">
          <a
            href="https://zendfi.tech/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center no-underline hover:border-primary/30 transition-colors"
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
            className="bg-white dark:bg-[#13131f] p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center no-underline hover:border-primary/30 transition-colors"
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
