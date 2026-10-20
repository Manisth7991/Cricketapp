import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';
import { sendOtpSms } from '../src/services/smsService';

const original = { ...env };
afterEach(() => {
  Object.assign(env, original);
  vi.restoreAllMocks();
});

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('SMS providers (request format, no real SMS sent)', () => {
  it('MSG91: POSTs to the OTP API with template, 91-prefixed mobile, otp and authkey', async () => {
    Object.assign(env, {
      SMS_PROVIDER: 'msg91',
      MSG91_AUTH_KEY: 'test-auth-key',
      MSG91_TEMPLATE_ID: 'tmpl123',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ type: 'success' }));
    await sendOtpSms('9876543210', '123456');
    const [url, init] = fetchSpy.mock.calls[0]!;
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe('https://control.msg91.com/api/v5/otp');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      template_id: 'tmpl123',
      mobile: '919876543210',
      otp: '123456',
      otp_expiry: '5',
    });
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authkey).toBe('test-auth-key');
  });

  it('MSG91: surfaces provider errors', async () => {
    Object.assign(env, { SMS_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_TEMPLATE_ID: 't' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ type: 'error', message: 'Invalid authkey' }, 401),
    );
    await expect(sendOtpSms('9876543210', '123456')).rejects.toThrow(/MSG91 401: Invalid authkey/);
  });

  it('Twilio: POSTs a form to Messages.json with basic auth, +91 number and the OTP text', async () => {
    Object.assign(env, {
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'secret',
      TWILIO_FROM: '+15005550006',
      TWILIO_MESSAGING_SERVICE_SID: undefined,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ sid: 'SM1' }, 201));
    await sendOtpSms('9876543210', '654321');
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('AC123:secret').toString('base64')}`,
    );
    const form = new URLSearchParams(String(init?.body));
    expect(form.get('To')).toBe('+919876543210');
    expect(form.get('From')).toBe('+15005550006');
    expect(form.get('Body')).toMatch(/^654321 is your PlayLocal verification code/);
  });

  it('Twilio: prefers a Messaging Service SID when configured', async () => {
    Object.assign(env, {
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 's',
      TWILIO_FROM: undefined,
      TWILIO_MESSAGING_SERVICE_SID: 'MG1',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({}, 201));
    await sendOtpSms('9876543210', '111111');
    const form = new URLSearchParams(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(form.get('MessagingServiceSid')).toBe('MG1');
    expect(form.get('From')).toBeNull();
  });

  it('an SMS failure returns a friendly 502 and is not reported as success', async () => {
    const { agent, nextPhone } = await import('./helpers');
    Object.assign(env, { SMS_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_TEMPLATE_ID: 't' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const res = await agent().post('/api/auth/otp/request', { phone: nextPhone() });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('OTP_SEND_FAILED');
    expect(res.body.data).toBeUndefined();
  });
});
