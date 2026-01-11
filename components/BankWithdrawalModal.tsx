'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { offramp, PajBank, BankAccountDetails, OfframpOrder } from '@/lib/api';
import { useNotification } from '@/lib/notifications';
import { getPasskeySignature } from '@/lib/webauthn';

interface BankWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  usdcBalance: number;
  onSuccess?: () => void;
}

type Step = 'amount' | 'email' | 'otp' | 'bank' | 'account' | 'confirm' | 'processing' | 'success';

export default function BankWithdrawalModal({ 
  isOpen, 
  onClose, 
  usdcBalance,
  onSuccess 
}: BankWithdrawalModalProps) {
  const { showNotification } = useNotification();
  
  // Flow state
  const [step, setStep] = useState<Step>('amount');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form data
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
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
  
  // OTP value as string
  const otpValue = otpDigits.join('');

  // Load rates on mount
  useEffect(() => {
    if (isOpen) {
      loadRates();
    }
  }, [isOpen]);

  const loadRates = async () => {
    try {
      const data = await offramp.getRates();
      console.log('Offramp rates response:', data);
      if (data?.rates?.off_ramp_rate?.rate) {
        setExchangeRate(data.rates.off_ramp_rate.rate);
      } else {
        console.error('Invalid rates response structure:', data);
        // Default fallback rate if API returns bad data
        setExchangeRate(1450);
      }
    } catch (error) {
      console.error('Failed to load rates:', error);
      // Default fallback rate
      setExchangeRate(1450);
    }
  };

  // Calculate estimated fiat amount
  const estimatedFiat = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    return numAmount * exchangeRate;
  }, [amount, exchangeRate]);

  // Filter banks by search
  const filteredBanks = useMemo(() => {
    if (!bankSearch) return banks.slice(0, 20);
    return banks.filter(bank => 
      bank.name.toLowerCase().includes(bankSearch.toLowerCase())
    ).slice(0, 20);
  }, [banks, bankSearch]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('amount');
      setAmount('');
      setEmail('');
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
    }
  }, [isOpen]);

  // Step handlers
  const handleAmountSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showNotification('Error', 'Please enter a valid amount', 'error');
      return;
    }
    if (numAmount > usdcBalance) {
      showNotification('Error', 'Insufficient USDC balance', 'error');
      return;
    }
    if (numAmount < 0.5) {
      showNotification('Error', 'Minimum withdrawal is 0.5 USDC', 'error');
      return;
    }
    setStep('email');
  };

  const handleEmailSubmit = async () => {
    if (!email || !email.includes('@')) {
      showNotification('Error', 'Please enter a valid email', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await offramp.initiate(email);
      showNotification('OTP Sent', 'Check your email for the verification code', 'success');
      setStep('otp');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Failed to send OTP', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otpValue.length < 4) {
      showNotification('Error', 'Please enter the 4-digit OTP code', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await offramp.verifyOtp(email, otpValue);
      setSessionToken(result.session_token);
      
      // Fetch banks
      const banksResult = await offramp.getBanks(result.session_token);
      setBanks(banksResult.banks);
      
      setStep('bank');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Invalid OTP', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBankSelect = (bankId: string) => {
    setSelectedBankId(bankId);
    setStep('account');
  };

  const handleAccountSubmit = async () => {
    if (!accountNumber || accountNumber.length < 10) {
      showNotification('Error', 'Please enter a valid account number', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const details = await offramp.resolveAccount(sessionToken, selectedBankId, accountNumber);
      setAccountDetails(details);
      setStep('confirm');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Failed to verify account', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setStep('processing');
    
    try {
      // Create order
      const orderResult = await offramp.createOrder(
        sessionToken,
        parseFloat(amount),
        selectedBankId,
        accountNumber
      );
      setOrder(orderResult);
      
      showNotification('Order Created', 'Please authenticate with your passkey to complete the transfer', 'info');
      
      // Get passkey signature
      const passkeySignature = await getPasskeySignature({
        to_address: orderResult.paj_deposit_address,
        amount: parseFloat(amount),
        token: 'Usdc',
      });
      
      if (!passkeySignature) {
        throw new Error('Passkey authentication cancelled');
      }
      
      // Execute transfer
      const transferResult = await offramp.executeTransfer(orderResult.order_id, passkeySignature);
      
      setTxSignature(transferResult.tx_signature);
      setExplorerUrl(transferResult.explorer_url);
      setStep('success');
      
      showNotification('Success!', 'Your withdrawal has been initiated. Fiat will arrive in your bank account shortly.', 'success');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setStep('confirm');
      showNotification('Error', error instanceof Error ? error.message : 'Withdrawal failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBank = useMemo(() => {
    return banks.find(b => b.id === selectedBankId);
  }, [banks, selectedBankId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[rgba(10,37,64,0.6)] backdrop-blur-[4px] z-[1001] transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'processing') onClose();
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl w-[90%] max-w-[440px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Header */}
        <div className="bg-white p-5 px-6 border-b border-[#E3E8EE] rounded-t-xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0A2540] m-0">Withdraw to Bank</h2>
              <span className="bg-[#F0FDF4] text-[#16A34A] px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                NGN
              </span>
            </div>
            {step !== 'processing' && (
              <button
                onClick={onClose}
                className="bg-transparent border-none text-[#425466] text-xl cursor-pointer w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-[#F6F9FC] hover:text-[#0A2540]"
              >
                ×
              </button>
            )}
          </div>
          
          {/* Progress indicator */}
          {step !== 'success' && (
            <div className="flex gap-1.5 mt-4">
              {['amount', 'email', 'otp', 'bank', 'account', 'confirm'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    ['amount', 'email', 'otp', 'bank', 'account', 'confirm', 'processing'].indexOf(step) >= i
                      ? 'bg-[#635BFF]'
                      : 'bg-[#E3E8EE]'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Amount Step */}
          {step === 'amount' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                  Amount to Withdraw (USDC)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.5"
                  className="w-full p-3 border border-[#E3E8EE] rounded-lg text-lg font-semibold text-center transition-all focus:outline-none focus:border-[#635BFF] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.1)]"
                />
                <div className="flex justify-between mt-2 text-xs text-[#697386]">
                  <span>Available: {usdcBalance.toFixed(2)} USDC</span>
                  <button
                    onClick={() => setAmount(usdcBalance.toString())}
                    className="text-[#635BFF] hover:underline font-medium"
                  >
                    Max
                  </button>
                </div>
              </div>
              
              {exchangeRate > 0 && parseFloat(amount) > 0 && (
                <div className="bg-[#F6F9FC] rounded-lg p-4 border border-[#E3E8EE]">
                  <div className="text-xs text-[#697386] mb-1">You will receive approximately</div>
                  <div className="text-2xl font-bold text-[#0A2540]">
                    ₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-[#697386] mt-1">
                    Rate: 1 USDC = ₦{exchangeRate.toLocaleString()}
                  </div>
                </div>
              )}

              <button
                onClick={handleAmountSubmit}
                className="w-full p-3.5 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6]"
              >
                Continue
              </button>
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                  Enter your email for verification
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm transition-all focus:outline-none focus:border-[#635BFF] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.1)]"
                />
                <p className="text-xs text-[#697386] mt-2">
                  We&apos;ll send a verification code to this email
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#D3D9E1]"
                >
                  Back
                </button>
                <button
                  onClick={handleEmailSubmit}
                  disabled={isLoading}
                  className="flex-1 p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            </div>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-[#EEF2FF] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#635BFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-[#0A2540] mb-1">Check Your Email</h4>
                <p className="text-xs text-[#697386]">
                  We sent a 4-digit code to<br />
                  <span className="font-medium text-[#0A2540]">{email}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#697386] mb-2 text-center">
                  Enter verification code
                </label>
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
                      const nextEmptyIndex = newOtp.findIndex(d => !d);
                      otpInputRefs.current[nextEmptyIndex === -1 ? 3 : nextEmptyIndex]?.focus();
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
                        if (value && index < 3) {
                          otpInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
                          otpInputRefs.current[index - 1]?.focus();
                        } else if (e.key === 'ArrowLeft' && index > 0) {
                          otpInputRefs.current[index - 1]?.focus();
                        } else if (e.key === 'ArrowRight' && index < 3) {
                          otpInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      autoFocus={index === 0}
                      className={`
                        w-12 h-14 text-center text-xl font-semibold
                        border-2 rounded-lg transition-all duration-150
                        focus:outline-none focus:ring-0
                        ${digit 
                          ? 'border-[#635BFF] bg-[#F5F3FF] text-[#635BFF]' 
                          : 'border-[#E3E8EE] bg-[#F6F9FC] text-[#0A2540] focus:border-[#635BFF] focus:bg-white'
                        }
                      `}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-[#697386] text-center mt-2">
                  Paste from clipboard or type manually
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('email');
                    setOtpDigits(['', '', '', '']);
                  }}
                  className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#D3D9E1]"
                >
                  Back
                </button>
                <button
                  onClick={handleOtpSubmit}
                  disabled={isLoading || otpValue.length < 4}
                  className="flex-1 p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Bank Selection Step */}
          {step === 'bank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                  Select your bank
                </label>
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search banks..."
                  className="w-full p-3 border border-[#E3E8EE] rounded-lg text-sm transition-all focus:outline-none focus:border-[#635BFF] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.1)] mb-3"
                />
                
                <div className="max-h-[240px] overflow-y-auto rounded-lg border border-[#E3E8EE]">
                  {filteredBanks.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => handleBankSelect(bank.id)}
                      className="w-full p-3 text-left border-b border-[#E3E8EE] last:border-b-0 hover:bg-[#F6F9FC] transition-colors"
                    >
                      <div className="font-medium text-sm text-[#0A2540]">{bank.name}</div>
                      <div className="text-xs text-[#697386]">{bank.country}</div>
                    </button>
                  ))}
                  {filteredBanks.length === 0 && (
                    <div className="p-4 text-center text-[#697386] text-sm">
                      No banks found
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setStep('otp')}
                className="w-full p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#D3D9E1]"
              >
                Back
              </button>
            </div>
          )}

          {/* Account Number Step */}
          {step === 'account' && (
            <div className="space-y-4">
              <div className="bg-[#F6F9FC] rounded-lg p-3 border border-[#E3E8EE]">
                <div className="text-xs text-[#697386]">Selected Bank</div>
                <div className="font-semibold text-[#0A2540]">{selectedBank?.name}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A1F36] mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit account number"
                  className="w-full p-3 border border-[#E3E8EE] rounded-lg text-lg font-mono text-center tracking-wider transition-all focus:outline-none focus:border-[#635BFF] focus:shadow-[0_0_0_3px_rgba(99,91,255,0.1)]"
                  maxLength={10}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('bank')}
                  className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#D3D9E1]"
                >
                  Back
                </button>
                <button
                  onClick={handleAccountSubmit}
                  disabled={isLoading || accountNumber.length < 10}
                  className="flex-1 p-3 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Verify Account'}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation Step */}
          {step === 'confirm' && accountDetails && (
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
                  <span className="font-semibold text-[#0A2540]">{parseFloat(amount).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#E3E8EE]">
                  <span className="text-[#697386]">Exchange rate</span>
                  <span className="font-semibold text-[#0A2540]">
                    1 USDC = ₦{exchangeRate > 0 ? exchangeRate.toLocaleString() : 'Loading...'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#E3E8EE]">
                  <span className="text-[#697386]">They receive</span>
                  <span className="font-bold text-lg text-[#16A34A]">
                    ₦{exchangeRate > 0 
                      ? estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : 'Calculating...'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[#697386]">To account</span>
                  <span className="font-mono text-[#0A2540]">{accountDetails.accountNumber}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('account')}
                  className="flex-1 p-3 bg-[#E3E8EE] text-[#1A1F36] border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#D3D9E1]"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex-1 p-3 bg-[#16A34A] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#15803D] disabled:bg-[#CBD5E1] disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing...' : 'Confirm & Withdraw'}
                </button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-[#E3E8EE] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-[#635BFF] rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-bold text-[#0A2540] mb-2">Processing Withdrawal</h3>
              <p className="text-sm text-[#697386]">
                Please authenticate with your passkey and wait while we process your transaction...
              </p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#F0FDF4] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[#0A2540] mb-2">Withdrawal Initiated!</h3>
              <p className="text-sm text-[#697386] mb-4">
                Your {parseFloat(amount).toFixed(2)} USDC has been sent. The funds will arrive in your bank account shortly.
              </p>
              
              <div className="bg-[#F6F9FC] rounded-lg p-4 mb-4 text-left border border-[#E3E8EE]">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-[#697386]">Amount</span>
                  <span className="font-semibold text-sm">{parseFloat(amount).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-[#697386]">You&apos;ll receive</span>
                  <span className="font-bold text-sm text-[#16A34A]">
                    ₦{estimatedFiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#697386]">Account</span>
                  <span className="font-mono text-sm">{accountNumber}</span>
                </div>
              </div>

              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#635BFF] hover:underline mb-4"
                >
                  View on Solscan
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <button
                onClick={onClose}
                className="w-full p-3.5 bg-[#635BFF] text-white border-none rounded-lg font-semibold text-sm cursor-pointer transition-all hover:bg-[#5449D6]"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
