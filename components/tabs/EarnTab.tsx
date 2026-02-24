'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMerchant } from '@/lib/merchant-context';
import { useMode } from '@/lib/mode-context';
import { useNotification } from '@/lib/notifications';
import {
  earn as earnApi,
  wallet as walletApi,
  EarnMetrics,
  EarnPosition,
  EarnPreviewWithdraw,
  EarnDepositResponse,
  EarnWithdrawResponse,
} from '@/lib/api';

// ─── Internal view states ─────────────────────────────────────────────────────
type EarnView = 'overview' | 'deposit' | 'withdraw-preview' | 'deposit-success' | 'withdraw-success';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtUsd(n: number): string {
  return `$${fmt(n, 2)}`;
}

function fmtPct(n: number): string {
  return `${fmt(n, 2)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subValue,
  icon,
  accent,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: string;
  accent: 'primary' | 'emerald' | 'amber' | 'violet';
}) {
  const accentMap = {
    primary: 'bg-primary/10 dark:bg-primary/20 text-primary',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  };
  const hoverMap = {
    primary: 'hover:border-primary/30',
    emerald: 'hover:border-emerald-200 dark:hover:border-emerald-900',
    amber: 'hover:border-amber-200 dark:hover:border-amber-900',
    violet: 'hover:border-violet-200 dark:hover:border-violet-900',
  };

  return (
    <div
      className={`bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 ${hoverMap[accent]} hover:-translate-y-0.5 transition-all duration-250`}
    >
      <div className="mb-3">
        <div className={`p-1.5 ${accentMap[accent]} rounded-lg inline-block`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</h3>
      {subValue && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

function SectionDivider({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</h4>
      {right}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  subValue,
  highlight,
  deduction,
  bold,
}: {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
  deduction?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 ${bold ? 'font-bold' : ''}`}
    >
      <span className={`text-sm ${deduction ? 'text-rose-500 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
        {label}
      </span>
      <div className="text-right">
        <span
          className={`text-sm font-semibold ${
            highlight
              ? 'text-emerald-600 dark:text-emerald-400'
              : deduction
              ? 'text-rose-500 dark:text-rose-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          {value}
        </span>
        {subValue && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EarnTab() {
  const { merchant } = useMerchant();
  const { mode } = useMode();
  const { showNotification } = useNotification();

  // Data
  const [metrics, setMetrics] = useState<EarnMetrics | null>(null);
  const [position, setPosition] = useState<EarnPosition | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // View state machine
  const [view, setView] = useState<EarnView>('overview');

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositResult, setDepositResult] = useState<EarnDepositResponse | null>(null);

  // Withdraw state
  const [preview, setPreview] = useState<EarnPreviewWithdraw | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<EarnWithdrawResponse | null>(null);

  const isTestMode = mode === 'test';
  const hasWallet = !!merchant?.wallet_address;

  // ─── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setDataError(null);
    try {
      const [metricsData, positionData, walletData] = await Promise.all([
        earnApi.getMetrics(),
        earnApi.getPosition(),
        walletApi.getInfo('live'),
      ]);
      setMetrics(metricsData);
      setPosition(positionData);
      setUsdcBalance(walletData.usdc_balance);
    } catch (err) {
      console.error('EarnTab: Failed to load data', err);
      setDataError('Failed to load Earn data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isTestMode && hasWallet) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isTestMode, hasWallet, loadData]);

  // Reset view when tab is unmounted or re-entered
  useEffect(() => {
    return () => {
      setView('overview');
      setDepositAmount('');
      setPreview(null);
      setDepositResult(null);
      setWithdrawResult(null);
    };
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      showNotification('Invalid Amount', 'Please enter a valid deposit amount.', 'error');
      return;
    }
    if (amount < 5) {
      showNotification('Below Minimum', 'Minimum deposit is $5.00 USDC.', 'error');
      return;
    }
    if (amount > usdcBalance) {
      showNotification('Insufficient Balance', `You only have ${fmt(usdcBalance, 2)} USDC available.`, 'error');
      return;
    }

    setIsDepositing(true);
    try {
      const result = await earnApi.deposit(amount);
      setDepositResult(result);
      setView('deposit-success');
      await loadData();
    } catch (err) {
      showNotification(
        'Deposit Failed',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        'error'
      );
    } finally {
      setIsDepositing(false);
    }
  };

  const openWithdrawPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const data = await earnApi.previewWithdraw();
      setPreview(data);
      setView('withdraw-preview');
    } catch (err) {
      showNotification(
        'Preview Failed',
        err instanceof Error ? err.message : 'Failed to load withdrawal preview.',
        'error'
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      const result = await earnApi.withdraw();
      setWithdrawResult(result);
      setView('withdraw-success');
      await loadData();
    } catch (err) {
      showNotification(
        'Withdrawal Failed',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        'error'
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const backToOverview = () => {
    setView('overview');
    setDepositAmount('');
    setPreview(null);
    setDepositResult(null);
    setWithdrawResult(null);
  };

  // ─── Computed values ─────────────────────────────────────────────────────────

  const depositAmountNum = parseFloat(depositAmount) || 0;
  const projectedYearlyYield =
    depositAmountNum > 0 && metrics
      ? depositAmountNum * (metrics.apy / 100)
      : 0;
  const projectedMonthlyYield = projectedYearlyYield / 12;
  const currentApy = metrics?.apy ?? 0;

  // ─── Render guards ────────────────────────────────────────────────────────────

  if (isTestMode) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
          <span className="material-symbols-outlined text-[40px] text-amber-500 dark:text-amber-400">
            science
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Earn is Live Mode Only</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
          The Earn feature runs on Solana mainnet via Kamino Finance. Switch to{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">Live mode</span> to
          start earning yield on your USDC balance.
        </p>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-2xl">
          <span className="material-symbols-outlined text-[40px] text-primary">
            account_balance_wallet
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Wallet Setup Required</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
          Set up your passkey-secured MPC wallet first, then come back to start earning yield on
          your USDC.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl">
          <span className="material-symbols-outlined text-[40px] text-rose-500">error_outline</span>
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Failed to Load</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
          {dataError}
        </p>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── View: Deposit Success ────────────────────────────────────────────────────

  if (view === 'deposit-success' && depositResult) {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px] text-emerald-600 dark:text-emerald-400">
              check_circle
            </span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Deposit Confirmed</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {fmtUsd(depositResult.amount_deposited)} USDC is now earning yield on Kamino
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-4 text-left space-y-2">
            {depositResult.is_first_deposit && (
              <div className="flex justify-between text-sm pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Activation fee (one-time)</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  -{fmtUsd(depositResult.setup_fee_usdc ?? 1)} USDC
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Deposited to vault</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {fmtUsd(depositResult.amount_deposited)} USDC
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Current APY</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                ~{fmtPct(currentApy)}
              </span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <a
              href={depositResult.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-center flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              View on Explorer
            </a>
            <button
              onClick={backToOverview}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Back to Earn
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── View: Withdraw Success ───────────────────────────────────────────────────

  if (view === 'withdraw-success' && withdrawResult) {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px] text-emerald-600 dark:text-emerald-400">
              check_circle
            </span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Withdrawal Complete</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Funds returned to your wallet
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-4 text-left space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Gross Yield</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                +{fmtUsd(withdrawResult.gross_yield_usd)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">ZendFi Performance Fee</span>
              <span className="font-semibold text-rose-500 dark:text-rose-400">
                -{fmtUsd(withdrawResult.performance_fee_usd)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Total Received</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {fmtUsd(withdrawResult.merchant_received_usd)} USDC
              </span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <a
              href={withdrawResult.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-center flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              View on Explorer
            </a>
            <button
              onClick={backToOverview}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── View: Deposit Form ────────────────────────────────────────────────────────

  if (view === 'deposit') {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        {/* Back header */}
        <div className="flex items-center gap-3">
          <button
            onClick={backToOverview}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Deposit to Earn</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deposit USDC into Kamino vault · Non-custodial
            </p>
          </div>
        </div>

        {/* Deposit form card */}
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-5 space-y-5">
          <form onSubmit={handleDeposit} className="space-y-4">
            {/* Amount input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Amount (USDC)
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <img
                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
                    alt="USDC"
                    className="w-5 h-5 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">USDC</span>
                </div>
                <input
                  type="number"
                  min="5"
                  step="0.01"
                  max={usdcBalance}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-20 pr-16 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setDepositAmount(fmt(usdcBalance, 2))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Available: {fmt(usdcBalance, 2)} USDC
              </p>
            </div>

            {/* Projection */}
            {depositAmountNum > 0 && metrics && (
              <div className="bg-emerald-50 dark:bg-emerald-900/15 rounded-xl p-4 space-y-2.5 border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  Projected Yield
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">APY (7d)</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {fmtPct(metrics.apy_7d)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">Monthly</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      +{fmtUsd(projectedMonthlyYield)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">Yearly</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      +{fmtUsd(projectedYearlyYield)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Activation fee notice — first deposit only */}
            {!position?.has_position && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-xs text-amber-700 dark:text-amber-400">
                <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">info</span>
                <span>
                  <span className="font-semibold">$1.00 one-time activation fee</span> will be
                  deducted from your first deposit.{depositAmountNum >= 5 ? (
                    <> ${fmtUsd(depositAmountNum - 1)} will be deposited into the vault.</>
                  ) : null}
                </span>
              </div>
            )}

            {/* Info strip */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-white/5 text-xs text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">info</span>
              <span>
                Your USDC goes directly to the Kamino vault. Receipt tokens (kUSDC) stay in your
                wallet. ZendFi never holds your funds.
              </span>
            </div>

            <button
              type="submit"
              disabled={isDepositing || !depositAmount || depositAmountNum <= 0}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isDepositing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Depositing…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">savings</span>
                  Deposit {depositAmount ? `${depositAmount} USDC` : 'USDC'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Vault info */}
        {metrics && (
          <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
              KAMINO USDC VAULT
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Current APY</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {fmtPct(currentApy)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Total Value Locked</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {metrics.tvl_usd >= 1_000_000
                    ? `$${(metrics.tvl_usd / 1_000_000).toFixed(1)}M`
                    : fmtUsd(metrics.tvl_usd)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Holders</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {metrics.total_holders.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── View: Withdraw Preview ───────────────────────────────────────────────────

  if (view === 'withdraw-preview' && preview) {
    const feePercent = preview.performance_fee_bps / 100;

    return (
      <div className="space-y-6 max-w-xl mx-auto">
        {/* Back header */}
        <div className="flex items-center gap-3">
          <button
            onClick={backToOverview}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Confirm Withdrawal</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review your breakdown before signing
            </p>
          </div>
        </div>

        {/* Breakdown card */}
        <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">WITHDRAWAL BREAKDOWN</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
            This transaction will execute atomically — all or nothing.
          </p>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <BreakdownRow
              label="Principal (returned in full)"
              value={fmtUsd(preview.principal_usd)}
              subValue="100% returned — fee only on yield"
            />
            <BreakdownRow
              label="Gross Yield Earned"
              value={`+${fmtUsd(preview.gross_yield_usd)}`}
              subValue={`${fmt(preview.gross_yield_token, 4)} USDC`}
              highlight
            />
            <BreakdownRow
              label={`ZendFi Performance Fee (${feePercent}%)`}
              value={`-${fmtUsd(preview.performance_fee_usd)}`}
              subValue={`${fmt(preview.performance_fee_token, 4)} USDC`}
              deduction
            />
            <BreakdownRow
              label="You Receive"
              value={fmtUsd(preview.merchant_receives_usd)}
              subValue="Principal + net yield"
              bold
              highlight
            />
          </div>
        </div>

        {/* Atomic execution note */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 text-xs text-slate-600 dark:text-slate-400">
          <span className="material-symbols-outlined text-[16px] mt-0.5 text-primary shrink-0">
            bolt
          </span>
          <span>
            All 3 instructions execute in a single atomic transaction: (1) Kamino redeems kUSDC →
            USDC, (2) {feePercent}% performance fee → ZendFi, (3) remainder → your wallet. Either
            all succeed or all fail.
          </span>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleWithdraw}
          disabled={isWithdrawing}
          className="w-full py-3.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isWithdrawing ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Confirm &amp; Withdraw {fmtUsd(preview.merchant_receives_usd)}
            </>
          )}
        </button>
      </div>
    );
  }

  // ─── View: Overview (Empty State or Active Position) ─────────────────────────

  const hasActivePosition = position?.has_position && (position?.total_shares ?? 0) > 0;

  return (
    <div className="space-y-6">

      {/* ── Empty State: No position yet ───────────────────────────────────────── */}
      {!hasActivePosition && (
        <>
          {/* Hero banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5 dark:from-primary/10 dark:via-transparent dark:to-emerald-500/10 rounded-2xl border border-primary/10 dark:border-primary/20 p-6 md:p-8">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />

            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Live on Kamino Finance
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  Your balance is earning{' '}
                  <span className="text-slate-400 dark:text-slate-500">0%</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                  Activate Earn to put your idle USDC to work. Funds go directly into Kamino's
                  lending vault — non-custodial, no lock-up, withdraw any time.
                </p>

                {/* APY badge + CTA */}
                <div className="flex items-center gap-3 pt-1">
                  {metrics && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                        ~{fmtPct(currentApy)}
                      </span>
                      <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">APY</span>
                    </div>
                  )}
                  <button
                    onClick={() => setView('deposit')}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">savings</span>
                    Activate Earn
                  </button>
                </div>
              </div>

              {/* Idle balance callout */}
              {usdcBalance > 0 && (
                <div className="md:w-56 bg-white/80 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-slate-200/80 dark:border-white/10 p-4 space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Idle Balance
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {fmtUsd(usdcBalance)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">USDC · Earning 0%</p>
                  {metrics && (
                    <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        At {fmtPct(currentApy)} APY, you could earn
                      </p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        +{fmtUsd(usdcBalance * (currentApy / 100))}/yr
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                step: '01',
                icon: 'savings',
                title: 'Deposit USDC',
                desc: 'Choose how much to deposit. A single Solana transaction moves funds to Kamino.',
                accent: 'bg-primary/10 dark:bg-primary/20 text-primary',
              },
              {
                step: '02',
                icon: 'trending_up',
                title: 'Yield Accrues Automatically',
                desc: 'Kamino lends your USDC to borrowers. Your kUSDC receipt tokens grow in value.',
                accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
              },
              {
                step: '03',
                icon: 'account_balance_wallet',
                title: 'Withdraw Any Time',
                desc: 'Claim yield or withdraw all. A 15% ZendFi performance fee applies to yield only.',
                accent: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white dark:bg-[#1f162b] p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:-translate-y-0.5 transition-all duration-250"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 ${item.accent} rounded-lg shrink-0`}>
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5">
                      STEP {item.step}
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Vault stats footer */}
          {metrics && (
            <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    KAMINO USDC VAULT ·{' '}
                    <span className="font-mono text-[10px]">
                      {metrics.vault_address.slice(0, 8)}…{metrics.vault_address.slice(-6)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">7d APY</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {fmtPct(metrics.apy_7d)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">30d APY</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {fmtPct(metrics.apy_30d)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">TVL</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {metrics.tvl_usd >= 1_000_000
                        ? `$${(metrics.tvl_usd / 1_000_000).toFixed(1)}M`
                        : fmtUsd(metrics.tvl_usd)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Holders</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {metrics.total_holders.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Active Position View ────────────────────────────────────────────────── */}
      {hasActivePosition && position && (
        <>
          {/* Header strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Earn Position</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Earning yield on Kamino Finance · Non-custodial
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('deposit')}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Deposit More
              </button>
              <button
                onClick={openWithdrawPreview}
                disabled={isLoadingPreview}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center gap-1.5"
              >
                {isLoadingPreview ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                )}
                Withdraw All
              </button>
            </div>
          </div>

          {/* Position stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Principal Deposited"
              value={fmtUsd(position.principal_usd)}
              subValue="Your original deposit"
              icon="savings"
              accent="primary"
            />
            <StatCard
              label="Current Value"
              value={fmtUsd(position.current_value_usd)}
              subValue="Principal + accrued yield"
              icon="account_balance"
              accent="violet"
            />
            <StatCard
              label="Yield Earned"
              value={`+${fmtUsd(position.gross_yield_usd)}`}
              subValue={`Net to you: ${fmtUsd(position.net_yield_usd)}`}
              icon="trending_up"
              accent="emerald"
            />
            {metrics && (
              <StatCard
                label="Current APY"
                value={fmtPct(currentApy)}
                subValue={`7d: ${fmtPct(metrics.apy_7d)} · 30d: ${fmtPct(metrics.apy_30d)}`}
                icon="percent"
                accent="amber"
              />
            )}
          </div>

          {/* Yield breakdown card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-5">
              <SectionDivider label="Yield Breakdown" />
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <BreakdownRow
                  label="Gross Yield"
                  value={`+${fmtUsd(position.gross_yield_usd)}`}
                  subValue={`${fmt(position.gross_yield_token, 4)} USDC`}
                  highlight
                />
                <BreakdownRow
                  label={`ZendFi Fee (${position.fee_bps / 100}%)`}
                  value={`-${fmtUsd(position.fee_usd)}`}
                  subValue="On yield only, not principal"
                  deduction
                />
                <BreakdownRow
                  label="Net to You"
                  value={fmtUsd(position.net_yield_usd)}
                  bold
                  highlight
                />
              </div>
            </div>

            {/* Vault info */}
            {metrics && (
              <div className="bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 p-5">
                <SectionDivider
                  label="Vault Info"
                  right={
                    <a
                      href={`https://app.kamino.finance/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View on Kamino
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    </a>
                  }
                />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Protocol</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Kamino Finance</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Asset</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">TVL</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {metrics.tvl_usd >= 1_000_000
                        ? `$${(metrics.tvl_usd / 1_000_000).toFixed(1)}M`
                        : fmtUsd(metrics.tvl_usd)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Your Shares</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {fmt(position.total_shares, 6)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Vault Address</span>
                    <a
                      href={`https://solscan.io/account/${position.vault_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-primary hover:underline"
                    >
                      {position.vault_address.slice(0, 6)}…{position.vault_address.slice(-4)}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refresh data hint */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Position data is fetched live from Kamino on page load.
            </p>
            <button
              onClick={loadData}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
