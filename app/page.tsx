'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ModeProvider } from '@/lib/mode-context';
import { MerchantProvider, useMerchant } from '@/lib/merchant-context';
import { NotificationProvider } from '@/lib/notifications';
import { CurrencyProvider } from '@/lib/currency-context';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import WalletModal from '@/components/WalletModal';
import CreatePaymentLinkModal from '@/components/CreatePaymentLinkModal';
import LoadingScreen from '@/components/LoadingScreen';
import OverviewTab from '@/components/tabs/OverviewTab';
import TransactionsTab from '@/components/tabs/TransactionsTab';
import ApiKeysTab from '@/components/tabs/ApiKeysTab';
import WebhooksTab from '@/components/tabs/WebhooksTab';
import ProfileTab from '@/components/tabs/ProfileTab';

function DashboardContent() {
  const router = useRouter();
  const { merchant, isLoading, error } = useMerchant();
  const [activeTab, setActiveTab] = useState('overview');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !merchant && error) {
      router.push('/login');
    }
  }, [isLoading, merchant, error, router]);

  // Track loading-to-ready transition for fade-out
  const [showLoading, setShowLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure minimum loading screen visibility
      const fadeTimer = setTimeout(() => {
        setFadeOut(true);
        const removeTimer = setTimeout(() => setShowLoading(false), 400);
        return () => clearTimeout(removeTimer);
      }, 600);
      return () => clearTimeout(fadeTimer);
    }
  }, [isLoading]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show loading screen while checking auth
  if (isLoading && showLoading) {
    return <LoadingScreen />;
  }

  // Redirect if not authenticated
  if (!merchant) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onViewAllTransactions={() => setActiveTab('transactions')} />;
      case 'transactions':
        return <TransactionsTab onCreatePayment={() => setShowPaymentLinkModal(true)} />;
      case 'api-keys':
        return <ApiKeysTab />;
      case 'webhooks':
        return <WebhooksTab />;
      case 'profile':
        return <ProfileTab onSwitchTab={handleTabChange} />;
      default:
        return <OverviewTab onViewAllTransactions={() => setActiveTab('transactions')} />;
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white h-screen flex overflow-hidden">
      {/* Loading screen fade-out overlay */}
      {showLoading && (
        <div className={fadeOut ? 'loading-fadeout' : ''}>
          <LoadingScreen />
        </div>
      )}

      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          handleTabChange(tab);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col h-screen overflow-hidden p-2 lg:p-3 transition-all duration-300">
        <div className="flex-1 bg-white dark:bg-[#1f162b] rounded-[24px] shadow-sm border border-slate-200/50 dark:border-white/5 flex flex-col overflow-hidden relative">
          <Header
            onOpenWallet={() => setShowWalletModal(true)}
            onCreatePaymentLink={() => setShowPaymentLinkModal(true)}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            activeTab={activeTab}
          />

          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6 pb-20 scrollbar-hide">
            <div className="max-w-7xl mx-auto">
              {renderTab()}
            </div>
          </div>
        </div>
      </main>

      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
      <CreatePaymentLinkModal isOpen={showPaymentLinkModal} onClose={() => setShowPaymentLinkModal(false)} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <NotificationProvider>
      <ModeProvider>
        <CurrencyProvider>
          <MerchantProvider>
            <DashboardContent />
          </MerchantProvider>
        </CurrencyProvider>
      </ModeProvider>
    </NotificationProvider>
  );
}
