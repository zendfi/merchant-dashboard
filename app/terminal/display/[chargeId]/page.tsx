'use client';

import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types (public endpoint response shape)
// ─────────────────────────────────────────────────────────────────────────────

interface PublicChargeStatus {
  charge_id: string;
  status: string;
  amount_ngn: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  merchant_name: string;
  reference: string | null;
  created_at: string;
  confirmed_at: string | null;
  expires_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Display Page — shown to customers (no auth)
// ─────────────────────────────────────────────────────────────────────────────

export default function TerminalDisplayPage({ params }: { params: { chargeId: string } }) {
  const chargeId = params.chargeId;
  const [data, setData] = useState<PublicChargeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch charge status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/v1/terminal/charges/${chargeId}/status`);
        if (!res.ok) {
          setError('Charge not found');
          return;
        }
        const json = await res.json();
        setData(json);

        if (json.status === 'COMPLETED' || json.status === 'EXPIRED' || json.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        setError('Failed to load payment details');
      }
    };

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chargeId]);

  // Timer
  useEffect(() => {
    if (!data || data.status === 'COMPLETED' || data.status === 'EXPIRED' || data.status === 'FAILED') return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.bank_account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-700">{error}</p>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── COMPLETED state ──
  if (data.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Payment Confirmed</h1>
          <p className="text-4xl font-black text-emerald-600 mb-4">₦{data.amount_ngn.toLocaleString()}</p>
          <p className="text-slate-500 text-sm">Paid to {data.merchant_name}</p>
          {data.reference && <p className="text-slate-400 text-xs mt-1">Ref: {data.reference}</p>}
        </div>
      </div>
    );
  }

  // ── EXPIRED / FAILED state ──
  if (data.status === 'EXPIRED' || data.status === 'FAILED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-700 mb-2">
            {data.status === 'EXPIRED' ? 'Payment Expired' : 'Payment Failed'}
          </h1>
          <p className="text-slate-400">Please ask the merchant for a new charge.</p>
        </div>
      </div>
    );
  }

  // ── PENDING / PROCESSING — show bank details ──
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Merchant name */}
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Pay</p>
          <p className="text-lg font-bold text-slate-700">{data.merchant_name}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {/* Amount */}
          <h1 className="text-5xl font-black text-emerald-600 text-center mb-8">
            ₦{data.amount_ngn.toLocaleString()}
          </h1>

          {/* Bank details */}
          <div className="bg-slate-50 rounded-2xl p-6 space-y-5">
            {/* Account number — the most important piece */}
            <div className="text-center">
              <p className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1.5">Account Number</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-mono font-bold tracking-tight text-slate-900">
                  {data.bank_account_number}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 active:scale-95 transition-transform"
                >
                  <svg className={`w-5 h-5 ${copied ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {copied ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    )}
                  </svg>
                </button>
              </div>
              {copied && <p className="text-xs text-emerald-500 mt-1">Copied!</p>}
            </div>

            <div className="border-t border-slate-200" />

            {/* Account name */}
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Account Name</span>
              <span className="text-slate-900 font-bold text-sm">{data.bank_account_name}</span>
            </div>

            {/* Bank name */}
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Bank</span>
              <span className="text-slate-900 font-bold text-sm">{data.bank_name}</span>
            </div>
          </div>

          {/* Waiting indicator */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-600 font-medium text-sm">
                Waiting for transfer... {formatElapsed(elapsed)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Transfer the exact ₦{data.amount_ngn.toLocaleString()} amount above.<br />
              Payment confirms automatically in 10-30 seconds.
            </p>
          </div>
        </div>

        {/* Branding */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-300">Powered by <span className="font-semibold text-slate-400">ZendFi</span></p>
        </div>
      </div>
    </div>
  );
}
