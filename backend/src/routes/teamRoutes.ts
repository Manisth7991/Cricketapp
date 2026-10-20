import { Router } from 'express';
import * as c from '../controllers/teamController';
import { requireAuth } from '../middleware/auth';

export const teamRouter = Router();
teamRouter.use(requireAuth);
teamRouter.get('/', c.list);
teamRouter.post('/', c.create);
teamRouter.get('/:id', c.get);
teamRouter.patch('/:id', c.update);
teamRouter.delete('/:id', c.remove);
teamRouter.post('/:id/players', c.addPlayer);
teamRouter.patch('/:id/players/:playerId', c.updatePlayer);
teamRouter.delete('/:id/players/:playerId', c.removePlayer);
