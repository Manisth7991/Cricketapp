import type { Request, Response } from 'express';
import {
  adminReportUpdateSchema,
  adminUserStatusSchema,
  paginationQuerySchema,
  reasonSchema,
  sportSchema,
  updateSportSchema,
} from '@playlocal/shared';
import * as admin from '../services/adminService';
import * as sports from '../services/sportService';
import { authUser } from '../middleware/auth';
import { parseInput } from '../utils/validate';
import { created, ok, paginated } from '../utils/respond';

const actorOf = (req: Request) => {
  const u = authUser(req);
  return { id: u.id, role: u.role };
};
const id = (req: Request) => String(req.params.id);
const list = (req: Request) => parseInput(paginationQuerySchema, req.query);

export async function stats(_req: Request, res: Response) {
  ok(res, await admin.stats());
}
export async function tournaments(req: Request, res: Response) {
  const { items, meta } = await admin.listTournaments(list(req));
  paginated(res, items, meta);
}
export async function pendingTournaments(req: Request, res: Response) {
  const { items, meta } = await admin.listTournaments({
    ...list(req),
    status: 'pending_verification',
  });
  paginated(res, items, meta);
}
export async function tournament(req: Request, res: Response) {
  ok(res, await admin.getTournament(id(req)));
}
export async function approve(req: Request, res: Response) {
  ok(res, await admin.approve(id(req), actorOf(req)), 'Tournament approved and published');
}
export async function reject(req: Request, res: Response) {
  const { reason } = parseInput(reasonSchema, req.body);
  ok(res, await admin.reject(id(req), actorOf(req), reason), 'Tournament rejected');
}
export async function suspend(req: Request, res: Response) {
  const { reason } = parseInput(reasonSchema, req.body);
  ok(res, await admin.suspend(id(req), actorOf(req), reason), 'Tournament suspended');
}
export async function reinstate(req: Request, res: Response) {
  ok(res, await admin.reinstate(id(req), actorOf(req)), 'Tournament reinstated');
}
export async function users(req: Request, res: Response) {
  const { items, meta } = await admin.listUsers(list(req));
  paginated(res, items, meta);
}
export async function setUserStatus(req: Request, res: Response) {
  const { status } = parseInput(adminUserStatusSchema, req.body);
  ok(
    res,
    await admin.setUserStatus(id(req), actorOf(req), status),
    status === 'blocked' ? 'User blocked' : 'User unblocked',
  );
}
export async function teams(req: Request, res: Response) {
  const { items, meta } = await admin.listTeams(list(req));
  paginated(res, items, meta);
}
export async function reports(req: Request, res: Response) {
  const { items, meta } = await admin.listReports(list(req));
  paginated(res, items, meta);
}
export async function updateReport(req: Request, res: Response) {
  ok(
    res,
    await admin.updateReport(id(req), actorOf(req), parseInput(adminReportUpdateSchema, req.body)),
    'Report updated',
  );
}
export async function listSports(_req: Request, res: Response) {
  ok(res, await sports.listAll());
}
export async function createSport(req: Request, res: Response) {
  created(res, await sports.create(parseInput(sportSchema, req.body)), 'Sport added');
}
export async function updateSport(req: Request, res: Response) {
  ok(res, await sports.update(id(req), parseInput(updateSportSchema, req.body)), 'Sport updated');
}
