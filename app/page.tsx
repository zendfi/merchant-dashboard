'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ModeProvider } from '@/lib/mode-context';
import { MerchantProvider } from '@/lib/merchant-context';
import { NotificationProvider } from '@/lib/notifications';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import WalletModal from '@/components/WalletModal';
import CreatePaymentLinkModal from '@/components/CreatePaymentLinkModal';
import OverviewTab from '@/components/tabs/OverviewTab';
import TransactionsTab from '@/components/tabs/TransactionsTab';
import ApiKeysTab from '@/components/tabs/ApiKeysTab';
import SessionKeysTab from '@/components/tabs/SessionKeysTab';
import WebhooksTab from '@/components/tabs/WebhooksTab';
import ProfileTab from '@/components/tabs/ProfileTab';

function DashboardContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUA = mobileRegex.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      const isTabletPortrait =
        window.innerWidth < 1024 && window.innerHeight > window.innerWidth;

      setIsMobile(isMobileUA || (isTouchDevice && isSmallScreen) || isTabletPortrait);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mobile Warning Overlay
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-[#FAFBFC] z-[10000] flex justify-center items-center p-4">
        <div className="bg-white rounded-lg border border-[#E3E8EE] p-8 max-w-[420px] w-full text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] animate-[slideUp_0.3s_ease-out]">
          <div className="text-[26px] font-bold text-[#635BFF] tracking-[-0.5px] mb-6">
            ZendFi
          </div>

          <div className="w-14 h-14 mx-auto mb-5 bg-[#FAFBFC] border border-[#E3E8EE] rounded-xl flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#635BFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-7 h-7"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-[#0A2540] mb-2 tracking-[-0.3px]">
            Desktop Required
          </h2>
          <p className="text-[#425466] text-sm leading-relaxed mb-5">
            The Merchant Dashboard is designed for desktop and tablet screens to provide you
            with the best experience.
          </p>

          <div className="inline-flex items-center gap-1.5 bg-[#F0F4FF] border border-[#D1DBFF] rounded-md px-3.5 py-2 mb-5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#635BFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
            </svg>
            <span className="text-[13px] font-semibold text-[#635BFF]">
              Switch to a larger screen
            </span>
          </div>

          <ul className="text-left my-5 mx-0 p-0 bg-transparent">
            {[
              'Complete analytics & insights',
              'Transaction history & details',
              'API key management',
              'Wallet & settlement controls',
            ].map((feature) => (
              <li
                key={feature}
                className="list-none py-2 text-[#0A2540] text-[13px] font-medium flex items-center gap-2.5 border-b border-[#FAFBFC] last:border-b-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00D924"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 flex-shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-[#E3E8EE]">
            <p className="text-xs text-[#9BA5B7] m-0">
              Access your dashboard from a desktop computer or tablet in landscape mode (minimum
              768px width).
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onViewAllTransactions={() => setActiveTab('transactions')} />;
      case 'transactions':
        return <TransactionsTab />;
      case 'api-keys':
        return <ApiKeysTab />;
      case 'session-keys':
        return <SessionKeysTab />;
      case 'webhooks':
        return <WebhooksTab />;
      case 'profile':
        return <ProfileTab onSwitchTab={handleTabChange} />;
      default:
        return <OverviewTab onViewAllTransactions={() => setActiveTab('transactions')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <Header 
        onOpenWallet={() => setShowWalletModal(true)} 
        onCreatePaymentLink={() => setShowPaymentLinkModal(true)}
      />

      <div className="flex min-h-[calc(100vh-60px)]">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <main className="flex-1 overflow-x-auto">
          <div className="max-w-[1600px] mx-auto p-6 px-7">{renderTab()}</div>
        </main>
      </div>

      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
      <CreatePaymentLinkModal isOpen={showPaymentLinkModal} onClose={() => setShowPaymentLinkModal(false)} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp {
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
    </div>
  );
}

export default function DashboardPage() {
  return (
    <NotificationProvider>
      <ModeProvider>
        <MerchantProvider>
          <DashboardContent />
        </MerchantProvider>
      </ModeProvider>
    </NotificationProvider>
  );
}
