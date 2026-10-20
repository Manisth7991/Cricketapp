import type { Request, Response } from 'express';
import {
  firebaseTokenSchema,
  otpCompleteSchema,
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
} from '@playlocal/shared';
import * as authService from '../services/authService';
import * as otpService from '../services/otpService';
import { authUser } from '../middleware/auth';
import { parseInput } from '../utils/validate';
import { created, ok } from '../utils/respond';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/token';

/* ------------------------------------------------- phone OTP (users and admins) */

export async function requestOtp(req: Request, res: Response) {
  const { phone } = parseInput(otpRequestSchema, req.body);
  ok(res, await otpService.requestOtp(phone), 'OTP sent');
}

export async function verifyOtp(req: Request, res: Response) {
  const { phone, code } = parseInput(otpVerifySchema, req.body);
  const result = await otpService.verifyOtp(phone, code);
  if (result.status === 'new_user') {
    // Number verified but no account yet → client collects the name, then calls /otp/complete.
    return ok(res, { status: 'new_user', ticket: result.ticket }, 'Number verified');
  }
  const user = await authService.getUserById(result.userId);
  setAuthCookie(res, signToken(user.id, user.role)); // admins get the shorter session
  ok(res, { status: 'logged_in', user }, 'Logged in');
}

/* ------------------------------------------------- Firebase Phone Auth (SMS_PROVIDER=firebase) */

export async function firebaseVerify(req: Request, res: Response) {
  const { idToken } = parseInput(firebaseTokenSchema, req.body);
  const result = await otpService.firebaseLogin(idToken);
  if (result.status === 'new_user') {
    return ok(res, { status: 'new_user', ticket: result.ticket }, 'Number verified');
  }
  const user = await authService.getUserById(result.userId);
  setAuthCookie(res, signToken(user.id, user.role));
  ok(res, { status: 'logged_in', user }, 'Logged in');
}

export async function firebaseVerifyContact(req: Request, res: Response) {
  const { idToken } = parseInput(firebaseTokenSchema, req.body);
  ok(res, await otpService.firebaseContact(authUser(req).id, idToken), 'Number verified');
}

/** Organisers: verify a WhatsApp number that differs from the login number (no session change). */
export async function verifyContactOtp(req: Request, res: Response) {
  const { phone, code } = parseInput(otpVerifySchema, req.body);
  ok(res, await otpService.verifyContactOtp(authUser(req).id, phone, code), 'Number verified');
}

export async function completeSignup(req: Request, res: Response) {
  const input = parseInput(otpCompleteSchema, req.body);
  const user = await otpService.completeSignup(input);
  setAuthCookie(res, signToken(user.id, user.role));
  created(res, { user }, 'Account created successfully');
}

/* ------------------------------------------------------------------ session */

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  ok(res, null, 'Logged out');
}

export async function me(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  ok(res, { user: await authService.getUserById(authUser(req).id) });
}

/** Session probe for the SPA: 200 with `user: null` for guests (no 401 noise on every page load). */
export async function session(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  ok(res, { user: req.user ? await authService.getUserById(req.user.id) : null });
}

export async function updateMe(req: Request, res: Response) {
  const input = parseInput(updateProfileSchema, req.body);
  ok(res, { user: await authService.updateProfile(authUser(req).id, input) }, 'Profile updated');
}
