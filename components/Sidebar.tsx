'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const mainNavItems = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: (
      <svg viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: (
      <svg viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
      </svg>
    ),
  },
  {
    id: 'session-keys',
    label: 'Session Keys',
    icon: (
      <svg viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
];

const settingsNavItems = [
  {
    id: 'webhooks',
    label: 'Webhooks',
    icon: (
      <svg viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
];

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }: SidebarProps) {
  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[150] md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <nav className={`
        fixed md:sticky top-[60px] left-0 h-[calc(100vh-60px)] z-[200]
        w-[260px] md:w-[220px] bg-[#F6F9FC] border-r border-[#E3E8EE] py-4
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        overflow-y-auto
      `}>
        {/* Mobile Header */}
        <div className="md:hidden px-4 pb-4 mb-2 border-b border-[#E3E8EE]">
          <p className="text-[11px] font-semibold text-[#9BA5B7] uppercase tracking-wide">Navigation</p>
        </div>
        
        <ul className="list-none p-0 m-0">
        {mainNavItems.map((item) => (
          <li key={item.id} className="mx-2 my-0.5">
            <button
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md w-full text-left text-[13px] font-medium transition-all cursor-pointer border-none bg-transparent ${
                activeTab === item.id
                  ? 'bg-[#EEF2FF] text-[#635BFF] font-semibold'
                  : 'text-[#425466] hover:bg-[#EEF2FF] hover:text-[#0A2540]'
              }`}
            >
              <span className="w-4 h-4 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-current [&>svg]:fill-none [&>svg]:stroke-2">
                {item.icon}
              </span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-3.5 mt-4 mb-2 text-[10px] font-bold text-[#9BA5B7] uppercase tracking-[0.6px]">
        Settings
      </div>

      <ul className="list-none p-0 m-0">
        {settingsNavItems.map((item) => (
          <li key={item.id} className="mx-2 my-0.5">
            <button
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md w-full text-left text-[13px] font-medium transition-all cursor-pointer border-none bg-transparent ${
                activeTab === item.id
                  ? 'bg-[#EEF2FF] text-[#635BFF] font-semibold'
                  : 'text-[#425466] hover:bg-[#EEF2FF] hover:text-[#0A2540]'
              }`}
            >
              <span className="w-4 h-4 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-current [&>svg]:fill-none [&>svg]:stroke-2">
                {item.icon}
              </span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
    </>
  );
}
