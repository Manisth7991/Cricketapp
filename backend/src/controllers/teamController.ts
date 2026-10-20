import type { Request, Response } from 'express';
import { z } from 'zod';
import { playerSchema, teamSchema, updateTeamSchema } from '@playlocal/shared';
import * as service from '../services/teamService';
import { authUser } from '../middleware/auth';
import { parseInput } from '../utils/validate';
import { created, ok } from '../utils/respond';

const actorOf = (req: Request) => {
  const u = authUser(req);
  return { id: u.id, role: u.role };
};
const listSchema = z.object({ sport: z.string().trim().max(40).optional() });

export async function list(req: Request, res: Response) {
  const { sport } = parseInput(listSchema, req.query);
  res.set('Cache-Control', 'no-store');
  ok(res, await service.listMine(actorOf(req), sport));
}
export async function get(req: Request, res: Response) {
  ok(res, await service.getAccessible(String(req.params.id), actorOf(req)));
}
export async function create(req: Request, res: Response) {
  created(
    res,
    await service.create(actorOf(req), parseInput(teamSchema, req.body)),
    'Team created',
  );
}
export async function update(req: Request, res: Response) {
  ok(
    res,
    await service.update(
      String(req.params.id),
      actorOf(req),
      parseInput(updateTeamSchema, req.body),
    ),
    'Team updated',
  );
}
export async function remove(req: Request, res: Response) {
  await service.remove(String(req.params.id), actorOf(req));
  ok(res, null, 'Team deleted');
}
export async function addPlayer(req: Request, res: Response) {
  created(
    res,
    await service.addPlayer(
      String(req.params.id),
      actorOf(req),
      parseInput(playerSchema, req.body),
    ),
    'Player added',
  );
}
export async function updatePlayer(req: Request, res: Response) {
  const input = parseInput(playerSchema, req.body);
  ok(
    res,
    await service.updatePlayer(
      String(req.params.id),
      String(req.params.playerId),
      actorOf(req),
      input,
    ),
    'Player updated',
  );
}
export async function removePlayer(req: Request, res: Response) {
  ok(
    res,
    await service.removePlayer(String(req.params.id), String(req.params.playerId), actorOf(req)),
    'Player removed',
  );
}
