'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { terminal, TerminalStatus, TerminalCharge, TerminalChargeStatus, TerminalChargeListItem } from '@/lib/api';
import { useMerchant } from '@/lib/merchant-context';

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
  const { merchant } = useMerchant();
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
  const [kioskCopied, setKioskCopied] = useState(false);
  const kioskUrl = typeof window !== 'undefined' && merchant?.id
    ? `${window.location.origin}/terminal/kiosk/${merchant.id}`
    : '';

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
        <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Minimal header ── */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
          Terminal
        </h1>
        {status?.enabled && step === 'input' && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (kioskUrl) {
                  navigator.clipboard.writeText(kioskUrl);
                  setKioskCopied(true);
                  setTimeout(() => setKioskCopied(false), 2000);
                }
              }}
              className="text-xs font-medium text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition uppercase tracking-wider flex items-center gap-1"
              title="Copy kiosk URL for customer-facing display"
            >
              {kioskCopied ? (
                <><span className="material-symbols-outlined text-[13px] text-emerald-500">check</span> Copied</>
              ) : (
                <><span className="material-symbols-outlined text-[13px]">tv</span> Kiosk</>
              )}
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition uppercase tracking-wider"
            >
              {showHistory ? '← Back' : 'History'}
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50/80 dark:bg-red-950/20 rounded-2xl text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500 transition"><span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>
      )}

      {/* ── SETUP STEP ── */}
      {step === 'setup' && (
        <div className="pt-8 pb-4">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-2xl">point_of_sale</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Enable Terminal</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">
              Accept bank transfers in person. Customers transfer Naira — you receive USDC instantly.
            </p>
          </div>

          <div className="max-w-xs mx-auto space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Business Name
              </label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="e.g. Mama's Kitchen"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 transition"
              />
            </div>

            <button
              onClick={handleEnable}
              disabled={isEnabling}
              className="w-full py-3.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium rounded-xl transition disabled:opacity-40"
            >
              {isEnabling ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                  Setting up...
                </span>
              ) : (
                'Enable Terminal'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── INPUT STEP (Numpad) ── */}
      {step === 'input' && !showHistory && (
        <div>
          {/* Today's summary — subtle inline */}
          {status?.today_summary && status.today_summary.transaction_count > 0 && (
            <div className="flex items-baseline justify-between mb-8 px-1">
              <div>
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Today</span>
                <p className="text-lg font-semibold text-slate-900 dark:text-white -mt-0.5">
                  ₦{status.today_summary.total_ngn.toLocaleString()}
                </p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                {status.today_summary.completed_count} of {status.today_summary.transaction_count} · ${status.today_summary.total_usd.toFixed(2)}
              </span>
            </div>
          )}

          {/* Amount hero */}
          <div className="text-center pt-2 pb-8">
            <span className="text-5xl sm:text-6xl font-extralight text-slate-900 dark:text-white tabular-nums tracking-tight">
              <span className="text-slate-300 dark:text-slate-600">₦</span>
              {amount > 0 ? amount.toLocaleString() : '0'}
            </span>
          </div>

          {/* Quick amounts — subtle pills */}
          <div className="flex justify-center gap-1.5 mb-6">
            {(quickAmounts as number[]).map((qa: number) => (
              <button
                key={qa}
                onClick={() => handleCharge(qa)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
              >
                ₦{qa.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Numpad — soft, spacious */}
          <div className="grid grid-cols-3 gap-1.5 mb-5 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map((key) => (
              <button
                key={key}
                onClick={() => handleNumpad(key)}
                className={`h-14 text-lg rounded-2xl transition-all active:scale-[0.92] select-none ${
                  key === 'C'
                    ? 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm'
                    : key === '←'
                    ? 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                }`}
              >
                {key === '←' ? (
                  <span className="material-symbols-outlined text-[20px]">backspace</span>
                ) : key}
              </button>
            ))}
          </div>

          {/* Reference — collapsible feel */}
          <div className="mb-4 max-w-xs mx-auto">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Add a reference..."
              className="w-full px-0 py-2 bg-transparent border-0 border-b border-slate-100 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 transition text-center"
            />
          </div>

          {/* Charge button */}
          <div className="max-w-xs mx-auto">
            <button
              onClick={() => handleCharge()}
              disabled={amount < 100}
              className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-300 dark:disabled:text-slate-600 text-white dark:text-slate-900 font-semibold rounded-2xl transition active:scale-[0.98]"
            >
              {amount < 100 ? 'Enter amount' : `Charge ₦${amount.toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {step === 'input' && showHistory && (
        <div>
          {/* Summary row */}
          {status?.today_summary && (
            <div className="flex items-baseline gap-6 mb-6 px-1">
              <div>
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Revenue</span>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">₦{status.today_summary.total_ngn.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Settled</span>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">${status.today_summary.total_usd.toFixed(2)}</p>
              </div>
              <div className="ml-auto text-right">
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Count</span>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">{status.today_summary.completed_count}<span className="text-slate-300 dark:text-slate-600">/{status.today_summary.transaction_count}</span></p>
              </div>
            </div>
          )}

          {/* Charges list */}
          <div className="space-y-1">
            {charges.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-slate-300 dark:text-slate-600">No transactions today</p>
              </div>
            ) : (
              charges.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 px-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      c.status === 'COMPLETED' ? 'bg-emerald-400' :
                      c.status === 'PENDING' || c.status === 'PROCESSING' ? 'bg-amber-400' :
                      'bg-slate-300 dark:bg-slate-600'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        ₦{c.amount_ngn.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {c.reference || 'Terminal'} · {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {c.status === 'COMPLETED' ? 'Paid' :
                     c.status === 'PENDING' ? 'Pending' :
                     c.status === 'PROCESSING' ? 'Processing' :
                     c.status === 'EXPIRED' ? 'Expired' : c.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── LOADING STEP ── */}
      {step === 'loading' && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-slate-400 rounded-full animate-spin mx-auto mb-5" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Generating bank details</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Usually takes a few seconds</p>
        </div>
      )}

      {/* ── DISPLAY STEP (Customer-facing bank details) ── */}
      {step === 'display' && activeCharge && (
        <div>
          {/* Amount */}
          <div className="text-center pt-2 mb-8">
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium mb-2">Transfer exactly</p>
            <h1 className="text-4xl sm:text-5xl font-semibold text-slate-900 dark:text-white tracking-tight">
              ₦{activeCharge.amount_ngn.toLocaleString()}
            </h1>
          </div>

          {/* Bank details — clean card */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-6 sm:p-8 mb-2">
            {/* Account number — hero */}
            <div className="text-center mb-6">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium tracking-[0.15em] mb-2">Account Number</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl sm:text-4xl font-mono font-semibold tracking-wider text-slate-900 dark:text-white">
                  {activeCharge.bank_account_number}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(activeCharge.bank_account_number)}
                  className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 active:scale-90 transition-all"
                  title="Copy"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
              </div>
            </div>

            {/* Bank & account name */}
            <div className="space-y-3 pt-5 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Bank</span>
                <span className="text-sm text-slate-900 dark:text-white font-medium">{activeCharge.bank_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Account Name</span>
                <span className="text-sm text-slate-900 dark:text-white font-medium">{activeCharge.bank_account_name}</span>
              </div>
            </div>
          </div>

          {/* QR code — customer scans to see bank details on their own phone */}
          <div className="flex flex-col items-center py-6">
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/terminal/display/${activeCharge.charge_id}`}
                size={120}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
            <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-2">Customer scan</p>
          </div>

          {/* Reference */}
          {activeCharge.reference && (
            <p className="text-center text-xs text-slate-300 dark:text-slate-600 mb-2">
              Ref: {activeCharge.reference}
            </p>
          )}

          {/* Waiting indicator — minimal */}
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Listening for transfer · {formatElapsed(elapsed)}
            </span>
          </div>

          {/* Cancel */}
          <button
            onClick={handleNewCharge}
            className="w-full py-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition uppercase tracking-wider"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === 'success' && activeCharge && (
        <div className="pt-8 pb-4 text-center">
          {/* Check mark — subtle */}
          <div className="w-16 h-16 rounded-full border-2 border-emerald-400 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-emerald-500 text-3xl">check</span>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium mb-1">Payment received</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
            ₦{activeCharge.amount_ngn.toLocaleString()}
          </h2>

          {chargeStatus?.confirmed_at && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-8">
              Confirmed in {formatElapsed(elapsed)}
            </p>
          )}

          {/* Receipt — inline */}
          {!receiptSent ? (
            <div className="max-w-xs mx-auto mb-8">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  placeholder="Receipt email (optional)"
                  className="flex-1 px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 transition"
                />
                <button
                  onClick={handleSendReceipt}
                  disabled={!receiptEmail || !receiptEmail.includes('@')}
                  className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:text-slate-300 dark:disabled:text-slate-600 transition"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-8 flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-emerald-500">check</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">Sent to {receiptEmail}</span>
            </div>
          )}

          {/* Next charge */}
          <div className="max-w-xs mx-auto">
            <button
              onClick={handleNewCharge}
              className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-2xl transition active:scale-[0.98]"
            >
              New Charge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
