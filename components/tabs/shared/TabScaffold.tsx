import { ReactNode } from 'react';

type Accent = 'primary' | 'emerald' | 'amber' | 'violet' | 'slate';

interface TabHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

interface StatTileProps {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: string;
  accent?: Accent;
}

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

const iconAccent: Record<Accent, string> = {
  primary: 'bg-primary/10 dark:bg-primary/20 text-primary',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
};

const hoverAccent: Record<Accent, string> = {
  primary: 'hover:border-primary/30',
  emerald: 'hover:border-emerald-200 dark:hover:border-emerald-900',
  amber: 'hover:border-amber-200 dark:hover:border-amber-900',
  violet: 'hover:border-violet-200 dark:hover:border-violet-900',
  slate: 'hover:border-slate-300 dark:hover:border-slate-600',
};

export function TabHeader({ title, subtitle, actions }: TabHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  note,
  icon,
  accent = 'slate',
}: StatTileProps) {
  return (
    <div
      className={`bg-white dark:bg-[#13131f] rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 ${hoverAccent[accent]}`}
    >
      {icon ? (
        <div className="mb-2">
          <span className={`inline-flex p-1.5 rounded-lg ${iconAccent[accent]}`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </span>
        </div>
      ) : null}
      <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      {note ? <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{note}</p> : null}
    </div>
  );
}

export function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return (
    <div className={`bg-white dark:bg-[#13131f] rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}
