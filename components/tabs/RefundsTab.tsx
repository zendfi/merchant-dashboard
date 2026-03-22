'use client';

import { useEffect, useState } from 'react';
import { refunds as refundsApi, Refund } from '@/lib/api';

export default function RefundsTab() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('all');

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

  return (
    <div className="space-y-4">
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
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Loading refunds...</td></tr>
            ) : refunds.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>No refunds found.</td></tr>
            ) : (
              refunds.map((refund) => (
                <tr key={refund.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{refund.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-mono text-xs">{refund.payment_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3">${refund.amount_usd.toFixed(2)}</td>
                  <td className="px-4 py-3 capitalize">{refund.status}</td>
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
