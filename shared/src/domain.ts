import type { TournamentStatus } from './constants';
import type { RegistrationAvailability } from './types';

interface AvailabilityInput {
  status: TournamentStatus;
  registrationDeadline?: Date | string | null;
  maxTeams?: number | null;
  registeredCount?: number;
  allowWaitlist?: boolean;
}

/**
 * Single source of truth for "can a team register right now?" — used by the API
 * (to enforce) and by the UI (to render the CTA). Deadline is an absolute instant.
 */
export function getAvailability(
  t: AvailabilityInput,
  now: Date = new Date(),
): RegistrationAvailability {
  if (t.status !== 'published') return 'unavailable';
  if (!t.registrationDeadline || new Date(t.registrationDeadline).getTime() < now.getTime())
    return 'closed';
  const max = t.maxTeams ?? 0;
  if ((t.registeredCount ?? 0) < max) return 'open';
  return t.allowWaitlist ? 'waitlist' : 'full';
}

export function isVerifiedStatus(status: TournamentStatus): boolean {
  return status === 'published' || status === 'completed';
}

/** Great-circle distance in km (haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
