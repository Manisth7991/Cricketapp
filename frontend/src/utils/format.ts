import { config } from '@/lib/config';

const dateFmt = new Intl.DateTimeFormat(config.locale, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: config.timeZone,
});
const shortDateFmt = new Intl.DateTimeFormat(config.locale, {
  day: 'numeric',
  month: 'short',
  timeZone: config.timeZone,
});
const dateTimeFmt = new Intl.DateTimeFormat(config.locale, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: config.timeZone,
});
const moneyFmt = new Intl.NumberFormat(config.locale, {
  style: 'currency',
  currency: config.currency,
  maximumFractionDigits: 0,
});
const compactMoneyFmt = new Intl.NumberFormat(config.locale, {
  style: 'currency',
  currency: config.currency,
  notation: 'compact',
  maximumFractionDigits: 1,
});
const relFmt = new Intl.RelativeTimeFormat(config.locale, { numeric: 'auto' });

/** yyyy-mm-dd → Date at local noon (avoids off-by-one when formatting calendar dates). */
function fromIsoDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

export const formatDate = (v?: string) => (v ? dateFmt.format(fromIsoDate(v)) : '—');
export const formatShortDate = (v?: string) => (v ? shortDateFmt.format(fromIsoDate(v)) : '—');
export const formatDateTime = (v?: string) => (v ? dateTimeFmt.format(new Date(v)) : '—');

export function formatDateRange(start?: string, end?: string): string {
  if (!start) return 'Dates TBA';
  if (!end || end === start) return formatDate(start);
  return `${formatShortDate(start)} – ${formatDate(end)}`;
}

export const formatMoney = (n?: number) => (n ? moneyFmt.format(n) : 'Free');
export const formatPrize = (n?: number) => (n ? compactMoneyFmt.format(n) : '—');

export function formatDistance(km?: number): string | undefined {
  if (km === undefined) return undefined;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return relFmt.format(Math.round(diff / secs), unit);
  }
  return 'just now';
}

/** Human countdown to a deadline, e.g. "Closes in 3 days". */
export function deadlineLabel(iso?: string): string | undefined {
  if (!iso) return undefined;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'Registration closed';
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  if (days < 14) return `Closes in ${days} days`;
  return `Closes ${formatShortDate(iso)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Today's date (yyyy-mm-dd) in the app time zone — for date input `min`. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(new Date());
}

/** ISO instant → yyyy-mm-dd in the app time zone (for date inputs). */
export function toDateInput(iso?: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(new Date(iso));
}

/** "1 team", "3 teams". */
export const plural = (n: number, word: string, pluralWord = `${word}s`) =>
  `${n} ${n === 1 ? word : pluralWord}`;
