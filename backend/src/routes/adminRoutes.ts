import { Router } from 'express';
import * as c from '../controllers/adminController';
import { requireAdmin, requireAuth } from '../middleware/auth';

/** Every admin route is protected server-side — the frontend guard is only UX. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminRouter.get('/stats', c.stats);
adminRouter.get('/tournaments', c.tournaments);
adminRouter.get('/tournaments/pending', c.pendingTournaments);
adminRouter.get('/tournaments/:id', c.tournament);
adminRouter.post('/tournaments/:id/approve', c.approve);
adminRouter.post('/tournaments/:id/reject', c.reject);
adminRouter.post('/tournaments/:id/suspend', c.suspend);
adminRouter.post('/tournaments/:id/reinstate', c.reinstate);
adminRouter.get('/users', c.users);
adminRouter.patch('/users/:id/status', c.setUserStatus);
adminRouter.get('/teams', c.teams);
adminRouter.get('/reports', c.reports);
adminRouter.patch('/reports/:id', c.updateReport);
adminRouter.get('/sports', c.listSports);
adminRouter.post('/sports', c.createSport);
adminRouter.patch('/sports/:id', c.updateSport);
