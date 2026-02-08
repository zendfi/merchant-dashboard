'use client';

import { useEffect } from 'react';
import { useMerchant } from '@/lib/merchant-context';
import Image from 'next/image';
import Link from 'next/link';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const mainNavItems = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'transactions', label: 'Transactions', icon: 'payments' },
  { id: 'api-keys', label: 'API Keys', icon: 'vpn_key' },
  { id: 'webhooks', label: 'Webhooks', icon: 'webhook' },
  // { id: 'session-keys', label: 'Reports', icon: 'analytics' },
];

const settingsNavItems = [
  { id: 'profile', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose }: SidebarProps) {
  const { merchant } = useMerchant();

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
          className="fixed inset-0 bg-black/50 z-[150] lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-[200]
        w-64 bg-white dark:bg-[#1f162b] border-r border-slate-200 dark:border-slate-800 
        flex flex-col shrink-0 transition-all duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3">
             <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Zendfi Logo"
                width={120}
                height={32}
                className="h-8 w-auto filter hue-rotate-[19deg] dark:hue-rotate-[13deg] brightness-110"
                priority
              />
            </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 flex flex-col gap-1 overflow-y-auto py-4">
          {mainNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                onClose();
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors group ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span 
                className="material-symbols-outlined group-hover:scale-110 transition-transform"
                style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className={`text-sm ${activeTab === item.id ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          {settingsNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                onClose();
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
          
          {/* User Profile */}
          <div className="mt-4 flex items-center gap-3 px-3">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              {merchant?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{merchant?.name || 'Merchant'}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Admin</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
