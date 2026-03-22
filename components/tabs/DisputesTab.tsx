'use client';

import { useEffect, useState } from 'react';
import { disputes as disputesApi, Dispute } from '@/lib/api';

export default function DisputesTab() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('all');

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

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-[#10101b] text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-4 py-3">Dispute ID</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Opened</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Loading disputes...</td></tr>
            ) : disputes.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>No disputes found.</td></tr>
            ) : (
              disputes.map((dispute) => (
                <tr key={dispute.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">{dispute.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-mono text-xs">{dispute.payment_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 capitalize">{dispute.dispute_type.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3 capitalize">{dispute.status.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3">{new Date(dispute.opened_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
