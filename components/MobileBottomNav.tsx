'use client';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenMore: () => void;
}

const PRIMARY_NAV = [
  { id: 'overview',       icon: 'dashboard',  label: 'Home'     },
  { id: 'transactions',   icon: 'payments',   label: 'Payments' },
  { id: 'payment-links',  icon: 'link',       label: 'Links'    },
  { id: 'earn',           icon: 'savings',    label: 'Earn'     },
];

// tabs that live only in the sidebar; highlight "more" when one is active
const SECONDARY_TABS = new Set(['shop','customers','api-keys','webhooks','support','profile','session-keys']);

export default function MobileBottomNav({ activeTab, onTabChange, onOpenMore }: MobileBottomNavProps) {
  const moreActive = SECONDARY_TABS.has(activeTab);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[190] bg-white dark:bg-[#191022] border-t border-slate-200 dark:border-slate-800 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {PRIMARY_NAV.map(item => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              isActive
                ? 'text-primary dark:text-purple-400'
                : 'text-slate-500 dark:text-slate-400 active:text-primary'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px] leading-none"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}

      {/* More button → opens sidebar */}
      <button
        onClick={onOpenMore}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
          moreActive
            ? 'text-primary dark:text-purple-400'
            : 'text-slate-500 dark:text-slate-400 active:text-primary'
        }`}
      >
        <span
          className="material-symbols-outlined text-[22px] leading-none"
          style={moreActive ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          grid_view
        </span>
        <span className={`text-[10px] font-medium leading-none ${moreActive ? 'font-semibold' : ''}`}>
          More
        </span>
        {moreActive && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
        )}
      </button>
    </nav>
  );
}
