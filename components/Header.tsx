'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useMode } from '@/lib/mode-context';
import { useMerchant } from '@/lib/merchant-context';
import { useNotification } from '@/lib/notifications';
import { auth } from '@/lib/api';

interface HeaderProps {
  onOpenWallet: () => void;
}

export default function Header({ onOpenWallet }: HeaderProps) {
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
    <header className="bg-[#0A2540] border-b border-white/10 px-8 h-[60px] flex justify-between items-center sticky top-0 z-[100] shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
      <Link href="/" className="text-xl font-bold text-white tracking-[-0.3px] no-underline">
        ZendFi
      </Link>
      
      <div className="flex items-center gap-3">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${
              mode === 'test' ? 'text-white/80' : 'text-white/50'
            }`}
          >
            Test
          </span>
          <label className="relative inline-block w-9 h-5 cursor-pointer">
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
                className={`absolute content-[''] h-4 w-4 left-0.5 bottom-0.5 bg-white rounded-full transition-all duration-200 ${
                  mode === 'live' ? 'translate-x-4' : ''
                }`}
              />
            </span>
          </label>
          <span
            className={`text-xs font-semibold ${
              mode === 'live' ? 'text-white/80' : 'text-white/50'
            }`}
          >
            Live
          </span>
        </div>

        {/* Wallet Button */}
        <button
          onClick={onOpenWallet}
          className="bg-white/10 text-white border border-white/20 p-[7px] rounded-md cursor-pointer flex items-center justify-center transition-all hover:bg-white/15 w-9 h-9 relative"
          title="Open Wallet"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span className="absolute -top-[3px] -right-[3px] bg-[#00D924] text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center border-2 border-[#0A2540]">
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </span>
        </button>

        {/* Documentation Link */}
        <a
          href="https://zendfi.tech/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#635BFF] text-white border-none px-4 py-2 rounded-md text-[13px] font-semibold no-underline inline-flex items-center gap-1.5 transition-all hover:bg-[#5449D6]"
        >
          Documentation
        </a>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="bg-white/10 text-white border border-white/20 px-3 py-1.5 rounded-md cursor-pointer text-[13px] font-semibold transition-all hover:bg-white/15"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
