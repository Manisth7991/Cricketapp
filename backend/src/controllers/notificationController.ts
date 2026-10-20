import type { Request, Response } from 'express';
import { paginationQuerySchema } from '@playlocal/shared';
import * as service from '../services/notificationService';
import { authUser } from '../middleware/auth';
import { parseInput } from '../utils/validate';
import { ok, paginated } from '../utils/respond';

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listForUser(
    authUser(req).id,
    parseInput(paginationQuerySchema, req.query),
  );
  res.set('Cache-Control', 'no-store');
  paginated(res, items, meta);
}
export async function unreadCount(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  ok(res, { count: await service.unreadCount(authUser(req).id) });
}
export async function markRead(req: Request, res: Response) {
  await service.markRead(authUser(req).id, String(req.params.id));
  ok(res, null);
}
export async function markAllRead(req: Request, res: Response) {
  await service.markAllRead(authUser(req).id);
  ok(res, null, 'All caught up');
}
