'use client';

import { useEffect, useState } from 'react';
import { refunds as refundsApi, Refund } from '@/lib/api';

function getFailureReason(refund: Refund): string | null {
  const errorValue = refund.metadata?.error;
  if (typeof errorValue === 'string' && errorValue.trim().length > 0) {
    return errorValue;
  }
  if (refund.status === 'failed') {
    return 'Refund failed. Review payment wallet and settlement balance.';
  }
  return null;
}

export default function RefundsTab() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountCurrency, setAmountCurrency] = useState<'usd' | 'ngn'>('usd');
  const [refundDestination, setRefundDestination] = useState<'wallet' | 'bank_account'>('wallet');
  const [bankId, setBankId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await refundsApi.list({ status: status !== 'all' ? status : undefined, limit: 50, offset: 0 });
      setRefunds(data.refunds || []);
    } catch (error) {
      console.error('Failed to load refunds', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const submitRefund = async () => {
    setFormMessage(null);
    setFormError(null);

    const trimmedPaymentId = paymentId.trim();
    if (!trimmedPaymentId) {
      setFormError('Payment ID is required.');
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Enter a valid amount greater than 0.');
      return;
    }

    if (amountCurrency === 'ngn' && refundDestination === 'bank_account') {
      if (!bankId.trim()) {
        setFormError('Bank ID is required for NGN bank refunds.');
        return;
      }
      if (!bankAccountNumber.trim()) {
        setFormError('Bank account number is required for NGN bank refunds.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await refundsApi.createForPayment(trimmedPaymentId, {
        amount_usd: amountCurrency === 'usd' ? numericAmount : undefined,
        amount_ngn: amountCurrency === 'ngn' ? numericAmount : undefined,
        refund_destination: amountCurrency === 'ngn' ? refundDestination : 'wallet',
        bank_id: amountCurrency === 'ngn' && refundDestination === 'bank_account' ? bankId.trim() : undefined,
        bank_account_number:
          amountCurrency === 'ngn' && refundDestination === 'bank_account'
            ? bankAccountNumber.trim()
            : undefined,
        bank_account_name:
          amountCurrency === 'ngn' && refundDestination === 'bank_account' && bankAccountName.trim().length > 0
            ? bankAccountName.trim()
            : undefined,
        refund_reason: reason.trim() || undefined,
      });
      setFormMessage('Refund request submitted successfully.');
      setAmount('');
      setReason('');
      setBankId('');
      setBankAccountNumber('');
      setBankAccountName('');
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create refund');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Create Refund</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            placeholder="Payment ID"
            className="md:col-span-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            step="0.000001"
            placeholder={amountCurrency === 'usd' ? 'Amount (USD)' : 'Amount (NGN)'}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
          />
          <select
            value={amountCurrency}
            onChange={(e) => {
              const next = e.target.value as 'usd' | 'ngn';
              setAmountCurrency(next);
              if (next === 'usd') {
                setRefundDestination('wallet');
              }
            }}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
          >
            <option value="usd">USD</option>
            <option value="ngn">NGN</option>
          </select>
        </div>
        {amountCurrency === 'ngn' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={refundDestination}
              onChange={(e) => setRefundDestination(e.target.value as 'wallet' | 'bank_account')}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
            >
              <option value="wallet">Refund to customer wallet</option>
              <option value="bank_account">Refund to customer bank account (NGN)</option>
            </select>
            {refundDestination === 'bank_account' && (
              <input
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                placeholder="PAJ Bank ID"
                className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
              />
            )}
            {refundDestination === 'bank_account' && (
              <input
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="Bank account number"
                className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
              />
            )}
            {refundDestination === 'bank_account' && (
              <input
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="Bank account name (optional)"
                className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
              />
            )}
            {refundDestination === 'bank_account' && (
              <p className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400">
                OTP/session is handled by backend using proxy-email flow, similar to split bank payouts.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
          />
          <button
            onClick={submitRefund}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Refund'}
          </button>
        </div>
        {formMessage && <p className="text-xs text-emerald-600 dark:text-emerald-400">{formMessage}</p>}
        {formError && <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Refunds</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track pending and completed voluntary refunds.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-[#10101b] text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-4 py-3">Refund ID</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">NGN Context</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Failure Reason</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>Loading refunds...</td></tr>
            ) : refunds.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No refunds found.</td></tr>
            ) : (
              refunds.map((refund) => (
                <tr key={refund.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{refund.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-mono text-xs">{refund.payment_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3">${refund.amount_usd.toFixed(2)}</td>
                  <td className="px-4 py-3">{typeof refund.amount_ngn === 'number' ? `₦${refund.amount_ngn.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 capitalize">{refund.status}</td>
                  <td className="px-4 py-3 text-xs max-w-[280px]">
                    {getFailureReason(refund) ? (
                      <span className="text-rose-600 dark:text-rose-400 break-words">{getFailureReason(refund)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{new Date(refund.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
