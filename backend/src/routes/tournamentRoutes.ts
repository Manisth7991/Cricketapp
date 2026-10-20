import { Router } from 'express';
import * as c from '../controllers/tournamentController';
import * as reg from '../controllers/registrationController';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { reportLimiter } from '../middleware/rateLimit';

export const tournamentRouter = Router();

tournamentRouter.get('/', c.list);
tournamentRouter.post('/', requireAuth, c.create);
tournamentRouter.get('/:id', optionalAuth, c.get);
tournamentRouter.patch('/:id', requireAuth, c.update);
tournamentRouter.delete('/:id', requireAuth, c.remove);
tournamentRouter.post('/:id/submit', requireAuth, c.submit);
tournamentRouter.post('/:id/cancel', requireAuth, c.cancel);
tournamentRouter.post('/:id/complete', requireAuth, c.complete);
tournamentRouter.post('/:id/register', requireAuth, reg.register);
tournamentRouter.get('/:id/registrations', requireAuth, reg.listForTournament);
tournamentRouter.get('/:id/my-registrations', requireAuth, reg.mineForTournament);
tournamentRouter.post('/:id/report', requireAuth, reportLimiter, c.report);
