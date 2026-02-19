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

type WalletView = 'main' | 'send' | 'receive' | 'bank-withdrawal';
type BankStep = 'amount' | 'email' | 'otp' | 'bank' | 'account' | 'confirm' | 'processing' | 'manual-transfer' | 'success';

const TOKEN_LOGOS: Record<string, string> = {
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  //   USDT: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmKfrWkRbKsY6amJC5EGWSFE7gSWiDmMb/logo.svg',
};

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { mode } = useMode();
  const { showNotification } = useNotification();

  // Main wallet state
  const [walletData, setWalletData] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  // View state
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

  useEffect(() => {
    if (currentView === 'bank-withdrawal') {
      loadRates();
    }
  }, [currentView]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
      resetBankWithdrawal();
      setRecipientAddress('');
      setSendAmount('');
      setSelectedToken('SOL');
      setAddressCopied(false);
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

  const handleBackToMain = () => {
    setCurrentView('main');
    setRecipientAddress('');
    setSendAmount('');
    setSelectedToken('SOL');
    setAddressCopied(false);
  };

  const handleBackFromBank = () => {
    if (bankStep === 'processing') return;
    resetBankWithdrawal();
    setCurrentView('main');
  };

  const copyWalletAddress = () => {
    if (!walletData) return;
    navigator.clipboard.writeText(walletData.wallet_address)
      .then(() => {
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      })
      .catch(() => showNotification('Error', 'Failed to copy address', 'error'));
  };

  const getAvailableBalance = () => {
    if (!walletData) return '0.00';
    if (selectedToken === 'SOL') return walletData.sol_balance.toFixed(4) + ' SOL';
    if (selectedToken === 'USDC') return walletData.usdc_balance.toFixed(2) + ' USDC';
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
      if (!passkeySignature) throw new Error('Passkey authentication cancelled');

      const tokenFormatted = selectedToken === 'SOL' ? 'Sol' : 'Usdc';
      const result = await walletApi.withdraw(recipientAddress, amount, tokenFormatted, passkeySignature, mode);
      showNotification('Transaction Sent!', `Successfully sent ${amount} ${selectedToken} to ${recipientAddress.substring(0, 8)}...`, 'success');
      handleBackToMain();
      await loadWalletInfo();
    } catch (error) {
      showNotification('Transaction Failed', error instanceof Error ? error.message : 'Unknown error', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Bank withdrawal handlers
  const estimatedFiat = useMemo(() => {
    const numAmount = parseFloat(bankAmount) || 0;
    return numAmount * exchangeRate;
  }, [bankAmount, exchangeRate]);

  const filteredBanks = useMemo(() => {
    if (!bankSearch) return banks.slice(0, 20);
    return banks.filter(bank => bank.name.toLowerCase().includes(bankSearch.toLowerCase())).slice(0, 20);
  }, [banks, bankSearch]);

  const selectedBank = useMemo(() => {
    return banks.find(b => b.id === selectedBankId);
  }, [banks, selectedBankId]);

  const handleBankAmountSubmit = () => {
    const numAmount = parseFloat(bankAmount);
    if (!numAmount || numAmount <= 0) { showNotification('Error', 'Please enter a valid amount', 'error'); return; }
    if (numAmount > (walletData?.usdc_balance || 0)) { showNotification('Error', 'Insufficient USDC balance', 'error'); return; }
    if (numAmount < 0.5) { showNotification('Error', 'Minimum withdrawal is 0.5 USDC', 'error'); return; }
    setBankStep('email');
  };

  const handleEmailSubmit = async () => {
    if (!bankEmail || !bankEmail.includes('@')) { showNotification('Error', 'Please enter a valid email', 'error'); return; }
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
    if (otpValue.length < 4) { showNotification('Error', 'Please enter the 4-digit OTP code', 'error'); return; }
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
    if (!accountNumber || accountNumber.length < 10) { showNotification('Error', 'Please enter a valid account number', 'error'); return; }
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

      if (walletData?.has_mpc_wallet) {
        showNotification('Order Created', 'Please authenticate with your passkey to complete the transfer', 'info');
        const passkeySignature = await getPasskeySignature({
          to_address: orderResult.paj_deposit_address,
          amount: parseFloat(bankAmount),
          token: 'Usdc',
        });
        if (!passkeySignature) throw new Error('Passkey authentication cancelled');

        const transferResult = await offramp.executeTransfer(orderResult.order_id, passkeySignature);
        setTxSignature(transferResult.tx_signature);
        setExplorerUrl(transferResult.explorer_url);
        setBankStep('success');
        showNotification('Success!', 'Your withdrawal has been initiated. Fiat will arrive in your bank account shortly.', 'success');
        await loadWalletInfo();
      } else {
        setBankStep('manual-transfer');
        showNotification('Order Created', 'Please send USDC to the provided address to complete the withdrawal', 'info');
      }
    } catch (error) {
      setBankStep('confirm');
      showNotification('Error', error instanceof Error ? error.message : 'Withdrawal failed', 'error');
    } finally {
      setBankIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const solPrice = 100;
  const totalUsd = walletData
    ? (walletData.sol_balance * solPrice) + walletData.usdc_balance
    : 0;

  const qrCodeUrl = walletData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`solana:${walletData.wallet_address}`)}&format=svg`
    : '';

  return (
    <div
      className={`fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[1000] transition-all ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && bankStep !== 'processing') onClose();
      }}
    >
      <div
        className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-[#1f162b] rounded-2xl w-[90%] max-w-[440px] h-[85vh] max-h-[600px] overflow-hidden shadow-2xl transition-transform ${isOpen ? 'scale-100' : 'scale-95'
          }`}
      >
        {/* Navigation container */}
        <div className="relative w-full h-full">

          {/* ====== MAIN WALLET VIEW ====== */}
          <div
            className="absolute inset-0 overflow-y-auto transition-transform duration-300 ease-in-out"
            style={{
              transform: currentView === 'main' ? 'translateX(0)' : 'translateX(-100%)',
              scrollbarWidth: 'none',
            }}
          >
            {/* Header */}
            <div className="bg-white dark:bg-[#1f162b] p-5 px-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white m-0">Your Wallet</h2>
                  <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-[0.5px] text-slate-500 dark:text-slate-400">
                    {mode === 'test' ? 'Sandbox' : 'Live'}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg font-mono text-xs text-slate-500 dark:text-slate-400 flex-1 overflow-hidden text-ellipsis whitespace-nowrap border border-slate-200 dark:border-slate-700">
                  {walletData
                    ? `${walletData.wallet_address.substring(0, 4)}...${walletData.wallet_address.substring(walletData.wallet_address.length - 4)}`
                    : 'Loading...'}
                </div>
                <button
                  onClick={copyWalletAddress}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-primary px-3 py-2 rounded-lg cursor-pointer text-xs font-semibold transition-all hover:bg-primary/5 hover:border-primary"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Balance Card */}
              <div className="relative rounded-xl overflow-hidden mb-6 shadow-lg">
                <img
                  src="/wallet.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-primary backdrop-blur-3xl opacity-80" />
                <div className="relative z-10 p-5 text-white">
                  <div className="flex items-center gap-1.5 mb-2">
                    <img src={TOKEN_LOGOS.SOL} alt="SOL" className="w-5 h-5 rounded-full" />
                    <div className="text-xs opacity-80 uppercase tracking-[0.5px] font-semibold">Total Balance</div>
                  </div>
                  <div className="text-[32px] font-bold mb-0.5 tracking-[-0.5px] drop-shadow-lg">
                    {isLoading ? 'Loading...' : `${walletData?.sol_balance.toFixed(4) || '0.0000'} SOL`}
                  </div>
                  <div className="text-sm opacity-90 font-medium drop-shadow-sm">
                    ${totalUsd.toFixed(2)} USD
                  </div>
                </div>
              </div>

              {/* Token List */}
              <div className="mb-6">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.6px] mb-3">
                  Tokens
                </div>
                <div className="flex flex-col gap-2">
                  {/* SOL Token */}
                  <div className="bg-white dark:bg-[#281e36] rounded-xl p-3 flex items-center justify-between border border-slate-100 dark:border-slate-800 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <img src={TOKEN_LOGOS.SOL} alt="SOL" className="w-8 h-8 rounded-full" />
                      <div className="flex flex-col">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">Solana</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">SOL</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">
                        {walletData?.sol_balance.toFixed(4) || '0.0000'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ${((walletData?.sol_balance || 0) * solPrice).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* USDC Token */}
                  <div className="bg-white dark:bg-[#281e36] rounded-xl p-3 flex items-center justify-between border border-slate-100 dark:border-slate-800 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <img src={TOKEN_LOGOS.USDC} alt="USDC" className="w-8 h-8 rounded-full" />
                      <div className="flex flex-col">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">USD Coin</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">USDC</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900 dark:text-white text-sm">
                        {walletData?.usdc_balance.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ${walletData?.usdc_balance.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentView('send')}
                  className="flex-1 p-2.5 rounded-xl border-none font-semibold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-primary text-white shadow-sm hover:bg-primary/90 hover:-translate-y-px hover:shadow-md hover:shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                  Send
                </button>
                <button
                  onClick={() => setCurrentView('receive')}
                  className="flex-1 p-2.5 rounded-xl font-semibold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-primary/40"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                  Receive
                </button>
              </div>

              {/* Withdraw to Bank Button */}
              {mode === 'live' && (walletData?.usdc_balance || 0) > 0 && (
                <button
                  onClick={() => setCurrentView('bank-withdrawal')}
                  className="w-full mt-3 p-2.5 rounded-xl font-semibold text-[13px] cursor-pointer transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:-translate-y-px hover:shadow-md hover:shadow-emerald-600/20"
                >
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                  Withdraw to Bank (NGN)
                </button>
              )}
            </div>
          </div>

          {/* ====== SEND VIEW ====== */}
          <div
            className="absolute inset-0 overflow-y-auto transition-transform duration-300 ease-in-out"
            style={{
              transform: currentView === 'send' ? 'translateX(0)' : 'translateX(100%)',
              scrollbarWidth: 'none',
            }}
          >
            {/* Header */}
            <div className="bg-white dark:bg-[#1f162b] p-5 px-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackToMain}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mr-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white m-0">Send</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Send Body */}
            <div className="p-6">
              <form onSubmit={handleSendTokens}>
                {/* Token Selector */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.5px] mb-2">Asset</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'SOL', name: 'SOL', logo: TOKEN_LOGOS.SOL, balance: walletData?.sol_balance.toFixed(4) || '0' },
                      { id: 'USDC', name: 'USDC', logo: TOKEN_LOGOS.USDC, balance: walletData?.usdc_balance.toFixed(2) || '0' },
                      //   { id: 'USDT', name: 'USDT', logo: TOKEN_LOGOS.USDT, balance: '0.00' },
                    ].map((token) => (
                      <button
                        key={token.id}
                        type="button"
                        onClick={() => setSelectedToken(token.id)}
                        className={`flex-1 p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center ${selectedToken === token.id
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#281e36] hover:border-primary/40'
                          }`}
                      >
                        <img src={token.logo} alt={token.name} className="w-7 h-7 rounded-full mb-1" />
                        <div className={`text-xs font-bold ${selectedToken === token.id ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{token.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{token.balance}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.5px] mb-2">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.000001"
                      min="0.000001"
                      required
                      className="w-full p-3.5 pr-16 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold bg-white dark:bg-[#281e36] text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!walletData) return;
                        const max = selectedToken === 'SOL' ? walletData.sol_balance : walletData.usdc_balance;
                        setSendAmount(max.toString());
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer hover:bg-primary/20 transition-colors border-none"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                    Available: {getAvailableBalance()}
                  </div>
                </div>

                {/* Recipient */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.5px] mb-2">Recipient Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter Solana wallet address"
                    required
                    className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono bg-white dark:bg-[#281e36] text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                  />
                </div>

                {/* Summary */}
                {sendAmount && recipientAddress && (
                  <div className="bg-slate-50 dark:bg-[#281e36] rounded-xl p-4 border border-slate-100 dark:border-slate-800 mb-5">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.5px] mb-3">Summary</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Sending</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{sendAmount} {selectedToken}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">To</span>
                        <span className="font-mono text-slate-900 dark:text-white text-xs">
                          {recipientAddress.length > 12
                            ? `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`
                            : recipientAddress}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Network</span>
                        <span className="text-slate-900 dark:text-white">Solana {mode === 'test' ? 'Sandbox' : 'Live'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSending || !recipientAddress || !sendAmount}
                  className="w-full p-3.5 bg-primary text-white border-none rounded-xl font-semibold text-sm cursor-pointer transition-all hover:bg-primary/90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      Send {selectedToken}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ====== RECEIVE VIEW ====== */}
          <div
            className="absolute inset-0 overflow-y-auto transition-transform duration-300 ease-in-out"
            style={{
              transform: currentView === 'receive' ? 'translateX(0)' : 'translateX(100%)',
              scrollbarWidth: 'none',
            }}
          >
            {/* Header */}
            <div className="bg-white dark:bg-[#1f162b] p-5 px-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackToMain}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mr-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  </button>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white m-0">Receive</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Receive Body */}
            <div className="p-6 flex flex-col items-center">
              {/* Network Badge */}
              <div className="flex items-center gap-1.5 bg-primary/10 dark:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-xs font-semibold mb-6">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                Solana {mode === 'test' ? 'Sandbox' : 'Live'}
              </div>

              {/* QR Code */}
              <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 mb-6">
                {walletData ? (
                  <img
                    src={qrCodeUrl}
                    alt="Wallet QR Code"
                    width={200}
                    height={200}
                    className="rounded-lg block"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] bg-slate-100 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-4xl">qr_code_2</span>
                  </div>
                )}
              </div>

              {/* Wallet Label */}
              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Your Wallet Address</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">Scan the QR code or copy the address below to receive tokens</p>

              {/* Address */}
              <div className="w-full bg-slate-50 dark:bg-[#281e36] rounded-xl p-4 border border-slate-100 dark:border-slate-800 mb-4">
                <div className="font-mono text-xs text-slate-900 dark:text-white text-center break-all leading-relaxed select-all">
                  {walletData?.wallet_address || 'Loading...'}
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={copyWalletAddress}
                className={`w-full p-3.5 border-none rounded-xl font-semibold text-sm cursor-pointer transition-all flex items-center justify-center gap-2 ${addressCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary text-white hover:bg-primary/90'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {addressCopied ? 'check' : 'content_copy'}
                </span>
                {addressCopied ? 'Copied to Clipboard!' : 'Copy Address'}
              </button>

              {/* Supported Tokens */}
              <div className="w-full mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.6px] mb-3 text-center">Supported Tokens</div>
                <div className="flex justify-center gap-2">
                  {[
                    { name: 'SOL', logo: TOKEN_LOGOS.SOL },
                    { name: 'USDC', logo: TOKEN_LOGOS.USDC },
                    { name: 'USDT', logo: TOKEN_LOGOS.USDT },
                  ].map((token) => (
                    <div key={token.name} className="bg-white dark:bg-[#1f162b] border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <img src={token.logo} alt={token.name} className="w-4 h-4 rounded-full" />
                      {token.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="w-full mt-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3.5 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[18px] flex-shrink-0 mt-0.5">warning</span>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  Only send <strong>Solana-based tokens</strong> to this address. Sending assets from other networks may result in permanent loss.
                </p>
              </div>
            </div>
          </div>

          {/* ====== BANK WITHDRAWAL VIEW ====== */}
          <div
            className="absolute inset-0 overflow-y-auto transition-transform duration-300 ease-in-out"
            style={{
              transform: currentView === 'bank-withdrawal' ? 'translateX(0)' : 'translateX(100%)',
              scrollbarWidth: 'none',
            }}
          >
            {/* Header */}
            <div className="bg-white dark:bg-[#1f162b] p-5 px-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {bankStep !== 'processing' && bankStep !== 'success' && (
                    <button
                      onClick={handleBackFromBank}
                      className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mr-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    </button>
                  )}
                  <h2 className="text-base font-bold text-slate-900 dark:text-white m-0">Withdraw to Bank</h2>
                  <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase">NGN</span>
                </div>
                {bankStep !== 'processing' && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Progress indicator */}
              {bankStep !== 'success' && (
                <div className="flex gap-1.5 mt-4">
                  {['amount', 'email', 'otp', 'bank', 'account', 'confirm'].map((s, i) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-all ${['amount', 'email', 'otp', 'bank', 'account', 'confirm', 'processing'].indexOf(bankStep) >= i
                          ? 'bg-primary'
                          : 'bg-slate-200 dark:bg-slate-700'
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
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Amount to Withdraw (USDC)</label>
                    <input
                      type="number"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0.5"
                      className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold text-center bg-white dark:bg-[#1f162b] text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Available: {(walletData?.usdc_balance || 0).toFixed(2)} USDC</span>
                      <button
                        type="button"
                        onClick={() => setBankAmount((walletData?.usdc_balance || 0).toString())}
                        className="text-primary hover:underline font-medium bg-transparent border-none cursor-pointer"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                  {exchangeRate > 0 && parseFloat(bankAmount) > 0 && (
                    <div className="bg-slate-50 dark:bg-[#281e36] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">You&apos;ll receive (approx)</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rate: 1 USDC = ₦{exchangeRate.toLocaleString()}</div>
                    </div>
                  )}
                  <button
                    onClick={handleBankAmountSubmit}
                    className="w-full p-3 bg-primary text-white border-none rounded-xl font-semibold text-sm cursor-pointer transition-all hover:bg-primary/90"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Email Step */}
              {bankStep === 'email' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Email Address</label>
                    <input
                      type="email"
                      value={bankEmail}
                      onChange={(e) => setBankEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-[#1f162b] text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">We&apos;ll send a verification code to this email</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBankStep('amount')} className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl font-semibold text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Back</button>
                    <button onClick={handleEmailSubmit} disabled={bankIsLoading} className="flex-1 p-3 bg-primary text-white border-none rounded-xl font-semibold text-sm cursor-pointer disabled:bg-slate-300 dark:disabled:bg-slate-700 hover:bg-primary/90 transition-colors">
                      {bankIsLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* OTP Step */}
              {bankStep === 'otp' && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-primary text-2xl">mail</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Check Your Email</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">We sent a 4-digit code to<br /><span className="font-medium text-slate-900 dark:text-white">{bankEmail}</span></p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 text-center">Enter verification code</label>
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
                          className={`w-12 h-14 text-center text-xl font-semibold border-2 rounded-xl transition-all focus:outline-none ${digit
                              ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary'
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setBankStep('email'); setOtpDigits(['', '', '', '']); }} className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl font-semibold text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Back</button>
                    <button onClick={handleOtpSubmit} disabled={bankIsLoading || otpValue.length < 4} className="flex-1 p-3 bg-primary text-white border-none rounded-xl font-semibold text-sm cursor-pointer disabled:bg-slate-300 dark:disabled:bg-slate-700 hover:bg-primary/90 transition-colors">
                      {bankIsLoading ? 'Verifying...' : 'Verify & Continue'}
                    </button>
                  </div>
                </div>
              )}

              {/* Bank Selection Step */}
              {bankStep === 'bank' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Select your bank</label>
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="Search banks..."
                      className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-[#1f162b] text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 mb-2"
                    />
                  </div>
                  <div className="max-h-[280px] overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin' }}>
                    {filteredBanks.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => handleBankSelect(bank.id)}
                        className="w-full p-3 text-left bg-white dark:bg-[#281e36] border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white transition-all hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 cursor-pointer"
                      >
                        {bank.name}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setBankStep('otp')} className="w-full p-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl font-semibold text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Back</button>
                </div>
              )}

              {/* Account Number Step */}
              {bankStep === 'account' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-[#281e36] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Selected Bank</div>
                    <div className="font-semibold text-slate-900 dark:text-white">{selectedBank?.name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit account number"
                      className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-mono text-center tracking-wider bg-white dark:bg-[#1f162b] text-slate-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                      maxLength={10}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBankStep('bank')} className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl font-semibold text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Back</button>
                    <button onClick={handleAccountSubmit} disabled={bankIsLoading || accountNumber.length < 10} className="flex-1 p-3 bg-primary text-white border-none rounded-xl font-semibold text-sm cursor-pointer disabled:bg-slate-300 dark:disabled:bg-slate-700 hover:bg-primary/90 transition-colors">
                      {bankIsLoading ? 'Verifying...' : 'Verify Account'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation Step */}
              {bankStep === 'confirm' && accountDetails && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">check_circle</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Account Verified</span>
                    </div>
                    <div className="text-slate-900 dark:text-white font-bold text-lg">{accountDetails.accountName}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{accountDetails.bank.name}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">You send</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{parseFloat(bankAmount).toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Exchange rate</span>
                      <span className="font-semibold text-slate-900 dark:text-white">1 USDC = ₦{exchangeRate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">They receive</span>
                      <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-500 dark:text-slate-400">To account</span>
                      <span className="font-mono text-slate-900 dark:text-white">{accountDetails.accountNumber}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBankStep('account')} className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl font-semibold text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Back</button>
                    <button onClick={handleConfirm} disabled={bankIsLoading} className="flex-1 p-3 bg-emerald-600 text-white border-none rounded-xl font-semibold text-sm cursor-pointer disabled:bg-slate-300 dark:disabled:bg-slate-700 hover:bg-emerald-700 transition-colors">
                      {bankIsLoading ? 'Processing...' : 'Confirm & Withdraw'}
                    </button>
                  </div>
                </div>
              )}

              {/* Processing Step */}
              {bankStep === 'processing' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Processing Withdrawal</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Please wait while we process your withdrawal...<br />Do not close this window.</p>
                </div>
              )}

              {/* Manual Transfer Step (for external wallets) */}
              {bankStep === 'manual-transfer' && order && (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl flex-shrink-0 mt-0.5">warning</span>
                      <div>
                        <div className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Manual Transfer Required</div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                          You&apos;re using an external wallet. Please manually send USDC to complete this withdrawal.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#281e36] rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Send exactly this amount:</h4>
                    <div className="bg-white dark:bg-[#1f162b] rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-center mb-4">
                      <div className="text-2xl font-bold text-primary">{parseFloat(bankAmount).toFixed(2)} USDC</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">≈ ₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">To this address:</h4>
                    <div className="bg-white dark:bg-[#1f162b] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <div className="font-mono text-xs text-slate-900 dark:text-white break-all mb-2">{order.paj_deposit_address}</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(order.paj_deposit_address);
                          showNotification('Copied!', 'Deposit address copied to clipboard', 'success');
                        }}
                        className="w-full p-2 bg-primary text-white border-none rounded-lg font-semibold text-xs cursor-pointer transition-all hover:bg-primary/90 flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        Copy Address
                      </button>
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                      Instructions
                    </h4>
                    <ol className="text-xs text-emerald-700 dark:text-emerald-400 space-y-2 list-decimal list-inside">
                      <li>Open your Solana wallet (Phantom, Solflare, etc.)</li>
                      <li>Select <strong>USDC</strong> token</li>
                      <li>Click <strong>Send</strong> and paste the address above</li>
                      <li>Enter exactly <strong>{parseFloat(bankAmount).toFixed(2)} USDC</strong></li>
                      <li>Confirm the transaction in your wallet</li>
                    </ol>
                  </div>

                  <div className="bg-white dark:bg-[#281e36] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Recipient</span>
                      <span className="font-medium text-slate-900 dark:text-white">{accountDetails?.accountName}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-500 dark:text-slate-400">Bank</span>
                      <span className="font-medium text-slate-900 dark:text-white">{accountDetails?.bank.name}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-500 dark:text-slate-400">Account</span>
                      <span className="font-mono text-slate-900 dark:text-white">{accountDetails?.accountNumber}</span>
                    </div>
                  </div>

                  <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                    <p>Once you send the USDC, the funds will be converted and sent to your bank account automatically.</p>
                    <p className="mt-1 font-medium">Order ID: {order.order_id.slice(0, 8)}...</p>
                  </div>

                  <button
                    onClick={() => { resetBankWithdrawal(); setCurrentView('main'); }}
                    className="w-full p-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl font-semibold text-sm cursor-pointer transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Success Step */}
              {bankStep === 'success' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[32px]">check_circle</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Withdrawal Initiated!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Your {parseFloat(bankAmount).toFixed(2)} USDC has been sent.<br />₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2 })} will arrive in your bank account shortly.</p>
                  {txSignature && (
                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4">
                      View transaction
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </a>
                  )}
                  <button
                    onClick={() => { resetBankWithdrawal(); setCurrentView('main'); }}
                    className="w-full p-3 bg-primary text-white border-none rounded-xl font-semibold text-sm cursor-pointer transition-all hover:bg-primary/90"
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
