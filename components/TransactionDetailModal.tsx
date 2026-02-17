'use client';

import React, { useState, useEffect } from 'react';
import { Transaction, transactions } from '@/lib/api';
import { X, Check, Copy, ExternalLink } from 'lucide-react';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
  onUpdate,
}: TransactionDetailModalProps) {
  const [reconciled, setReconciled] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (transaction) {
      setReconciled(transaction.reconciled);
      setInternalNotes(transaction.internal_notes || '');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await transactions.update(transaction.id, {
        reconciled,
        internal_notes: internalNotes || undefined,
      });
      onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to update transaction');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Transaction ID and Status */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Transaction ID
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-900">{transaction.id}</span>
                <button
                  onClick={() => copyToClipboard(transaction.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  transaction.status
                )}`}
              >
                {transaction.status}
              </span>
            </div>
          </div>

          {/* Amount and Token */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Amount</label>
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(transaction.amount_usd)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Token</label>
              <p className="text-lg font-medium text-gray-900">{transaction.token}</p>
            </div>
          </div>

          {/* Customer Information */}
          {(transaction.customer_wallet || transaction.customer_email || transaction.customer_name) && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Customer Information</h3>
              {transaction.customer_name && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  <p className="text-sm text-gray-900">{transaction.customer_name}</p>
                </div>
              )}
              {transaction.customer_email && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <p className="text-sm text-gray-900">{transaction.customer_email}</p>
                </div>
              )}
              {transaction.customer_wallet && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Wallet Address
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-900 break-all">
                      {transaction.customer_wallet}
                    </span>
                    <button
                      onClick={() => copyToClipboard(transaction.customer_wallet!)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Signature */}
          {transaction.transaction_signature && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Transaction Signature
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-900 break-all">
                  {transaction.transaction_signature}
                </span>
                <button
                  onClick={() => copyToClipboard(transaction.transaction_signature!)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <Copy size={14} />
                </button>
                <a
                  href={`https://solscan.io/tx/${transaction.transaction_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Created At</label>
              <p className="text-sm text-gray-900">{formatDate(transaction.created_at)}</p>
            </div>
            {transaction.reconciled_at && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Reconciled At
                </label>
                <p className="text-sm text-gray-900">{formatDate(transaction.reconciled_at)}</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">Metadata</label>
              <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono overflow-x-auto">
                {JSON.stringify(transaction.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Reconciliation Section */}
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Reconciliation</h3>
            
            {/* Reconciled Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReconciled(!reconciled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  reconciled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    reconciled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <label className="text-sm font-medium text-gray-900">
                {reconciled ? 'Reconciled' : 'Not Reconciled'}
              </label>
            </div>

            {/* Internal Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Internal Notes
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Add internal notes about this transaction..."
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
