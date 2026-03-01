'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMode } from '@/lib/mode-context';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import { auth } from '@/lib/api';

interface HeaderProps {
  onOpenWallet: () => void;
  onCreatePaymentLink?: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  activeTab: string;
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  transactions: 'Transactions',
  'payment-links': 'Payment Links',
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
        `You are now viewing ${newMode === 'test' ? 'Sandbox' : 'Live'} data.`,
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
    <header className="h-14 lg:h-16 shrink-0 px-3 lg:px-8 flex items-center justify-between border-b border-slate-100 dark:border-white/5 transition-all duration-250 relative z-10">
      {/* Mobile Menu Button — visible on tablet/small screens, hidden on mobile since bottom nav has "More" */}
      <button
        onClick={onToggleSidebar}
        className="sm:block lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors mr-2"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? (
          <span className="material-symbols-outlined text-[20px]">close</span>
        ) : (
          <span className="material-symbols-outlined text-[20px]">menu</span>
        )}
      </button>

      <div className="flex flex-col min-w-0 flex-1">
        {activeTab === 'overview' ? (
          <>
            <h2 className="text-base lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">Overview</h2>
            <p className="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Welcome back, here&apos;s what&apos;s happening today.
            </p>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="text-slate-400 dark:text-slate-500 font-semibold hidden sm:block">ZendFi</span>
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[14px] hidden sm:block">chevron_right</span>
            <span className="text-slate-900 dark:text-white font-bold text-sm lg:text-base truncate">{TAB_LABELS[activeTab] || activeTab}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 lg:gap-4 shrink-0 ml-2">
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

        {/* Mode Toggle — compact pill on mobile, full toggle on desktop */}
        <button
          onClick={() => handleModeChange(mode === 'live' ? 'test' : 'live')}
          className="lg:hidden flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border transition-all duration-250 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
        >
          <span className={`size-1.5 rounded-full ${mode === 'live' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className={mode === 'live' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
            {mode === 'live' ? 'Live' : 'Test'}
          </span>
        </button>
        <div className="hidden lg:flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => handleModeChange('live')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all duration-250 ${mode === 'live'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Live
          </button>
          <button
            onClick={() => handleModeChange('test')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-bold transition-all duration-250 ${mode === 'test'
              ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Sandbox
          </button>
        </div>

        {/* Wallet Button */}
        <button
          onClick={onOpenWallet}
          className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all duration-250 relative"
          title="Open Wallet"
        >
          <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          <span className="absolute top-1 right-1 size-2 bg-emerald-500 border-2 border-white dark:border-[#1f162b] rounded-full"></span>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all duration-250"
          title="Logout"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
}
