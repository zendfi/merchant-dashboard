'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useMode } from '@/lib/mode-context';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import { auth } from '@/lib/api';

interface HeaderProps {
  onOpenWallet: () => void;
  onCreatePaymentLink: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function Header({ onOpenWallet, onCreatePaymentLink, onToggleSidebar, sidebarOpen }: HeaderProps) {
  const router = useRouter();
  const { mode, toggleMode } = useMode();
  const { merchant } = useMerchant();
  const { showNotification } = useNotification();

  const handleModeToggle = () => {
    toggleMode();
    const newMode = mode === 'live' ? 'test' : 'live';
    showNotification(
      'Mode Switched',
      `You are now viewing ${newMode === 'test' ? 'Test (Devnet)' : 'Live (Mainnet)'} data.`,
      'info'
    );
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      router.push('/login');
    } catch {
      // Redirect anyway
      router.push('/login');
    }
  };

  return (
    <header className="bg-[#0A2540] border-b border-white/10 px-4 md:px-8 h-[60px] flex justify-between items-center sticky top-0 z-[100] shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden bg-white/10 text-white border border-white/20 p-2 rounded-md cursor-pointer flex items-center justify-center transition-all hover:bg-white/15"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
        
        <Link href="/" className="text-lg md:text-xl font-bold text-white tracking-[-0.3px] no-underline">
          ZendFi
        </Link>
      </div>
      
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mode Toggle */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <span
            className={`text-[10px] md:text-xs font-semibold ${
              mode === 'test' ? 'text-white/80' : 'text-white/50'
            }`}
          >
            Test
          </span>
          <label className="relative inline-block w-8 md:w-9 h-[18px] md:h-5 cursor-pointer">
            <input
              type="checkbox"
              checked={mode === 'live'}
              onChange={handleModeToggle}
              className="opacity-0 w-0 h-0"
            />
            <span
              className={`absolute cursor-pointer inset-0 rounded-[20px] transition-all duration-200 ${
                mode === 'live' ? 'bg-[#00D924]' : 'bg-[#425466]'
              }`}
            >
              <span
                className={`absolute content-[''] h-3.5 md:h-4 w-3.5 md:w-4 left-0.5 bottom-0.5 bg-white rounded-full transition-all duration-200 ${
                  mode === 'live' ? 'translate-x-3 md:translate-x-4' : ''
                }`}
              />
            </span>
          </label>
          <span
            className={`text-[10px] md:text-xs font-semibold ${
              mode === 'live' ? 'text-white/80' : 'text-white/50'
            }`}
          >
            Live
          </span>
        </div>

        {/* Create Payment Link Button - Hidden on smallest screens */}
        <button
          onClick={onCreatePaymentLink}
          className="hidden sm:inline-flex bg-[#00D924] text-white border-none px-3 md:px-4 py-1.5 md:py-2 rounded-md text-[12px] md:text-[13px] font-semibold no-underline items-center gap-1.5 transition-all hover:bg-[#00C020]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="hidden md:inline">Create Link</span>
          <span className="md:hidden">Link</span>
        </button>

        {/* Wallet Button */}
        <button
          onClick={onOpenWallet}
          className="bg-white/10 text-white border border-white/20 p-[6px] md:p-[7px] rounded-md cursor-pointer flex items-center justify-center transition-all hover:bg-white/15 w-8 h-8 md:w-9 md:h-9 relative"
          title="Open Wallet"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="md:w-[22px] md:h-[22px]"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span className="absolute -top-[3px] -right-[3px] bg-[#00D924] text-white rounded-full w-3.5 h-3.5 md:w-4 md:h-4 text-[8px] md:text-[9px] font-bold flex items-center justify-center border-2 border-[#0A2540]">
            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24" className="md:w-3 md:h-3">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </span>
        </button>

        {/* Documentation Link - Hidden on mobile */}
        <a
          href="https://zendfi.tech/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex bg-[#635BFF] text-white border-none px-4 py-2 rounded-md text-[13px] font-semibold no-underline items-center gap-1.5 transition-all hover:bg-[#5449D6]"
        >
          Documentation
        </a>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="bg-white/10 text-white border border-white/20 px-2.5 md:px-3 py-1.5 rounded-md cursor-pointer text-[12px] md:text-[13px] font-semibold transition-all hover:bg-white/15"
        >
          <span className="hidden sm:inline">Logout</span>
          <svg className="sm:hidden w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
