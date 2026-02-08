'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMode } from '@/lib/mode-context';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import { auth } from '@/lib/api';

interface HeaderProps {
  onOpenWallet: () => void;
  onCreatePaymentLink: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  activeTab: string;
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  transactions: 'Transactions',
  'api-keys': 'API Keys',
  'session-keys': 'Session Keys',
  webhooks: 'Webhooks',
  profile: 'Profile',
};

export default function Header({ onOpenWallet, onToggleSidebar, sidebarOpen, activeTab }: HeaderProps) {
  const router = useRouter();
  const { mode, toggleMode } = useMode();
  const { merchant } = useMerchant();
  const { showNotification } = useNotification();

  const handleModeChange = (newMode: 'live' | 'test') => {
    if (mode !== newMode) {
      toggleMode();
      showNotification(
        'Mode Switched',
        `You are now viewing ${newMode === 'test' ? 'Devnet' : 'Mainnet'} data.`,
        'info'
      );
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <header className="h-20 shrink-0 px-4 lg:px-8 flex items-center justify-between bg-white/50 dark:bg-[#1f162b]/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-800/50">
      {/* Mobile Menu Button */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors mr-3"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? (
          <span className="material-symbols-outlined">close</span>
        ) : (
          <span className="material-symbols-outlined">menu</span>
        )}
      </button>

      <div className="flex flex-col">
        {activeTab === 'overview' ? (
          <>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Overview</h2>
            <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              Welcome back, here&apos;s what&apos;s happening today.
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 dark:text-slate-500 font-semibold">ZendFi</span>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[18px]">chevron_right</span>
            <span className="text-slate-900 dark:text-white font-bold text-base lg:text-lg">{TAB_LABELS[activeTab] || activeTab}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Docs Link */}
        <a 
          href="https://zendfi.tech/docs" 
          target="_blank"
          rel="noopener noreferrer"
          className="hidden xl:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">menu_book</span>
          <span>Docs</span>
        </a>

        {/* Mode Toggle */}
        <div className="hidden lg:flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          <button 
            onClick={() => handleModeChange('live')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              mode === 'live'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Mainnet
          </button>
          <button 
            onClick={() => handleModeChange('test')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              mode === 'test'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Devnet
          </button>
        </div>

        {/* Wallet Button */}
        <button
          onClick={onOpenWallet}
          className="p-2 text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-colors relative"
          title="Open Wallet"
        >
          <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          <span className="absolute top-2 right-2 size-2.5 bg-emerald-500 border-2 border-white dark:border-[#1f162b] rounded-full"></span>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-colors"
          title="Logout"
        >
          <span className="material-symbols-outlined text-[24px]">logout</span>
        </button>
      </div>
    </header>
  );
}
