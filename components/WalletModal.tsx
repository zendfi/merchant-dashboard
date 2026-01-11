'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useMode } from '@/lib/mode-context';
import { wallet as walletApi, WalletInfo, offramp, PajBank, BankAccountDetails, OfframpOrder } from '@/lib/api';
import { useNotification } from '@/lib/notifications';
import { getPasskeySignature } from '@/lib/webauthn';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WalletView = 'main' | 'bank-withdrawal';
type BankStep = 'amount' | 'email' | 'otp' | 'bank' | 'account' | 'confirm' | 'processing' | 'success';

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { mode } = useMode();
  const { showNotification } = useNotification();
  
  // Main wallet state
  const [walletData, setWalletData] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // View state (main wallet or bank withdrawal)
  const [currentView, setCurrentView] = useState<WalletView>('main');
  
  // Bank withdrawal state
  const [bankStep, setBankStep] = useState<BankStep>('amount');
  const [bankIsLoading, setBankIsLoading] = useState(false);
  const [bankAmount, setBankAmount] = useState('');
  const [bankEmail, setBankEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [sessionToken, setSessionToken] = useState('');
  const [banks, setBanks] = useState<PajBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [accountDetails, setAccountDetails] = useState<BankAccountDetails | null>(null);
  const [order, setOrder] = useState<OfframpOrder | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [txSignature, setTxSignature] = useState('');
  const [explorerUrl, setExplorerUrl] = useState('');
  
  const otpValue = otpDigits.join('');

  useEffect(() => {
    if (isOpen) {
      loadWalletInfo();
    }
  }, [isOpen, mode]);

  // Load exchange rates when entering bank withdrawal
  useEffect(() => {
    if (currentView === 'bank-withdrawal') {
      loadRates();
    }
  }, [currentView]);

  // Reset everything when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
      resetBankWithdrawal();
      setShowSendForm(false);
    }
  }, [isOpen]);

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

  const loadRates = async () => {
    try {
      const data = await offramp.getRates();
      if (data?.rates?.off_ramp_rate?.rate) {
        setExchangeRate(data.rates.off_ramp_rate.rate);
      } else {
        setExchangeRate(1450);
      }
    } catch (error) {
      console.error('Failed to load rates:', error);
      setExchangeRate(1450);
    }
  };

  const resetBankWithdrawal = () => {
    setBankStep('amount');
    setBankAmount('');
    setBankEmail('');
    setOtpDigits(['', '', '', '']);
    setSessionToken('');
    setBanks([]);
    setSelectedBankId('');
    setAccountNumber('');
    setBankSearch('');
    setAccountDetails(null);
    setOrder(null);
    setTxSignature('');
    setExplorerUrl('');
  };

  const handleBackToWallet = () => {
    if (bankStep === 'processing') return; // Can't go back during processing
    resetBankWithdrawal();
    setCurrentView('main');
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

  // Bank withdrawal handlers
  const estimatedFiat = useMemo(() => {
    const numAmount = parseFloat(bankAmount) || 0;
    return numAmount * exchangeRate;
  }, [bankAmount, exchangeRate]);

  const filteredBanks = useMemo(() => {
    if (!bankSearch) return banks.slice(0, 20);
    return banks.filter(bank => 
      bank.name.toLowerCase().includes(bankSearch.toLowerCase())
    ).slice(0, 20);
  }, [banks, bankSearch]);

  const selectedBank = useMemo(() => {
    return banks.find(b => b.id === selectedBankId);
  }, [banks, selectedBankId]);

  const handleBankAmountSubmit = () => {
    const numAmount = parseFloat(bankAmount);
    if (!numAmount || numAmount <= 0) {
      showNotification('Error', 'Please enter a valid amount', 'error');
      return;
    }
    if (numAmount > (walletData?.usdc_balance || 0)) {
      showNotification('Error', 'Insufficient USDC balance', 'error');
      return;
    }
    if (numAmount < 0.5) {
      showNotification('Error', 'Minimum withdrawal is 0.5 USDC', 'error');
      return;
    }
    setBankStep('email');
  };

  const handleEmailSubmit = async () => {
    if (!bankEmail || !bankEmail.includes('@')) {
      showNotification('Error', 'Please enter a valid email', 'error');
      return;
    }
    setBankIsLoading(true);
    try {
      await offramp.initiate(bankEmail);
      showNotification('OTP Sent', 'Check your email for the verification code', 'success');
      setBankStep('otp');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Failed to send OTP', 'error');
    } finally {
      setBankIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otpValue.length < 4) {
      showNotification('Error', 'Please enter the 4-digit OTP code', 'error');
      return;
    }
    setBankIsLoading(true);
    try {
      const result = await offramp.verifyOtp(bankEmail, otpValue);
      setSessionToken(result.session_token);
      const banksResult = await offramp.getBanks(result.session_token);
      setBanks(banksResult.banks);
      setBankStep('bank');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Invalid OTP', 'error');
    } finally {
      setBankIsLoading(false);
    }
  };

  const handleBankSelect = (bankId: string) => {
    setSelectedBankId(bankId);
    setBankStep('account');
  };

  const handleAccountSubmit = async () => {
    if (!accountNumber || accountNumber.length < 10) {
      showNotification('Error', 'Please enter a valid account number', 'error');
      return;
    }
    setBankIsLoading(true);
    try {
      const details = await offramp.resolveAccount(sessionToken, selectedBankId, accountNumber);
      setAccountDetails(details);
      setBankStep('confirm');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Failed to verify account', 'error');
    } finally {
      setBankIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setBankIsLoading(true);
    setBankStep('processing');
    try {
      const orderResult = await offramp.createOrder(sessionToken, parseFloat(bankAmount), selectedBankId, accountNumber);
      setOrder(orderResult);
      showNotification('Order Created', 'Please authenticate with your passkey to complete the transfer', 'info');

      const passkeySignature = await getPasskeySignature({
        to_address: orderResult.paj_deposit_address,
        amount: parseFloat(bankAmount),
        token: 'Usdc',
      });

      if (!passkeySignature) {
        throw new Error('Passkey authentication cancelled');
      }

      const transferResult = await offramp.executeTransfer(orderResult.order_id, passkeySignature);
      setTxSignature(transferResult.tx_signature);
      setExplorerUrl(transferResult.explorer_url);
      setBankStep('success');
      showNotification('Success!', 'Your withdrawal has been initiated. Fiat will arrive in your bank account shortly.', 'success');
      await loadWalletInfo();
    } catch (error) {
      setBankStep('confirm');
      showNotification('Error', error instanceof Error ? error.message : 'Withdrawal failed', 'error');
    } finally {
      setBankIsLoading(false);
    }
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
        if (e.target === e.currentTarget && bankStep !== 'processing') onClose();
      }}
    >
      <div
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl w-[90%] max-w-[440px] max-h-[90vh] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-transform ${
          isOpen ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* Sliding container */}
        <div 
          className="flex transition-transform duration-300 ease-in-out"
          style={{ 
            width: '200%',
            transform: currentView === 'bank-withdrawal' ? 'translateX(-50%)' : 'translateX(0)' 
          }}
        >
          {/* Main Wallet View */}
          <div className="w-1/2 max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {/* Header */}
            <div className="bg-white p-5 px-6 border-b border-[#E3E8EE] rounded-t-xl sticky top-0 z-10">
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

          {/* Withdraw to Bank Button */}
          {mode === 'live' && (walletData?.usdc_balance || 0) > 0 && (
            <button
              onClick={() => setCurrentView('bank-withdrawal')}
              className="w-full mt-3 p-2.5 rounded-md font-semibold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-[#16A34A] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-[#15803D] hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(22,163,74,0.2)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4 8 4v14" />
                <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
              </svg>
              Withdraw to Bank (NGN)
            </button>
          )}

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

          {/* Bank Withdrawal View */}
          <div className="w-1/2 max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {/* Header */}
            <div className="bg-white p-5 px-6 border-b border-[#E3E8EE] sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {bankStep !== 'processing' && bankStep !== 'success' && (
                    <button
                      onClick={handleBackToWallet}
                      className="bg-transparent border-none text-[#425466] cursor-pointer w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-[#F6F9FC] hover:text-[#0A2540] mr-1"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                    </button>
                  )}
                  <h2 className="text-base font-bold text-[#0A2540] m-0">Withdraw to Bank</h2>
                  <span className="bg-[#F0FDF4] text-[#16A34A] px-2 py-0.5 rounded text-[10px] font-bold uppercase">NGN</span>
                </div>
                {bankStep !== 'processing' && (
                  <button
                    onClick={onClose}
                    className="bg-transparent border-none text-[#425466] text-xl cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-[#F6F9FC] hover:text-[#0A2540]"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* Progress indicator */}
              {bankStep !== 'success' && (
                <div className="flex gap-1.5 mt-4">
                  {['amount', 'email', 'otp', 'bank', 'account', 'confirm'].map((s, i) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        ['amount', 'email', 'otp', 'bank', 'account', 'confirm', 'processing'].indexOf(bankStep) >= i
                          ? 'bg-[#635BFF]'
                          : 'bg-[#E3E8EE]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bank Withdrawal Body */}
            <div className="p-6">
              {/* Amount Step */}
              {bankStep === 'amount' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1F36] mb-2">Amount to Withdraw (USDC)</label>
                    <input
                      type="number"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0.5"
                      className="w-full p-3 border border-[#E3E8EE] rounded-lg text-lg font-semibold text-center transition-all focus:outline-none focus:border-[#635BFF]"
                    />
                    <div className="flex justify-between mt-2 text-xs text-[#697386]">
                      <span>Available: {(walletData?.usdc_balance || 0).toFixed(2)} USDC</span>
                      <button
                        type="button"
                        onClick={() => setBankAmount((walletData?.usdc_balance || 0).toString())}
                        className="text-[#635BFF] hover:underline font-medium bg-transparent border-none cursor-pointer"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                  {exchangeRate > 0 && parseFloat(bankAmount) > 0 && (
                    <div className="bg-[#F6F9FC] rounded-lg p-3 border border-[#E3E8EE]">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#697386]">You&apos;ll receive (approx)</span>
                        <span className="font-semibold text-[#0A2540]">
                          ₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-xs text-[#697386] mt-1">Rate: 1 USDC = ₦{exchangeRate.toLocaleString()}</div>
                    </div>
                  )}
                  <button
                    onClick={handleBankAmountSubmit}
                    className="w-full p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6]"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Email Step */}
              {bankStep === 'email' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1F36] mb-2">Email Address</label>
                    <input
                      type="email"
                      value={bankEmail}
                      onChange={(e) => setBankEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm transition-all focus:outline-none focus:border-[#635BFF]"
                    />
                    <p className="text-xs text-[#697386] mt-2">We&apos;ll send a verification code to this email</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBankStep('amount')} className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer">Back</button>
                    <button onClick={handleEmailSubmit} disabled={bankIsLoading} className="flex-1 p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer disabled:bg-[#CBD5E1]">
                      {bankIsLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* OTP Step */}
              {bankStep === 'otp' && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="w-12 h-12 bg-[#EEF2FF] rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-[#635BFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-[#0A2540] mb-1">Check Your Email</h4>
                    <p className="text-xs text-[#697386]">We sent a 4-digit code to<br /><span className="font-medium text-[#0A2540]">{bankEmail}</span></p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#697386] mb-2 text-center">Enter verification code</label>
                    <div 
                      className="flex justify-center gap-2"
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
                        if (pastedData) {
                          const newOtp = ['', '', '', ''];
                          for (let i = 0; i < pastedData.length && i < 4; i++) {
                            newOtp[i] = pastedData[i];
                          }
                          setOtpDigits(newOtp);
                        }
                      }}
                    >
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { otpInputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(-1);
                            const newOtp = [...otpDigits];
                            newOtp[index] = value;
                            setOtpDigits(newOtp);
                            if (value && index < 3) otpInputRefs.current[index + 1]?.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
                          }}
                          autoFocus={index === 0 && currentView === 'bank-withdrawal' && bankStep === 'otp'}
                          className={`w-12 h-14 text-center text-xl font-semibold border-2 rounded-lg transition-all focus:outline-none ${
                            digit ? 'border-[#635BFF] bg-[#F5F3FF] text-[#635BFF]' : 'border-[#E3E8EE] bg-[#F6F9FC] text-[#0A2540] focus:border-[#635BFF]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setBankStep('email'); setOtpDigits(['', '', '', '']); }} className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer">Back</button>
                    <button onClick={handleOtpSubmit} disabled={bankIsLoading || otpValue.length < 4} className="flex-1 p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer disabled:bg-[#CBD5E1]">
                      {bankIsLoading ? 'Verifying...' : 'Verify & Continue'}
                    </button>
                  </div>
                </div>
              )}

              {/* Bank Selection Step */}
              {bankStep === 'bank' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1F36] mb-2">Select your bank</label>
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="Search banks..."
                      className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm transition-all focus:outline-none focus:border-[#635BFF] mb-2"
                    />
                  </div>
                  <div className="max-h-[280px] overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin' }}>
                    {filteredBanks.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => handleBankSelect(bank.id)}
                        className="w-full p-3 text-left bg-white border border-[#E3E8EE] rounded-lg text-sm font-medium text-[#0A2540] transition-all hover:border-[#635BFF] hover:bg-[#F5F3FF] cursor-pointer"
                      >
                        {bank.name}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setBankStep('otp')} className="w-full p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer">Back</button>
                </div>
              )}

              {/* Account Number Step */}
              {bankStep === 'account' && (
                <div className="space-y-4">
                  <div className="bg-[#F6F9FC] rounded-lg p-3 border border-[#E3E8EE]">
                    <div className="text-xs text-[#697386]">Selected Bank</div>
                    <div className="font-semibold text-[#0A2540]">{selectedBank?.name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1F36] mb-2">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit account number"
                      className="w-full p-3 border border-[#E3E8EE] rounded-lg text-lg font-mono text-center tracking-wider transition-all focus:outline-none focus:border-[#635BFF]"
                      maxLength={10}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBankStep('bank')} className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer">Back</button>
                    <button onClick={handleAccountSubmit} disabled={bankIsLoading || accountNumber.length < 10} className="flex-1 p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer disabled:bg-[#CBD5E1]">
                      {bankIsLoading ? 'Verifying...' : 'Verify Account'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation Step */}
              {bankStep === 'confirm' && accountDetails && (
                <div className="space-y-4">
                  <div className="bg-[#F0FDF4] rounded-lg p-4 border border-[#86EFAC]">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-semibold text-[#16A34A]">Account Verified</span>
                    </div>
                    <div className="text-[#0A2540] font-bold text-lg">{accountDetails.accountName}</div>
                    <div className="text-sm text-[#697386]">{accountDetails.bank.name}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-[#E3E8EE]">
                      <span className="text-[#697386]">You send</span>
                      <span className="font-semibold text-[#0A2540]">{parseFloat(bankAmount).toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E3E8EE]">
                      <span className="text-[#697386]">Exchange rate</span>
                      <span className="font-semibold text-[#0A2540]">1 USDC = ₦{exchangeRate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E3E8EE]">
                      <span className="text-[#697386]">They receive</span>
                      <span className="font-bold text-lg text-[#16A34A]">₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#697386]">To account</span>
                      <span className="font-mono text-[#0A2540]">{accountDetails.accountNumber}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBankStep('account')} className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer">Back</button>
                    <button onClick={handleConfirm} disabled={bankIsLoading} className="flex-1 p-3 bg-[#16A34A] text-white border-none rounded-lg font-semibold text-sm cursor-pointer disabled:bg-[#CBD5E1]">
                      {bankIsLoading ? 'Processing...' : 'Confirm & Withdraw'}
                    </button>
                  </div>
                </div>
              )}

              {/* Processing Step */}
              {bankStep === 'processing' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="absolute inset-0 border-4 border-[#E3E8EE] rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-[#635BFF] rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-bold text-[#0A2540] mb-2">Processing Withdrawal</h3>
                  <p className="text-sm text-[#697386]">Please wait while we process your withdrawal...<br />Do not close this window.</p>
                </div>
              )}

              {/* Success Step */}
              {bankStep === 'success' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#0A2540] mb-2">Withdrawal Initiated!</h3>
                  <p className="text-sm text-[#697386] mb-4">Your {parseFloat(bankAmount).toFixed(2)} USDC has been sent.<br />₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })} will arrive in your bank account shortly.</p>
                  {txSignature && (
                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#635BFF] hover:underline mb-4">
                      View transaction
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => { resetBankWithdrawal(); setCurrentView('main'); }}
                    className="w-full p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6]"
                  >
                    Back to Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
