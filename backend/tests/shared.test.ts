import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  getAvailability,
  normalizePhone,
  otpCompleteSchema,
  indianMobileSchema,
  scheduleIssues,
  slugify,
  tournamentUpdateSchema,
} from '@playlocal/shared';

describe('shared domain rules', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('computes registration availability', () => {
    expect(
      getAvailability({
        status: 'pending_verification',
        registrationDeadline: future,
        maxTeams: 4,
        registeredCount: 0,
      }),
    ).toBe('unavailable');
    expect(
      getAvailability({
        status: 'published',
        registrationDeadline: past,
        maxTeams: 4,
        registeredCount: 0,
      }),
    ).toBe('closed');
    expect(
      getAvailability({
        status: 'published',
        registrationDeadline: future,
        maxTeams: 4,
        registeredCount: 3,
      }),
    ).toBe('open');
    expect(
      getAvailability({
        status: 'published',
        registrationDeadline: future,
        maxTeams: 4,
        registeredCount: 4,
        allowWaitlist: true,
      }),
    ).toBe('waitlist');
    expect(
      getAvailability({
        status: 'published',
        registrationDeadline: future,
        maxTeams: 4,
        registeredCount: 4,
        allowWaitlist: false,
      }),
    ).toBe('full');
  });

  it('validates schedule ordering', () => {
    expect(scheduleIssues({ startDate: '2026-11-10', endDate: '2026-11-09' })[0]?.path).toBe(
      'endDate',
    );
    expect(
      scheduleIssues({ startDate: '2026-11-10', registrationDeadline: '2026-11-11' })[0]?.path,
    ).toBe('registrationDeadline');
    expect(
      scheduleIssues({
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        registrationDeadline: '2026-11-10',
      }),
    ).toEqual([]);
  });

  it('normalises Indian phone numbers', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('098765 43210')).toBe('9876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  it('slugifies sport names', () => {
    expect(slugify('Kho-Kho')).toBe('kho-kho');
    expect(slugify('  Table Tennis ')).toBe('table-tennis');
  });

  it('computes haversine distance', () => {
    const jaipurToSikar = distanceKm(
      { lat: 26.9124, lng: 75.7873 },
      { lat: 27.6094, lng: 75.1399 },
    );
    expect(jaipurToSikar).toBeGreaterThan(95);
    expect(jaipurToSikar).toBeLessThan(105);
  });

  it('strips unknown keys (e.g. role) from signup input', () => {
    const parsed = otpCompleteSchema.parse({
      ticket: 'x'.repeat(30),
      name: 'Test User',
      role: 'admin',
    });
    expect('role' in parsed).toBe(false);
  });

  it('accepts only Indian mobile numbers for OTP', () => {
    expect(indianMobileSchema.parse('+91 98765 43210')).toBe('9876543210');
    expect(indianMobileSchema.safeParse('5876543210').success).toBe(false);
    expect(indianMobileSchema.safeParse('+14155550100').success).toBe(false);
  });

  it('partial update schema never injects defaults', () => {
    expect(tournamentUpdateSchema.parse({ description: 'x' })).toEqual({ description: 'x' });
  });
});
