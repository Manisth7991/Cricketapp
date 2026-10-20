import { env } from '../config/env';

/** yyyy-mm-dd interpreted in the app's UTC offset, start of day. */
export function startOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000${env.APP_UTC_OFFSET}`);
}

/** yyyy-mm-dd interpreted in the app's UTC offset, end of day (inclusive deadline). */
export function endOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999${env.APP_UTC_OFFSET}`);
}

/** Today's date (yyyy-mm-dd) in the app's UTC offset. */
export function todayIso(now = new Date()): string {
  const [sign, hh, mm] = [
    env.APP_UTC_OFFSET[0],
    env.APP_UTC_OFFSET.slice(1, 3),
    env.APP_UTC_OFFSET.slice(4, 6),
  ];
  const offsetMs = (Number(hh) * 60 + Number(mm)) * 60_000 * (sign === '-' ? -1 : 1);
  return new Date(now.getTime() + offsetMs).toISOString().slice(0, 10);
}

/** Convert a stored Date back to yyyy-mm-dd in the app's offset. */
export function toIsoDate(d: Date | undefined | null): string | undefined {
  return d ? todayIso(d) : undefined;
}
