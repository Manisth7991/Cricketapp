import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './authRoutes';
import { tournamentRouter } from './tournamentRoutes';
import { meRouter } from './meRoutes';
import { uploadRouter } from './uploadRoutes';
import { teamRouter } from './teamRoutes';
import { registrationRouter } from './registrationRoutes';
import { adminRouter } from './adminRoutes';
import { notificationRouter } from './notificationRoutes';
import * as misc from '../controllers/miscController';
import { geoLimiter } from '../middleware/rateLimit';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'up' : 'down';
  res.status(dbState === 'up' ? 200 : 503).json({
    success: dbState === 'up',
    data: { status: 'ok', db: dbState, uptime: Math.round(process.uptime()) },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.get('/sports', misc.listSports);
apiRouter.get('/geo/reverse', geoLimiter, misc.reverseGeocode);
apiRouter.use('/tournaments', tournamentRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/uploads', uploadRouter);
apiRouter.use('/teams', teamRouter);
apiRouter.use('/registrations', registrationRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/admin', adminRouter);
