import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  REGISTRATION_STATUSES,
  paginationQuerySchema,
  registrationDecisionSchema,
  registrationSchema,
} from '@playlocal/shared';
import * as service from '../services/registrationService';
import { authUser } from '../middleware/auth';
import { parseInput } from '../utils/validate';
import { created, ok, paginated } from '../utils/respond';

const actorOf = (req: Request) => {
  const u = authUser(req);
  return { id: u.id, role: u.role };
};

export async function register(req: Request, res: Response) {
  const input = parseInput(registrationSchema, req.body);
  const reg = await service.register(String(req.params.id), actorOf(req), input);
  created(
    res,
    reg,
    reg.status === 'waitlisted'
      ? 'Added to the waitlist'
      : 'Team registered — awaiting organiser confirmation',
  );
}

const statusFilter = z.object({ status: z.enum([...REGISTRATION_STATUSES, 'all']).optional() });

export async function listForTournament(req: Request, res: Response) {
  const { status } = parseInput(statusFilter, req.query);
  res.set('Cache-Control', 'no-store');
  ok(res, await service.listForTournament(String(req.params.id), actorOf(req), status));
}

export async function mineForTournament(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  ok(res, await service.listMineForTournament(String(req.params.id), actorOf(req)));
}

const mineSchema = paginationQuerySchema.extend({
  status: z.enum([...REGISTRATION_STATUSES, 'all', 'active']).optional(),
});

export async function mine(req: Request, res: Response) {
  const q = parseInput(mineSchema, req.query);
  const { items, meta } = await service.listMine(actorOf(req), q);
  res.set('Cache-Control', 'no-store');
  paginated(res, items, meta);
}

export async function withdraw(req: Request, res: Response) {
  ok(res, await service.withdraw(String(req.params.id), actorOf(req)), 'Registration withdrawn');
}

export async function confirm(req: Request, res: Response) {
  ok(res, await service.confirm(String(req.params.id), actorOf(req)), 'Registration confirmed');
}

export async function decline(req: Request, res: Response) {
  const { reason } = parseInput(registrationDecisionSchema, req.body);
  ok(
    res,
    await service.decline(String(req.params.id), actorOf(req), reason),
    'Registration declined',
  );
}
