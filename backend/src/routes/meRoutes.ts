import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as tournaments from '../controllers/tournamentController';
import * as registrations from '../controllers/registrationController';

export const meRouter = Router();
meRouter.use(requireAuth);
meRouter.get('/tournaments', tournaments.mine);
meRouter.get('/registrations', registrations.mine);
