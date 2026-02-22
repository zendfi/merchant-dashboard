 'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { wallet as walletApi } from '@/lib/api';
import { useNotification } from '@/lib/notifications';
import { getPasskeySignature, PasskeySignature } from '@/lib/webauthn';

type Step = 1 | 2 | 3 | 4;

interface DangerZoneProps {
  onModalToggle?: (open: boolean) => void;
}

export default function DangerZone({ onModalToggle }: DangerZoneProps = {}) {
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
      <div className="bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-200 dark:border-rose-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-white">lock</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Export Private Key</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
              Export your wallet&apos;s private key for backup or migration. This grants
              permanent access to your funds.{' '}
              <strong className="text-rose-500">
                Anyone with this key can steal your funds.
              </strong>
            </p>
            <button
              onClick={openModal}
              className="inline-flex items-center gap-2 bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              Export Private Key
            </button>
          </div>
        </div>
      </div>

      {/* Export Key Modal */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[99999] flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="bg-white dark:bg-[#1f162b] rounded-2xl shadow-2xl w-[90%] max-w-[500px] animate-[modalSlideUp_0.3s_ease-out] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step 1: Warning */}
            {currentStep === 1 && (
              <>
                <div className="p-5 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-rose-500">
                    Critical Security Warning
                  </h3>
                  <button
                    onClick={closeModal}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] text-rose-500">warning</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                      Please read carefully before proceeding
                    </p>
                  </div>

                  <div className="bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500 p-4 rounded-r-xl mb-6">
                    <h4 className="text-sm font-semibold text-rose-500 mb-2">
                      Risks of Exporting Your Private Key:
                    </h4>
                    <ul className="m-0 pl-5 text-slate-700 dark:text-slate-300 text-sm leading-relaxed space-y-1">
                      <li>
                        <strong>Permanent Access:</strong> Anyone with this key has full control forever
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
                      className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleContinueToAuth}
                      className="px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
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
                <div className="p-5 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verify Your Identity</h3>
                  <button
                    onClick={closeModal}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] text-primary">fingerprint</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Use your passkey to authorize this export
                    </p>
                  </div>

                  <div className="text-center my-8">
                    <div className="w-10 h-10 border-3 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Waiting for passkey authentication...
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
                <div className="p-5 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Final Confirmation</h3>
                  <button
                    onClick={closeModal}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="p-6">
                  <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-5 rounded-xl mb-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="mt-1 w-4 h-4 cursor-pointer accent-rose-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        I understand that exporting my private key is{' '}
                        <strong className="text-rose-500">extremely dangerous</strong> and that
                        anyone who obtains it can steal all my funds. I take full responsibility
                        for securing this key.
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleExport}
                      disabled={!confirmChecked || isExporting}
                      className="px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                <div className="p-5 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Private Key Exported</h3>
                  <button
                    onClick={closeModal}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] text-emerald-500">check_circle</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Store this securely. You won&apos;t see it again.
                    </p>
                  </div>

                  <div className="relative mb-4">
                    <textarea
                      readOnly
                      value={privateKey}
                      className="w-full h-[100px] p-3 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm text-slate-900 dark:text-white resize-none bg-slate-50 dark:bg-slate-800"
                    />
                    <button
                      onClick={copyPrivateKey}
                      className="absolute right-3 bottom-3 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      Copy
                    </button>
                  </div>

                  <div className="w-[200px] h-[200px] mx-auto mb-4 flex items-center justify-center">
                    {privateKey && (
                      <QRCodeSVG value={privateKey} size={200} />
                    )}
                  </div>

                  <div className="text-center mb-4 text-slate-500 dark:text-slate-400 text-sm">
                    This view will close in <span className="font-semibold text-primary">{countdown}</span> seconds.
                  </div>

                  <button
                    onClick={closeModal}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    I&apos;ve stored it safely
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)}

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
