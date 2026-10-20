import { Router } from 'express';
import * as c from '../controllers/registrationController';
import { requireAuth } from '../middleware/auth';

export const registrationRouter = Router();
registrationRouter.use(requireAuth);
registrationRouter.patch('/:id/withdraw', c.withdraw);
registrationRouter.post('/:id/confirm', c.confirm);
registrationRouter.post('/:id/decline', c.decline);
