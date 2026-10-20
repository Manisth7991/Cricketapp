import { Link } from 'react-router';
import { config } from '@/lib/config';
import { cn } from '@/utils/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#059669" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#fff" strokeWidth="5" />
      <path
        d="M21 22c5 4 5 16 0 20M43 22c-5 4-5 16 0 20"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  to = '/',
  className,
  suffix,
}: {
  to?: string;
  className?: string;
  suffix?: string;
}) {
  return (
    <Link
      to={to}
      className={cn('flex items-center gap-2 font-bold tracking-tight text-ink', className)}
      aria-label={`${config.appName} home`}
    >
      <LogoMark />
      <span className="text-lg">
        {config.appName}
        {suffix && (
          <span className="ml-1.5 rounded-md bg-ink px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-white uppercase">
            {suffix}
          </span>
        )}
      </span>
    </Link>
  );
}
