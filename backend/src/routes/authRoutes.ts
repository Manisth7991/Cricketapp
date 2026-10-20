import { Router } from 'express';
import * as c from '../controllers/authController';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { authLimiter, otpRequestLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

// Everyone (users and admins): phone + OTP. Login and sign-up are the same flow;
// the admin role lives on the account (see services/adminAccounts.ts).
authRouter.post('/otp/request', otpRequestLimiter, c.requestOtp);
authRouter.post('/otp/verify', authLimiter, c.verifyOtp);
authRouter.post('/otp/complete', authLimiter, c.completeSignup);
// Logged-in: verify a different WhatsApp number for a tournament (same OTP engine, no login)
authRouter.post('/otp/verify-contact', authLimiter, requireAuth, c.verifyContactOtp);

// Firebase Phone Auth (SMS_PROVIDER=firebase): the browser sends/confirms the SMS, we verify the token
authRouter.post('/firebase/verify', authLimiter, c.firebaseVerify);
authRouter.post('/firebase/verify-contact', authLimiter, requireAuth, c.firebaseVerifyContact);

authRouter.post('/logout', c.logout);
authRouter.get('/session', optionalAuth, c.session);
authRouter.get('/me', requireAuth, c.me);
authRouter.patch('/me', requireAuth, c.updateMe);
