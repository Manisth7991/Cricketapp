import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { agent, createAdminAgent, getApp, nextPhone, signup } from './helpers';
import { OtpChallenge, User } from '../src/models';

const requestOtp = (a: ReturnType<typeof agent>, phone: string) =>
  a.post('/api/auth/otp/request', { phone });
/** Skip the 30s resend cooldown (e.g. logging in right after signing up). */
const allowResend = (phone: string) =>
  OtpChallenge.updateOne({ phone }, { lastSentAt: new Date(Date.now() - 60_000) });

describe('phone OTP sign-up', () => {
  it('new number: request → verify → ticket → complete creates the account and logs in', async () => {
    const a = agent();
    const phone = nextPhone();
    const req = await requestOtp(a, `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`); // formatted input is normalised
    expect(req.status).toBe(200);
    expect(req.body.data).toMatchObject({ expiresIn: 300, resendIn: 30 });
    expect(req.body.data.devCode).toMatch(/^\d{6}$/);

    // The code is never stored in plain text.
    const stored = await OtpChallenge.findOne({ phone }).lean();
    expect(stored?.codeHash).not.toContain(req.body.data.devCode);

    const ver = await a.post('/api/auth/otp/verify', { phone, code: req.body.data.devCode });
    expect(ver.status).toBe(200);
    expect(ver.body.data.status).toBe('new_user');
    expect(ver.headers['set-cookie']).toBeUndefined(); // not logged in until the profile is complete
    expect((await a.get('/api/auth/me')).status).toBe(401);

    const done = await a.post('/api/auth/otp/complete', {
      ticket: ver.body.data.ticket,
      name: 'Ravi Kumar',
      email: 'Ravi@Test.dev',
      role: 'admin',
    });
    expect(done.status).toBe(201);
    expect(done.body.data.user).toMatchObject({
      name: 'Ravi Kumar',
      phone,
      email: 'ravi@test.dev',
      role: 'user',
    }); // client role ignored
    const cookie = done.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/pl_session=.*HttpOnly/i);
    expect((await a.get('/api/auth/me')).body.data.user.phone).toBe(phone);

    const dbUser = await User.findOne({ phone }).select('+passwordHash').lean();
    expect(dbUser?.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(dbUser?.passwordHash).toBeUndefined();
  });

  it('existing number: verify logs straight in', async () => {
    const { phone, user } = await signup({ name: 'Existing Player' });
    await allowResend(phone);
    const a = agent();
    const req = await requestOtp(a, phone);
    const ver = await a.post('/api/auth/otp/verify', { phone, code: req.body.data.devCode });
    expect(ver.body.data).toMatchObject({
      status: 'logged_in',
      user: { id: user.id, name: 'Existing Player' },
    });
    expect((await a.get('/api/auth/me')).status).toBe(200);
  });

  it('accepts only valid Indian mobile numbers', async () => {
    for (const bad of ['12345', '5123456789', '+1 415 555 0100', 'abcdefghij']) {
      const res = await requestOtp(agent(), bad);
      expect(res.status).toBe(400);
      expect(res.body.errors[0].path).toBe('phone');
    }
  });

  it('rejects a wrong code, counts attempts and locks after the limit', async () => {
    const a = agent();
    const phone = nextPhone();
    const { devCode } = (await requestOtp(a, phone)).body.data;
    const wrong = devCode === '000000' ? '111111' : '000000';

    const first = await a.post('/api/auth/otp/verify', { phone, code: wrong });
    expect(first.status).toBe(400);
    expect(first.body).toMatchObject({
      code: 'OTP_INVALID',
      message: 'Incorrect code. 4 attempts left.',
    });
    for (let i = 0; i < 3; i++) await a.post('/api/auth/otp/verify', { phone, code: wrong });
    const fifth = await a.post('/api/auth/otp/verify', { phone, code: wrong });
    expect(fifth.status).toBe(429);
    expect(fifth.body.code).toBe('OTP_TOO_MANY_ATTEMPTS');

    // Even the correct code no longer works — a new OTP is required.
    const late = await a.post('/api/auth/otp/verify', { phone, code: devCode });
    expect(late.body.code).toBe('OTP_EXPIRED');
  });

  it('codes are single-use and expire', async () => {
    const { phone } = await signup();
    await allowResend(phone);
    const a = agent();
    const { devCode } = (await requestOtp(a, phone)).body.data;
    expect((await a.post('/api/auth/otp/verify', { phone, code: devCode })).status).toBe(200);
    const reuse = await agent().post('/api/auth/otp/verify', { phone, code: devCode });
    expect(reuse.body.code).toBe('OTP_EXPIRED');

    await OtpChallenge.updateOne({ phone }, { lastSentAt: new Date(Date.now() - 60_000) });
    const fresh = (await requestOtp(a, phone)).body.data.devCode;
    await OtpChallenge.updateOne({ phone }, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await a.post('/api/auth/otp/verify', { phone, code: fresh });
    expect(expired.status).toBe(400);
    expect(expired.body).toMatchObject({
      code: 'OTP_EXPIRED',
      message: 'This code has expired. Request a new one.',
    });
  });

  it('a new OTP invalidates the previous one', async () => {
    const a = agent();
    const phone = nextPhone();
    const old = (await requestOtp(a, phone)).body.data.devCode;
    await OtpChallenge.updateOne({ phone }, { lastSentAt: new Date(Date.now() - 60_000) });
    const latest = (await requestOtp(a, phone)).body.data.devCode;
    if (old !== latest)
      expect((await a.post('/api/auth/otp/verify', { phone, code: old })).body.code).toBe(
        'OTP_INVALID',
      );
    expect((await a.post('/api/auth/otp/verify', { phone, code: latest })).status).toBe(200);
  });

  it('enforces the resend cooldown and the hourly cap per number', async () => {
    const a = agent();
    const phone = nextPhone();
    expect((await requestOtp(a, phone)).status).toBe(200);
    const again = await requestOtp(a, phone);
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('OTP_COOLDOWN');

    for (let i = 0; i < 4; i++) {
      await OtpChallenge.updateOne({ phone }, { lastSentAt: new Date(Date.now() - 60_000) });
      expect((await requestOtp(a, phone)).status).toBe(200);
    }
    await OtpChallenge.updateOne({ phone }, { lastSentAt: new Date(Date.now() - 60_000) });
    const capped = await requestOtp(a, phone);
    expect(capped.status).toBe(429);
    expect(capped.body.code).toBe('OTP_SEND_LIMIT');

    // Window rolls over after an hour.
    await OtpChallenge.updateOne(
      { phone },
      {
        windowStartedAt: new Date(Date.now() - 61 * 60_000),
        lastSentAt: new Date(Date.now() - 61 * 60_000),
      },
    );
    expect((await requestOtp(a, phone)).status).toBe(200);
  });

  it('concurrent requests for one number send only one SMS', async () => {
    const phone = nextPhone();
    const results = await Promise.all(Array.from({ length: 5 }, () => requestOtp(agent(), phone)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.body.code === 'OTP_COOLDOWN')).toHaveLength(4);
  });

  it('rejects forged, expired or session tokens as signup tickets', async () => {
    const secret = process.env.JWT_SECRET!;
    const forged = jwt.sign(
      { phone: '9999999999', typ: 'signup' },
      'wrong-secret-wrong-secret-wrong-secret!!',
    );
    const expired = jwt.sign({ phone: '9999999999', typ: 'signup' }, secret, { expiresIn: -10 });
    const session = jwt.sign({ sub: '000000000000000000000000', typ: 'session' }, secret);
    for (const ticket of [forged, expired, session]) {
      const res = await agent().post('/api/auth/otp/complete', { ticket, name: 'Hacker' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('SIGNUP_TICKET_INVALID');
    }
    // …and a signup ticket can't be used as a session cookie.
    const ticket = jwt.sign({ phone: '9999999999', typ: 'signup' }, secret);
    expect(
      (await request(getApp()).get('/api/auth/me').set('Cookie', `pl_session=${ticket}`)).status,
    ).toBe(401);
  });

  it('blocked numbers cannot request or use OTPs', async () => {
    const { phone, user, agent: a } = await signup();
    await User.updateOne({ _id: user.id }, { status: 'blocked' });
    const res = await requestOtp(agent(), phone);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_BLOCKED');
    expect((await a.get('/api/auth/me')).status).toBe(403); // existing session cut off immediately
  });

  it('old password endpoints are gone', async () => {
    expect(
      (
        await agent().post('/api/auth/register', {
          name: 'X',
          email: 'a@b.co',
          password: 'Passw0rd',
        })
      ).status,
    ).toBe(404);
    expect(
      (await agent().post('/api/auth/login', { identifier: 'a@b.co', password: 'Passw0rd' }))
        .status,
    ).toBe(404);
  });
});

describe('session & profile', () => {
  it('protects /me, supports logout and rejects tampered tokens', async () => {
    expect((await request(getApp()).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(getApp()).get('/api/auth/me').set('Cookie', 'pl_session=not.a.jwt')).status,
    ).toBe(401);
    const { agent: a } = await signup();
    expect((await a.get('/api/auth/me')).status).toBe(200);
    await a.post('/api/auth/logout');
    expect((await a.get('/api/auth/me')).status).toBe(401);
  });

  it('session probe returns null for guests and the user when logged in', async () => {
    const anon = await agent().get('/api/auth/session');
    expect(anon.status).toBe(200);
    expect(anon.body.data.user).toBeNull();
    const { agent: a, user } = await signup();
    expect((await a.get('/api/auth/session')).body.data.user.id).toBe(user.id);
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(getApp()).post('/api/auth/otp/request').send({ phone: nextPhone() });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_REJECTED');
  });

  it('updates profile (name, email, location) but never the verified phone', async () => {
    const { agent: a, phone } = await signup();
    const upd = await a.patch('/api/auth/me', {
      name: 'New Name',
      email: 'me@test.dev',
      phone: '9000000000',
      location: { city: 'Jaipur', state: 'Rajasthan' },
    });
    expect(upd.status).toBe(200);
    expect(upd.body.data.user).toMatchObject({
      name: 'New Name',
      email: 'me@test.dev',
      phone,
      location: { city: 'Jaipur', state: 'Rajasthan' },
    });

    const { agent: b } = await signup();
    const dup = await b.patch('/api/auth/me', { email: 'ME@test.dev' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects profile photos not hosted on our storage', async () => {
    const { agent: a } = await signup();
    const res = await a.patch('/api/auth/me', { profileImage: 'https://evil.example.com/x.png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
  });
});

describe('admin password login', () => {
  it('admins log in with email + password; wrong password and OTP users are refused', async () => {
    await createAdminAgent(); // creates admin{n}@test.dev / Adm1nPass!
    const admin = await User.findOne({ role: 'admin' }).lean();
    const ok = await agent().post('/api/auth/admin/login', {
      identifier: admin!.email!,
      password: 'Adm1nPass!',
    });
    expect(ok.status).toBe(200);
    const wrong = await agent().post('/api/auth/admin/login', {
      identifier: admin!.email!,
      password: 'nope-nope',
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

    const { phone } = await signup();
    const otpUser = await agent().post('/api/auth/admin/login', {
      identifier: phone,
      password: 'anything1',
    });
    expect(otpUser.status).toBe(401); // no password set → same generic error
  });

  it('admins can change their password; OTP users have none to change', async () => {
    const admin = await createAdminAgent();
    const bad = await admin.post('/api/auth/change-password', {
      currentPassword: 'wrong',
      newPassword: 'NewPassw0rd',
    });
    expect(bad.status).toBe(400);
    expect(
      (
        await admin.post('/api/auth/change-password', {
          currentPassword: 'Adm1nPass!',
          newPassword: 'NewPassw0rd',
        })
      ).status,
    ).toBe(200);

    const { agent: u } = await signup();
    const none = await u.post('/api/auth/change-password', {
      currentPassword: 'x',
      newPassword: 'NewPassw0rd',
    });
    expect(none.status).toBe(400);
  });
});
