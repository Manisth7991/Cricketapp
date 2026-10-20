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

authRouter.post('/logout', c.logout);
authRouter.get('/session', optionalAuth, c.session);
authRouter.get('/me', requireAuth, c.me);
authRouter.patch('/me', requireAuth, c.updateMe);
