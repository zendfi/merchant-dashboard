'use client';

import { useEffect, useState } from 'react';
import { useMode } from '@/lib/mode-context';
import { transactions as transactionsApi, Transaction } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface TransactionsTabProps {
  limit?: number;
  showViewAll?: boolean;
}

export default function TransactionsTab({ limit = 10, showViewAll = true }: TransactionsTabProps) {
  const router = useRouter();
  const { mode } = useMode();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const loadTransactions = async () => {
      setIsLoading(true);
      try {
        const data = await transactionsApi.list({ mode, limit });
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, [mode, limit]);

  const getStatusClass = (status: string | undefined) => {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed';
      case 'pending':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      case 'expired':
        return 'status-expired';
      default:
        return 'status-pending';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner spinner-dark" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">Transactions</h1>
        <div className="text-center py-12 text-[#697386]">
          <p>No transactions yet. Start accepting payments!</p>
          <a
            href="https://zendfi.tech/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-4 px-4 py-2 bg-[#635BFF] text-white rounded-md text-sm font-semibold no-underline hover:bg-[#5449D6]"
          >
            View Docs
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-[#0A2540]">Transactions</h1>
      
      <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <thead className="bg-[#FAFBFC]">
          <tr>
            <th className="text-left p-2.5 px-3 text-[11px] font-bold text-[#425466] uppercase tracking-[0.6px] border-b border-[#E3E8EE]">
              ID
            </th>
            <th className="text-left p-2.5 px-3 text-[11px] font-bold text-[#425466] uppercase tracking-[0.6px] border-b border-[#E3E8EE]">
              Amount
            </th>
            <th className="text-left p-2.5 px-3 text-[11px] font-bold text-[#425466] uppercase tracking-[0.6px] border-b border-[#E3E8EE]">
              Token
            </th>
            <th className="text-left p-2.5 px-3 text-[11px] font-bold text-[#425466] uppercase tracking-[0.6px] border-b border-[#E3E8EE]">
              Status
            </th>
            <th className="text-left p-2.5 px-3 text-[11px] font-bold text-[#425466] uppercase tracking-[0.6px] border-b border-[#E3E8EE]">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-[#FAFBFC]">
              <td className="p-3 border-b border-[#FAFBFC] text-[13px]">
                <span className="font-mono text-xs text-[#635BFF] font-medium">
                  {tx.id.substring(0, 8)}
                </span>
                {tx.split_count && tx.split_count > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-[10px] uppercase tracking-[0.5px] bg-[#D1FAE5] text-[#065F46]">
                    SPLIT
                  </span>
                )}
              </td>
              <td className="p-3 border-b border-[#FAFBFC] text-[13px]">
                <strong>${tx.amount_usd.toFixed(2)}</strong>
              </td>
              <td className="p-3 border-b border-[#FAFBFC] text-[13px]">
                {tx.payment_token || 'USDC'}
              </td>
              <td className="p-3 border-b border-[#FAFBFC] text-[13px]">
                <span className={`status-badge ${getStatusClass(tx.status)}`}>
                  {tx.status || 'pending'}
                </span>
              </td>
              <td className="p-3 border-b border-[#FAFBFC] text-[13px]">
                {new Date(tx.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                {new Date(tx.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showViewAll && total > limit && (
        <button
          onClick={() => router.push('/transactions')}
          className="w-full mt-3 p-2.5 bg-white text-[#635BFF] border border-[#E3E8EE] rounded-md text-[13px] font-semibold cursor-pointer transition-all shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-[#FAFBFC] hover:border-[#635BFF]"
        >
          View All Transactions ({total})
        </button>
      )}
    </div>
  );
}
