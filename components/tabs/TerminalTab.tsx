'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { terminal, TerminalStatus, TerminalCharge, TerminalChargeStatus, TerminalChargeListItem } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TerminalStep = 'setup' | 'input' | 'loading' | 'display' | 'success';

// ─────────────────────────────────────────────────────────────────────────────
// Sound Effect
// ─────────────────────────────────────────────────────────────────────────────

function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // "Ka-ching" sound — two ascending tones
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.setValueAtTime(1200, now + 0.08);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1600, now + 0.1);
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
  } catch {
    // Audio not available
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TerminalTab() {
  const [status, setStatus] = useState<TerminalStatus | null>(null);
  const [step, setStep] = useState<TerminalStep>('input');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [amountStr, setAmountStr] = useState('');
  const [reference, setReference] = useState('');

  // Active charge state
  const [activeCharge, setActiveCharge] = useState<TerminalCharge | null>(null);
  const [chargeStatus, setChargeStatus] = useState<TerminalChargeStatus | null>(null);

  // History
  const [charges, setCharges] = useState<TerminalChargeListItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Receipt
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptSent, setReceiptSent] = useState(false);

  // Setup
  const [setupName, setSetupName] = useState('');
  const [isEnabling, setIsEnabling] = useState(false);

  // Polling ref
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const soundEnabled = status?.settings?.sound_enabled ?? true;

  // ── Load terminal status ──
  const loadStatus = useCallback(async () => {
    try {
      const s = await terminal.getStatus();
      setStatus(s);
      if (!s.enabled) {
        setStep('setup');
      } else {
        setStep('input');
      }
    } catch {
      setStep('setup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadStatus]);

  // ── Load charge history ──
  const loadCharges = useCallback(async () => {
    try {
      const resp = await terminal.listCharges({ period: 'today', limit: 50 });
      setCharges(resp.charges);
      if (status) {
        setStatus({ ...status, today_summary: resp.summary });
      }
    } catch {
      // ignore
    }
  }, [status]);

  useEffect(() => {
    if (status?.enabled) loadCharges();
  }, [status?.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enable terminal ──
  const handleEnable = async () => {
    setIsEnabling(true);
    setError(null);
    try {
      await terminal.enable({ business_name: setupName || undefined });
      await loadStatus();
    } catch (e) {
      setError((e as Error).message || 'Failed to enable terminal');
    } finally {
      setIsEnabling(false);
    }
  };

  // ── Numpad input ──
  const handleNumpad = (key: string) => {
    if (key === 'C') {
      setAmountStr('');
      return;
    }
    if (key === '←') {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }
    // Max 10 digits
    if (amountStr.length >= 10) return;
    // Prevent leading zeros
    if (amountStr === '' && key === '0') return;
    if (amountStr === '' && key === '00') return;
    setAmountStr((prev) => prev + key);
  };

  const amount = parseInt(amountStr || '0', 10);

  // ── Quick amounts ──
  const quickAmounts = status?.settings?.quick_amounts || [500, 1000, 2000, 5000];

  // ── Create charge ──
  const handleCharge = async (chargeAmount?: number) => {
    const finalAmount = chargeAmount || amount;
    if (finalAmount < 100) {
      setError('Minimum charge is ₦100');
      return;
    }

    setStep('loading');
    setError(null);

    try {
      const charge = await terminal.charge({
        amount_ngn: finalAmount,
        reference: reference || undefined,
      });
      setActiveCharge(charge);
      setStep('display');
      setReference('');
      setAmountStr('');
      startPolling(charge.charge_id);
    } catch (e) {
      setError((e as Error).message || 'Failed to create charge');
      setStep('input');
    }
  };

  // ── Poll charge status ──
  const startPolling = (chargeId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const s = await terminal.getChargeStatus(chargeId);
        setChargeStatus(s);

        if (s.status === 'COMPLETED') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (soundEnabled) playSuccessSound();
          // Vibrate on mobile
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          setStep('success');
          loadCharges();
        } else if (s.status === 'EXPIRED' || s.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(s.status === 'EXPIRED' ? 'Charge expired. Customer did not transfer in time.' : 'Charge failed.');
          setStep('input');
        }
      } catch {
        // Keep polling
      }
    }, 3000);
  };

  // ── Send receipt ──
  const handleSendReceipt = async () => {
    if (!activeCharge || !receiptEmail) return;
    try {
      await terminal.sendReceipt(activeCharge.charge_id, receiptEmail);
      setReceiptSent(true);
    } catch {
      setError('Failed to send receipt');
    }
  };

  // ── New charge (reset) ──
  const handleNewCharge = () => {
    setActiveCharge(null);
    setChargeStatus(null);
    setReceiptEmail('');
    setReceiptSent(false);
    setError(null);
    setStep('input');
    loadCharges();
  };

  // ── Time elapsed ──
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (step !== 'display') {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500">point_of_sale</span>
            Terminal
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Accept in-person bank transfer payments
          </p>
        </div>
        {status?.enabled && step === 'input' && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            History
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>
      )}

      {/* ── SETUP STEP ── */}
      {step === 'setup' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-emerald-600 text-3xl">point_of_sale</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Enable Terminal Mode</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Turn your device into a payment terminal. Accept bank transfers in person — customers just transfer Naira, you receive USDC.
          </p>

          <div className="max-w-xs mx-auto mb-6">
            <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Business Name (shown to customers)
            </label>
            <input
              type="text"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="e.g. Mama's Kitchen"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleEnable}
            disabled={isEnabling}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {isEnabling ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Setting up...
              </span>
            ) : (
              'Enable Terminal'
            )}
          </button>
        </div>
      )}

      {/* ── INPUT STEP (Numpad) ── */}
      {step === 'input' && !showHistory && (
        <div className="space-y-4">
          {/* Today's summary bar */}
          {status?.today_summary && status.today_summary.transaction_count > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Today&apos;s Sales</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  ₦{status.today_summary.total_ngn.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {status.today_summary.completed_count}/{status.today_summary.transaction_count} completed
                </p>
                <p className="text-xs text-emerald-500 dark:text-emerald-500">
                  ≈ ${status.today_summary.total_usd.toFixed(2)} USDC
                </p>
              </div>
            </div>
          )}

          {/* Amount display */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="text-center mb-2">
              <span className="text-sm font-medium text-slate-400 uppercase tracking-widest">Charge Amount</span>
            </div>
            <div className="text-center mb-6">
            <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tabular-nums">
                ₦{amount > 0 ? amount.toLocaleString() : '0'}
              </span>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {(quickAmounts as number[]).map((qa: number) => (
                <button
                  key={qa}
                  onClick={() => handleCharge(qa)}
                  className="flex-shrink-0 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold rounded-xl transition text-sm"
                >
                  ₦{qa.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '00'].map((key) => (
                <button
                  key={key}
                  onClick={() => handleNumpad(key)}
                  className={`py-4 text-xl font-bold rounded-xl transition active:scale-95 ${
                    key === 'C'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Optional reference */}
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Reference (optional, e.g. Table 5)"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
            />

            {/* Charge button */}
            <button
              onClick={() => handleCharge()}
              disabled={amount < 100}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold text-lg rounded-2xl transition active:scale-[0.98]"
            >
              {amount < 100 ? 'Enter amount ₦100+' : `Charge ₦${amount.toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {step === 'input' && showHistory && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Today&apos;s Transactions</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ← Back to Terminal
            </button>
          </div>

          {/* Summary card */}
          {status?.today_summary && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Total Sales</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">₦{status.today_summary.total_ngn.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">USDC Settled</p>
                <p className="text-2xl font-bold text-emerald-600">${status.today_summary.total_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Transactions</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{status.today_summary.transaction_count}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Completed</p>
                <p className="text-lg font-bold text-emerald-600">{status.today_summary.completed_count}</p>
              </div>
            </div>
          )}

          {/* Charges list */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {charges.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 block">receipt_long</span>
                No transactions today
              </div>
            ) : (
              charges.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      ₦{c.amount_ngn.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {c.reference || c.bank_name || 'Terminal charge'} · {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    c.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    c.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── LOADING STEP ── */}
      {step === 'loading' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Generating bank details...</p>
          <p className="text-sm text-slate-400">This usually takes a couple of seconds</p>
        </div>
      )}

      {/* ── DISPLAY STEP (Customer-facing bank details) ── */}
      {step === 'display' && activeCharge && (
        <div className="space-y-4">
          {/* The big display */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50 shadow-lg p-5 sm:p-8">
            <div className="text-center mb-2">
              <span className="text-sm font-medium text-slate-400 uppercase tracking-[0.2em]">
                Pay via Bank Transfer
              </span>
            </div>

            {/* Big amount */}
            <h1 className="text-4xl sm:text-5xl font-black text-emerald-600 text-center mb-6 sm:mb-8">
              ₦{activeCharge.amount_ngn.toLocaleString()}
            </h1>

            {/* Bank details card */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              {/* Account number (most important) */}
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-bold mb-1 tracking-wider">Account Number</p>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-4xl font-mono font-bold tracking-tight text-slate-900 dark:text-white">
                    {activeCharge.bank_account_number}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(activeCharge.bank_account_number)}
                    className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm active:scale-95 transition-transform border border-slate-200 dark:border-slate-600"
                    title="Copy"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-500">content_copy</span>
                  </button>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-600" />

              {/* Account name */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm font-medium">Account Name</span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">{activeCharge.bank_account_name}</span>
              </div>

              {/* Bank name */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm font-medium">Bank</span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">{activeCharge.bank_name}</span>
              </div>
            </div>

            {/* Live status indicator */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Waiting for transfer... ({formatElapsed(elapsed)})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Transfer the exact amount shown above. Payment auto-confirms in 10-30 seconds.
              </p>
            </div>

            {/* Reference if any */}
            {activeCharge.reference && (
              <div className="mt-4 text-center">
                <span className="text-xs text-slate-400">Ref: {activeCharge.reference}</span>
              </div>
            )}
          </div>

          {/* Cancel / back */}
          <button
            onClick={handleNewCharge}
            className="w-full py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium transition"
          >
            Cancel & start new charge
          </button>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === 'success' && activeCharge && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-emerald-800 shadow-lg p-5 sm:p-8 text-center">
          {/* Success animation */}
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-[scale-in_0.3s_ease-out]">
            <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">Payment Confirmed!</h2>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mb-6">
            ₦{activeCharge.amount_ngn.toLocaleString()}
          </p>

          {chargeStatus?.confirmed_at && (
            <p className="text-sm text-slate-400 mb-6">
              Completed in {formatElapsed(elapsed)}
            </p>
          )}

          {/* Receipt prompt */}
          {!receiptSent ? (
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
                How would you like the receipt?
              </p>
              <div className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleSendReceipt}
                  disabled={!receiptEmail || !receiptEmail.includes('@')}
                  className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-semibold rounded-xl transition text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-center gap-2 text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">check</span>
              <span className="text-sm font-medium">Receipt sent to {receiptEmail}</span>
            </div>
          )}

          {/* New charge button */}
          <button
            onClick={handleNewCharge}
            className="w-full max-w-sm py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg rounded-2xl transition active:scale-[0.98]"
          >
            New Charge
          </button>
        </div>
      )}
    </div>
  );
}
