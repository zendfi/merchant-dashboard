'use client';

import { useState, useEffect } from 'react';
import { useMode } from '@/lib/mode-context';
import { wallet as walletApi, WalletInfo } from '@/lib/api';
import { useNotification } from '@/lib/notifications';
import { getPasskeySignature } from '@/lib/webauthn';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { mode } = useMode();
  const { showNotification } = useNotification();
  const [walletData, setWalletData] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadWalletInfo();
    }
  }, [isOpen, mode]);

  const loadWalletInfo = async () => {
    setIsLoading(true);
    try {
      const data = await walletApi.getInfo(mode);
      setWalletData(data);
    } catch (error) {
      showNotification('Error', 'Failed to load wallet information', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const copyWalletAddress = () => {
    if (!walletData) return;
    navigator.clipboard.writeText(walletData.wallet_address)
      .then(() => showNotification('Copied!', 'Wallet address copied to clipboard', 'success'))
      .catch(() => showNotification('Error', 'Failed to copy address', 'error'));
  };

  const toggleSendForm = () => {
    setShowSendForm(!showSendForm);
    if (!showSendForm) {
      setRecipientAddress('');
      setSendAmount('');
      setSelectedToken('SOL');
    }
  };

  const getAvailableBalance = () => {
    if (!walletData) return '0.00';
    if (selectedToken === 'SOL') {
      return walletData.sol_balance.toFixed(4) + ' SOL';
    } else if (selectedToken === 'USDC') {
      return walletData.usdc_balance.toFixed(2) + ' USDC';
    }
    return '0.00 USDT';
  };

  const handleSendTokens = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletData) return;

    const amount = parseFloat(sendAmount);
    const maxBalance = selectedToken === 'SOL' ? walletData.sol_balance : walletData.usdc_balance;

    if (amount <= 0 || amount > maxBalance) {
      showNotification('Invalid Amount', `Amount must be between 0 and ${maxBalance.toFixed(selectedToken === 'SOL' ? 4 : 2)}`, 'error');
      return;
    }

    if (!walletData.has_mpc_wallet) {
      showNotification('MPC Wallet Required', 'Only MPC wallets support withdrawals. Please set up an MPC wallet first.', 'error');
      return;
    }

    setIsSending(true);

    try {
      showNotification('Security Check', 'Please authenticate with your passkey...', 'info');

      const passkeySignature = await getPasskeySignature({
        to_address: recipientAddress,
        amount: amount,
        token: selectedToken,
      });

      if (!passkeySignature) {
        throw new Error('Passkey authentication cancelled');
      }

      const tokenFormatted = selectedToken === 'SOL' ? 'Sol' : 'Usdc';

      const result = await walletApi.withdraw(
        recipientAddress,
        amount,
        tokenFormatted,
        passkeySignature
      );

      showNotification(
        'Transaction Sent!',
        `Successfully sent ${amount} ${selectedToken} to ${recipientAddress.substring(0, 8)}...`,
        'success'
      );

      setRecipientAddress('');
      setSendAmount('');
      setShowSendForm(false);
      await loadWalletInfo();
    } catch (error) {
      showNotification('Transaction Failed', error instanceof Error ? error.message : 'Unknown error', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const showReceiveInfo = () => {
    if (!walletData) return;
    showNotification(
      'Receive Tokens',
      `Send tokens to your wallet: ${walletData.wallet_address}`,
      'info'
    );
  };

  if (!isOpen) return null;

  const solPrice = 100; // Approximate SOL price in USD
  const totalUsd = walletData 
    ? (walletData.sol_balance * solPrice) + walletData.usdc_balance 
    : 0;

  return (
    <div
      className={`fixed inset-0 bg-[rgba(10,37,64,0.6)] backdrop-blur-[4px] z-[1000] transition-all ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl w-[90%] max-w-[440px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-transform ${
          isOpen ? 'scale-100' : 'scale-95'
        }`}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Header */}
        <div className="bg-white p-5 px-6 border-b border-[#E3E8EE] rounded-t-xl">
          <div className="w-full">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0A2540] m-0">Your Wallet</h2>
                <span className="bg-[#F6F9FC] border border-[#E3E8EE] px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.5px] text-[#425466]">
                  {mode === 'test' ? 'Test (Devnet)' : 'Live (Mainnet)'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="bg-transparent border-none text-[#425466] text-xl cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-[#F6F9FC] hover:text-[#0A2540]"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="bg-[#F6F9FC] px-3 py-2 rounded-md font-mono text-xs text-[#425466] flex-1 overflow-hidden text-ellipsis whitespace-nowrap border border-[#E3E8EE]">
                {walletData
                  ? `${walletData.wallet_address.substring(0, 4)}...${walletData.wallet_address.substring(walletData.wallet_address.length - 4)}`
                  : 'Loading...'}
              </div>
              <button
                onClick={copyWalletAddress}
                className="bg-white border border-[#E3E8EE] text-[#635BFF] px-3 py-2 rounded-md cursor-pointer ml-2 text-xs font-semibold transition-all hover:bg-[#F6F9FC] hover:border-[#635BFF]"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Balance Card */}
          <div className="bg-[#0A2540] rounded-lg p-5 text-white mb-6 shadow-[0_4px_12px_rgba(10,37,64,0.15)]">
            <div className="text-xs opacity-70 mb-1 uppercase tracking-[0.5px] font-semibold">
              Total Balance
            </div>
            <div className="text-[32px] font-bold mb-0.5 tracking-[-0.5px]">
              {isLoading ? 'Loading...' : `${walletData?.sol_balance.toFixed(4) || '0.0000'} SOL`}
            </div>
            <div className="text-sm opacity-70 font-medium">
              ${totalUsd.toFixed(2)} USD
            </div>
          </div>

          {/* Token List */}
          <div className="mb-6">
            <div className="text-[11px] font-bold text-[#425466] uppercase tracking-[0.6px] mb-3">
              Tokens
            </div>
            <div className="flex flex-col gap-2">
              {/* SOL Token */}
              <div className="bg-white rounded-lg p-3 flex items-center justify-between border border-[#E3E8EE] transition-all hover:border-[#635BFF] hover:shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-[#F6F9FC] border border-[#E3E8EE]">
                    ◎
                  </div>
                  <div className="flex flex-col">
                    <div className="font-semibold text-[#0A2540] text-sm">Solana</div>
                    <div className="text-xs text-[#425466]">SOL</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[#0A2540] text-sm">
                    {walletData?.sol_balance.toFixed(4) || '0.0000'}
                  </div>
                  <div className="text-xs text-[#425466]">
                    ${((walletData?.sol_balance || 0) * solPrice).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* USDC Token */}
              <div className="bg-white rounded-lg p-3 flex items-center justify-between border border-[#E3E8EE] transition-all hover:border-[#635BFF] hover:shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-[#F6F9FC] border border-[#E3E8EE]">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <path strokeWidth="2" strokeLinecap="round" d="M12 6v12M8 10h8M8 14h8" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <div className="font-semibold text-[#0A2540] text-sm">USD Coin</div>
                    <div className="text-xs text-[#425466]">USDC</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[#0A2540] text-sm">
                    {walletData?.usdc_balance.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-[#425466]">
                    ${walletData?.usdc_balance.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={toggleSendForm}
              className="flex-1 p-2.5 rounded-md border-none font-semibold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-[#635BFF] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-[#5449D6] hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(99,91,255,0.2)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              Send
            </button>
            <button
              onClick={showReceiveInfo}
              className="flex-1 p-2.5 rounded-md font-semibold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-white text-[#0A2540] border border-[#E3E8EE] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:bg-[#FAFBFC] hover:border-[#635BFF]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              Receive
            </button>
          </div>

          {/* Send Form */}
          {showSendForm && (
            <div className="mt-6 p-5 bg-[#F6F9FC] rounded-xl border border-[#E3E8EE]">
              <h3 className="mb-4 text-lg text-[#1A1F36] font-semibold">Send Tokens</h3>
              <form onSubmit={handleSendTokens}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#1A1F36] mb-2">Token</label>
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm font-sans bg-white cursor-pointer"
                  >
                    <option value="SOL">SOL - Solana</option>
                    <option value="USDC">USDC - USD Coin</option>
                    <option value="USDT">USDT - Tether</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter Solana address"
                    required
                    className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm font-sans transition-all focus:outline-none focus:border-[#5B6EE8] focus:shadow-[0_0_0_3px_rgba(91,110,232,0.1)]"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#1A1F36] mb-2">Amount</label>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.000001"
                    min="0.000001"
                    required
                    className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm font-sans transition-all focus:outline-none focus:border-[#5B6EE8] focus:shadow-[0_0_0_3px_rgba(91,110,232,0.1)]"
                  />
                  <div className="text-xs text-[#697386] mt-1">
                    Available: {getAvailableBalance()}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full p-3.5 bg-[#5B6EE8] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#4C5FD5] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending...' : 'Send Tokens'}
                </button>
                <button
                  type="button"
                  onClick={toggleSendForm}
                  className="w-full mt-2 p-3.5 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer transition-all"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
