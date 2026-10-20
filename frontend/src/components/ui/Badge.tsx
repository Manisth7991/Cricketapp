import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeTone = 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'indigo' | 'orange';

const tones: Record<BadgeTone, string> = {
  green: 'bg-primary-50 text-primary-800 ring-primary-600/20',
  blue: 'bg-accent-50 text-accent-700 ring-accent-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  orange: 'bg-orange-50 text-orange-800 ring-orange-600/20',
};

export function Badge({
  tone = 'slate',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
