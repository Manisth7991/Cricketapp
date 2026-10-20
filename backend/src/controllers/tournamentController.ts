import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  TOURNAMENT_STATUSES,
  paginationQuerySchema,
  reportSchema,
  tournamentDraftSchema,
  tournamentQuerySchema,
  tournamentUpdateSchema,
} from '@playlocal/shared';
import * as service from '../services/tournamentService';
import { createReport } from '../services/reportService';
import { authUser } from '../middleware/auth';
import { parseInput } from '../utils/validate';
import { created, ok, paginated } from '../utils/respond';

const actorOf = (req: Request) => {
  const u = authUser(req);
  return { id: u.id, role: u.role };
};
const optionalActor = (req: Request) =>
  req.user ? { id: req.user.id, role: req.user.role } : undefined;

export async function list(req: Request, res: Response) {
  const q = parseInput(tournamentQuerySchema, req.query);
  const { items, meta } = await service.listPublic(q);
  // Public, user-independent data → let browsers/CDNs cache briefly.
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  paginated(res, items, meta);
}

export async function get(req: Request, res: Response) {
  const dto = await service.getVisible(String(req.params.id), optionalActor(req));
  res.set('Cache-Control', 'private, no-cache');
  ok(res, dto);
}

export async function create(req: Request, res: Response) {
  const input = parseInput(tournamentDraftSchema, req.body);
  created(res, await service.createDraft(actorOf(req), input), 'Draft saved');
}

export async function update(req: Request, res: Response) {
  const input = parseInput(tournamentUpdateSchema, req.body);
  ok(res, await service.update(String(req.params.id), actorOf(req), input), 'Tournament updated');
}

export async function submit(req: Request, res: Response) {
  ok(
    res,
    await service.submitForVerification(String(req.params.id), actorOf(req)),
    'Submitted for verification',
  );
}

const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

export async function cancel(req: Request, res: Response) {
  const { reason } = parseInput(cancelSchema, req.body);
  ok(
    res,
    await service.cancel(String(req.params.id), actorOf(req), reason),
    'Tournament cancelled',
  );
}

export async function complete(req: Request, res: Response) {
  ok(
    res,
    await service.complete(String(req.params.id), actorOf(req)),
    'Tournament marked as completed',
  );
}

export async function remove(req: Request, res: Response) {
  await service.removeDraft(String(req.params.id), actorOf(req));
  ok(res, null, 'Tournament deleted');
}

const mineSchema = paginationQuerySchema.extend({
  status: z.enum([...TOURNAMENT_STATUSES, 'all']).optional(),
});

export async function mine(req: Request, res: Response) {
  const q = parseInput(mineSchema, req.query);
  const { items, meta } = await service.listMine(actorOf(req), q);
  res.set('Cache-Control', 'no-store');
  ok(res, items, undefined, meta);
}

export async function report(req: Request, res: Response) {
  const input = parseInput(reportSchema, req.body);
  await createReport(String(req.params.id), actorOf(req), input);
  created(res, null, 'Thanks — our team will review this tournament.');
}
