import { Router } from 'express';
import * as c from '../controllers/authController';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { authLimiter, otpRequestLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

// Users: phone + OTP (login and signup are the same flow)
authRouter.post('/otp/request', otpRequestLimiter, c.requestOtp);
authRouter.post('/otp/verify', authLimiter, c.verifyOtp);
authRouter.post('/otp/complete', authLimiter, c.completeSignup);

// Admin console: email/phone + password
authRouter.post('/admin/login', authLimiter, c.adminLogin);

authRouter.post('/logout', c.logout);
authRouter.get('/session', optionalAuth, c.session);
authRouter.get('/me', requireAuth, c.me);
authRouter.patch('/me', requireAuth, c.updateMe);
authRouter.post('/change-password', authLimiter, requireAuth, c.changePassword);
