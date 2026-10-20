import { Router } from 'express';
import * as c from '../controllers/notificationController';
import { requireAuth } from '../middleware/auth';

export const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get('/', c.list);
notificationRouter.get('/unread-count', c.unreadCount);
notificationRouter.patch('/:id/read', c.markRead);
notificationRouter.post('/read-all', c.markAllRead);
