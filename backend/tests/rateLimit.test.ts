import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, nextPhone } from './helpers';

describe('rate limiting', () => {
  beforeAll(() => {
    process.env.RATE_LIMIT_IN_TESTS = 'true';
  });
  afterAll(() => {
    delete process.env.RATE_LIMIT_IN_TESTS;
  });

  it('returns 429 after too many failed admin logins', async () => {
    const a = agent();
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (
        await a.post('/api/auth/admin/login', { identifier: 'x@y.dev', password: 'wrong-pass1' })
      ).status;
    }
    expect(last).toBe(429);
  });

  it('caps OTP requests per IP across different numbers (SMS-pumping defence)', async () => {
    const a = agent();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await a.post('/api/auth/otp/request', { phone: nextPhone() })).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
