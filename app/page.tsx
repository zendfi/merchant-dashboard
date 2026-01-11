'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ModeProvider } from '@/lib/mode-context';
import { MerchantProvider, useMerchant } from '@/lib/merchant-context';
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
  const { merchant, isLoading, error } = useMerchant();
  const [activeTab, setActiveTab] = useState('overview');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth check - redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !merchant && error) {
      router.push('/login');
    }
  }, [isLoading, merchant, error, router]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#697386]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!merchant) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#697386]">Redirecting to login...</p>
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
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <div className="flex min-h-[calc(100vh-60px)]">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={(tab) => {
            handleTabChange(tab);
            setSidebarOpen(false);
          }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-x-auto w-full">
          <div className="max-w-[1600px] mx-auto p-4 md:p-6 md:px-7">{renderTab()}</div>
        </main>
      </div>

      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
      <CreatePaymentLinkModal isOpen={showPaymentLinkModal} onClose={() => setShowPaymentLinkModal(false)} />
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
