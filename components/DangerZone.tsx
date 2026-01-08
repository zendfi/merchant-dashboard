'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { wallet as walletApi } from '@/lib/api';
import { useNotification } from '@/lib/notifications';
import { getPasskeySignature, PasskeySignature } from '@/lib/webauthn';

type Step = 1 | 2 | 3 | 4;

export default function DangerZone() {
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [passkeySignature, setPasskeySignature] = useState<PasskeySignature | null>(null);

  const openModal = () => {
    setShowModal(true);
    setCurrentStep(1);
    setConfirmChecked(false);
    setPrivateKey('');
    setPasskeySignature(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentStep(1);
    setConfirmChecked(false);
    setPrivateKey('');
    setPasskeySignature(null);
    setCountdown(60);
  };

  const handleContinueToAuth = async () => {
    setCurrentStep(2);
    setIsAuthenticating(true);

    try {
      // Authenticate with passkey
      const signature = await getPasskeySignature({
        to_address: 'export',
        amount: 0,
        token: 'EXPORT',
      });

      if (!signature) {
        throw new Error('Authentication was cancelled');
      }

      setPasskeySignature(signature);
      setCurrentStep(3);
    } catch (error) {
      showNotification(
        'Authentication Failed',
        error instanceof Error ? error.message : 'Failed to authenticate',
        'error'
      );
      closeModal();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleExport = async () => {
    if (!confirmChecked || !passkeySignature) return;

    setIsExporting(true);

    try {
      const result = await walletApi.exportPrivateKey(passkeySignature);
      setPrivateKey(result.private_key_base58);
      setCurrentStep(4);

      // Start countdown
      let seconds = 60;
      const interval = setInterval(() => {
        seconds--;
        setCountdown(seconds);
        if (seconds <= 0) {
          clearInterval(interval);
          closeModal();
        }
      }, 1000);
    } catch (error) {
      showNotification(
        'Export Failed',
        error instanceof Error ? error.message : 'Failed to export private key',
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const copyPrivateKey = () => {
    navigator.clipboard.writeText(privateKey).then(() => {
      showNotification('Copied!', 'Private key copied to clipboard', 'success');
    });
  };

  return (
    <>
      {/* Danger Zone Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1F36] mb-1">Danger Zone</h2>
            <p className="text-[#697386] text-sm">Irreversible and sensitive operations</p>
          </div>
        </div>

        <div className="bg-[#FEF0EE] border-2 border-[#E25950] rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#E25950] rounded-xl flex items-center justify-center">
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[#1A1F36] mb-2">Export Private Key</h3>
              <p className="text-[#697386] text-sm leading-relaxed mb-4">
                Export your wallet&apos;s private key for backup or migration. This grants
                permanent access to your funds.{' '}
                <strong className="text-[#E25950]">
                  Anyone with this key can steal your funds.
                </strong>
              </p>
              <button
                onClick={openModal}
                className="bg-[#E25950] text-white border-none px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:bg-[#D14942]"
              >
                Export Private Key
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Key Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[50000] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="bg-white rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] w-[90%] max-w-[500px] animate-[modalSlideUp_0.3s_ease-out] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step 1: Warning */}
            {currentStep === 1 && (
              <>
                <div className="p-4 px-6 border-b border-[#e5e7eb] flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#E25950] m-0">
                    Critical Security Warning
                  </h3>
                  <button
                    onClick={closeModal}
                    className="bg-transparent border-none text-2xl leading-none text-[#6b7280] cursor-pointer p-1 hover:text-[#374151]"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#FEF0EE] rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg width="32" height="32" fill="none" stroke="#E25950" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <p className="text-[#697386] text-[15px] mt-2">
                      Please read carefully before proceeding
                    </p>
                  </div>

                  <div className="bg-[#FEF0EE] border-l-4 border-[#E25950] p-4 rounded-lg mb-6">
                    <h3 className="text-sm font-semibold text-[#E25950] mb-2">
                      Risks of Exporting Your Private Key:
                    </h3>
                    <ul className="m-0 pl-5 text-[#1A1F36] text-[13px] leading-relaxed">
                      <li>
                        <strong>Permanent Access:</strong> Anyone with this key has full control
                        forever
                      </li>
                      <li>
                        <strong>Cannot Be Revoked:</strong> Once exposed, you cannot undo it
                      </li>
                      <li>
                        <strong>Phishing Risk:</strong> Never share this key with anyone
                      </li>
                    </ul>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-white text-[#635BFF] border border-[#E3E8EE] hover:bg-[#F6F9FC]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContinueToAuth}
                      className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-[#E25950] text-white border-none"
                    >
                      I Understand, Continue →
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Passkey Authentication */}
            {currentStep === 2 && (
              <>
                <div className="p-4 px-6 border-b border-[#e5e7eb] flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#111827] m-0">Verify Your Identity</h3>
                  <button
                    onClick={closeModal}
                    className="bg-transparent border-none text-2xl leading-none text-[#6b7280] cursor-pointer p-1 hover:text-[#374151]"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#EEF2FF] rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg width="32" height="32" fill="none" stroke="#5B6EE8" strokeWidth="2">
                        <path d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-7a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-[#697386] text-[15px]">
                      Use your passkey to authorize this export
                    </p>
                  </div>

                  <div className="text-center my-8">
                    <div className="w-10 h-10 border-[3px] border-[#E3E8EE] border-t-[#5B6EE8] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#697386] text-sm">
                      Waiting for passkey authentication...
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-white text-[#635BFF] border border-[#E3E8EE] hover:bg-[#F6F9FC]"
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Final Confirmation */}
            {currentStep === 3 && (
              <>
                <div className="p-4 px-6 border-b border-[#e5e7eb] flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#111827] m-0">Final Confirmation</h3>
                  <button
                    onClick={closeModal}
                    className="bg-transparent border-none text-2xl leading-none text-[#6b7280] cursor-pointer p-1 hover:text-[#374151]"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6">
                  <div className="bg-[#FEF0EE] border border-[#E25950] p-5 rounded-lg mb-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[#1A1F36] text-sm leading-relaxed">
                        I understand that exporting my private key is{' '}
                        <strong className="text-[#E25950]">extremely dangerous</strong> and that
                        anyone who obtains it can steal all my funds. I take full responsibility
                        for securing this key.
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-white text-[#635BFF] border border-[#E3E8EE] hover:bg-[#F6F9FC]"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={!confirmChecked || isExporting}
                      className={`px-4 py-2 rounded-md text-[13px] font-semibold transition-all bg-[#E25950] text-white border-none ${
                        !confirmChecked || isExporting
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      {isExporting ? 'Exporting...' : 'Export Private Key'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Display Key */}
            {currentStep === 4 && (
              <>
                <div className="p-4 px-6 border-b border-[#e5e7eb] flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#111827] m-0">Private Key Exported</h3>
                  <button
                    onClick={closeModal}
                    className="bg-transparent border-none text-2xl leading-none text-[#6b7280] cursor-pointer p-1 hover:text-[#374151]"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#E6F7ED] rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg width="32" height="32" fill="none" stroke="#00D66C" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="text-[#697386] text-[15px]">
                      Store this securely. You won&apos;t see it again.
                    </p>
                  </div>

                  <div className="relative mb-3">
                    <textarea
                      readOnly
                      value={privateKey}
                      className="w-full h-[100px] p-3 border border-[#E3E8EE] rounded-lg font-mono text-[13px] text-[#1A1F36] resize-none bg-[#FAFBFC]"
                    />
                    <button
                      onClick={copyPrivateKey}
                      className="absolute right-2 bottom-2 px-2.5 py-1 text-xs font-semibold bg-white text-[#635BFF] border border-[#E3E8EE] rounded-md cursor-pointer hover:bg-[#F6F9FC]"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="w-[200px] h-[200px] mx-auto mb-3 flex items-center justify-center">
                    {privateKey && (
                      <QRCodeSVG value={privateKey} size={200} />
                    )}
                  </div>

                  <div className="text-center mb-3 text-[#697386]">
                    This view will close in <span className="font-semibold">{countdown}</span>{' '}
                    seconds.
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={closeModal}
                      className="w-full px-4 py-2.5 rounded-md text-[13px] font-semibold cursor-pointer transition-all bg-[#635BFF] text-white border-none hover:bg-[#5449D6]"
                    >
                      I&apos;ve stored it safely
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}} />
    </>
  );
}
