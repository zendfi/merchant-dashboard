'use client';

import { useEffect, useState } from 'react';
import { disputes as disputesApi, Dispute, refunds as refundsApi, RefundLimits } from '@/lib/api';

export default function DisputesTab() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [activeDispute, setActiveDispute] = useState<Dispute | null>(null);
  const [responseText, setResponseText] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundCurrency, setRefundCurrency] = useState<'usd' | 'ngn'>('usd');
  const [refundDestination, setRefundDestination] = useState<'wallet' | 'bank_account'>('wallet');
  const [bankId, setBankId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refundLimits, setRefundLimits] = useState<RefundLimits | null>(null);
  const [refundLimitsError, setRefundLimitsError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await disputesApi.list({ status: status !== 'all' ? status : undefined, limit: 50, offset: 0 });
      setDisputes(data.disputes || []);
    } catch (error) {
      console.error('Failed to load disputes', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    if (!activeDispute) {
      setRefundLimits(null);
      setRefundLimitsError(null);
      return;
    }

    setRefundLimits(null);
    setRefundLimitsError(null);

    refundsApi
      .getLimitsForPayment(activeDispute.payment_id)
      .then((limits) => setRefundLimits(limits))
      .catch((error) =>
        setRefundLimitsError(error instanceof Error ? error.message : 'Failed to load refundable limit')
      );
  }, [activeDispute]);

  const submitResponse = async () => {
    if (!activeDispute) return;

    setActionMessage(null);
    setActionError(null);
    if (!responseText.trim()) {
      setActionError('Response is required.');
      return;
    }

    setIsSubmittingResponse(true);
    try {
      const updated = await disputesApi.respond(activeDispute.id, {
        response: responseText.trim(),
      });
      setActionMessage('Dispute response submitted.');
      setResponseText('');
      setActiveDispute(updated);
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to submit dispute response');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const issueRefund = async () => {
    if (!activeDispute) return;

    setActionMessage(null);
    setActionError(null);

    const isAmountlessNgnBankRefund = refundCurrency === 'ngn' && refundDestination === 'bank_account';
    const amountNum = Number(refundAmount);
    if (!isAmountlessNgnBankRefund && (!Number.isFinite(amountNum) || amountNum <= 0)) {
      setActionError('Enter a valid refund amount greater than 0.');
      return;
    }

    if (refundCurrency === 'ngn' && refundDestination === 'bank_account') {
      if (!bankId.trim()) {
        setActionError('Bank ID is required for NGN bank refunds.');
        return;
      }
      if (!bankAccountNumber.trim()) {
        setActionError('Bank account number is required for NGN bank refunds.');
        return;
      }
    }

    setIsSubmittingRefund(true);
    try {
      const result = await disputesApi.issueRefund(activeDispute.id, {
        amount_usd: refundCurrency === 'usd' ? amountNum : undefined,
        amount_ngn: refundCurrency === 'ngn' && refundDestination !== 'bank_account' ? amountNum : undefined,
        refund_destination: refundCurrency === 'ngn' ? refundDestination : 'wallet',
        bank_id: refundCurrency === 'ngn' && refundDestination === 'bank_account' ? bankId.trim() : undefined,
        bank_account_number:
          refundCurrency === 'ngn' && refundDestination === 'bank_account'
            ? bankAccountNumber.trim()
            : undefined,
        bank_account_name:
          refundCurrency === 'ngn' && refundDestination === 'bank_account' && bankAccountName.trim().length > 0
            ? bankAccountName.trim()
            : undefined,
        refund_reason: refundReason.trim() || undefined,
      });
      setActionMessage(`Refund ${result.refund.id.slice(0, 8)}... issued and dispute resolved.`);
      setRefundAmount('');
      setRefundReason('');
      setBankId('');
      setBankAccountNumber('');
      setBankAccountName('');
      await load();
      const refreshed = await disputesApi.get(activeDispute.id);
      setActiveDispute(refreshed);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to issue refund');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Disputes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Review customer disputes and submit merchant responses.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="resolved_customer_favor">Resolved (customer)</option>
          <option value="resolved_merchant_favor">Resolved (merchant)</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {activeDispute && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Dispute Actions: {activeDispute.id.slice(0, 8)}...
            </h3>
            <button
              onClick={() => setActiveDispute(null)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Submit merchant response</p>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
                placeholder="Share your response and evidence summary"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
              />
              <button
                onClick={submitResponse}
                disabled={isSubmittingResponse}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-50"
              >
                {isSubmittingResponse ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Issue refund and resolve dispute</p>
              {refundLimits && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Max refundable (net remaining): <span className="font-semibold">${refundLimits.remaining_refundable_usd.toFixed(6)}</span>
                </p>
              )}
              {refundLimitsError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{refundLimitsError}</p>
              )}
              <div className="flex gap-2">
                <select
                  value={refundCurrency}
                  onChange={(e) => {
                    const next = e.target.value as 'usd' | 'ngn';
                    setRefundCurrency(next);
                    if (next === 'usd') {
                      setRefundDestination('wallet');
                    }
                  }}
                  className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
                >
                  <option value="usd">USD</option>
                  <option value="ngn">NGN</option>
                </select>
                {!(refundCurrency === 'ngn' && refundDestination === 'bank_account') ? (
                  <input
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="0.000001"
                    placeholder={refundCurrency === 'usd' ? 'Amount (USD)' : 'Amount (NGN)'}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
                  />
                ) : (
                  <div className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-[#0f0f1a] text-slate-600 dark:text-slate-300">
                    Amount is auto-derived from payment and net-refundable balance.
                  </div>
                )}
              </div>
              {refundCurrency === 'ngn' && (
                <div className="space-y-2">
                  <select
                    value={refundDestination}
                    onChange={(e) => setRefundDestination(e.target.value as 'wallet' | 'bank_account')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
                  >
                    <option value="wallet">Refund to customer wallet</option>
                    <option value="bank_account">Refund to customer bank account (NGN)</option>
                  </select>
                  {refundDestination === 'bank_account' && (
                    <input
                      value={bankId}
                      onChange={(e) => setBankId(e.target.value)}
                      placeholder="PAJ Bank ID"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
                    />
                  )}
                  {refundDestination === 'bank_account' && (
                    <input
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="Bank account number"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
                    />
                  )}
                  {refundDestination === 'bank_account' && (
                    <input
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Bank account name (optional)"
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
                    />
                  )}
                  {refundDestination === 'bank_account' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      OTP/session is handled by backend using proxy-email flow.
                    </p>
                  )}
                </div>
              )}
              <input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0f0f1a]"
              />
              <button
                onClick={issueRefund}
                disabled={isSubmittingRefund}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-50"
              >
                {isSubmittingRefund ? 'Issuing...' : 'Issue Refund'}
              </button>
            </div>
          </div>

          {actionMessage && <p className="text-xs text-emerald-600 dark:text-emerald-400">{actionMessage}</p>}
          {actionError && <p className="text-xs text-rose-600 dark:text-rose-400">{actionError}</p>}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-[#10101b] text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-4 py-3">Dispute ID</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Opened</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>Loading disputes...</td></tr>
            ) : disputes.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>No disputes found.</td></tr>
            ) : (
              disputes.map((dispute) => (
                <tr key={dispute.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{dispute.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-mono text-xs">{dispute.payment_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 capitalize">{dispute.dispute_type.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3 capitalize">{dispute.status.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3">{new Date(dispute.opened_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setActiveDispute(dispute);
                        setActionError(null);
                        setActionMessage(null);
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View & Act
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
