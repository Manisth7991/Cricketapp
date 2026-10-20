import { Types } from 'mongoose';
import type { z } from 'zod';
import {
  ERROR_CODES,
  LIMITS,
  normalizePhone,
  type playerSchema,
  type teamSchema,
  type updateTeamSchema,
} from '@playlocal/shared';
import { Registration, Team, Tournament } from '../models';
import { ApiError } from '../utils/ApiError';
import { normalizePlace } from '../utils/text';
import { toTeamDTO } from './serializers';
import { resolveActiveSport } from './sportService';
import { assertOwnImages } from './storageService';

type TeamInput = z.output<typeof teamSchema>;
type TeamUpdate = z.output<typeof updateTeamSchema>;
type PlayerInput = z.output<typeof playerSchema>;
interface Actor {
  id: string;
  role: 'user' | 'admin';
}

const ACTIVE: ('pending' | 'confirmed' | 'waitlisted')[] = ['pending', 'confirmed', 'waitlisted'];

function assertNoDuplicatePlayers(
  players: { name: string; phone?: string | null; _id?: unknown }[],
) {
  const names = new Set<string>();
  const phones = new Set<string>();
  for (const p of players) {
    const n = p.name.trim().toLowerCase();
    if (names.has(n))
      throw ApiError.conflict(`"${p.name}" is already in this team.`, ERROR_CODES.DUPLICATE_PLAYER);
    names.add(n);
    if (p.phone) {
      const ph = normalizePhone(p.phone);
      if (phones.has(ph))
        throw ApiError.conflict(
          'Two players cannot share the same phone number.',
          ERROR_CODES.DUPLICATE_PLAYER,
        );
      phones.add(ph);
    }
  }
}

function duplicateName(err: unknown): never {
  if ((err as { code?: number }).code === 11000) {
    throw ApiError.conflict('You already have a team with this name for this sport.');
  }
  throw err;
}

async function loadAsCaptain(id: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Team not found.');
  const team = await Team.findById(id).lean();
  if (!team) throw ApiError.notFound('Team not found.');
  if (team.captainId.toString() !== actor.id && actor.role !== 'admin') {
    throw ApiError.forbidden('Only the team captain can change this team.');
  }
  return team;
}

export async function listMine(actor: Actor, sport?: string) {
  const filter: Record<string, unknown> = { captainId: actor.id };
  if (sport) filter.sport = sport.toLowerCase();
  const teams = await Team.find(filter).sort({ updatedAt: -1 }).lean();
  return teams.map(toTeamDTO);
}

/** Captain/admin, or an organiser whose tournament this team has registered for (needs the roster). */
export async function getAccessible(id: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Team not found.');
  const team = await Team.findById(id).populate('captainId', 'name').lean();
  if (!team) throw ApiError.notFound('Team not found.');
  const captainId = (team.captainId as unknown as { _id: Types.ObjectId })._id.toString();
  if (captainId !== actor.id && actor.role !== 'admin') {
    const tournamentIds = await Registration.find({ teamId: id }).distinct('tournamentId');
    const organises = tournamentIds.length
      ? await Tournament.exists({ _id: { $in: tournamentIds }, organizerId: actor.id })
      : null;
    if (!organises) throw ApiError.notFound('Team not found.');
  }
  return toTeamDTO(team);
}

export async function create(actor: Actor, input: TeamInput) {
  assertOwnImages({
    logo: input.logo,
    ...Object.fromEntries((input.players ?? []).map((p, i) => [`players.${i}.image`, p.image])),
  });
  const sport = await resolveActiveSport(input.sport);
  if ((await Team.countDocuments({ captainId: actor.id })) >= LIMITS.maxTeamsPerUser) {
    throw ApiError.conflict(
      `You can manage at most ${LIMITS.maxTeamsPerUser} teams.`,
      ERROR_CODES.TEAM_LIMIT_REACHED,
    );
  }
  const players = input.players ?? [];
  assertNoDuplicatePlayers(players);
  const team = await Team.create({
    name: input.name,
    sport,
    description: input.description,
    logo: input.logo || undefined,
    captainId: actor.id,
    location: input.location
      ? { city: normalizePlace(input.location.city), state: input.location.state }
      : undefined,
    players,
  }).catch(duplicateName);
  return toTeamDTO(team.toObject());
}

export async function update(id: string, actor: Actor, input: TeamUpdate) {
  const team = await loadAsCaptain(id, actor);
  assertOwnImages({ logo: input.logo });
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};
  if (input.name !== undefined) $set.name = input.name;
  if (input.description !== undefined) $set.description = input.description;
  if (input.logo !== undefined) {
    if (input.logo) $set.logo = input.logo;
    else $unset.logo = '';
  }
  if (input.location) {
    $set['location.city'] = normalizePlace(input.location.city);
    $set['location.state'] = input.location.state;
  }
  if (input.sport !== undefined) {
    const sport = await resolveActiveSport(input.sport);
    if (
      sport !== team.sport &&
      (await Registration.exists({ teamId: id, status: { $in: ACTIVE } }))
    ) {
      throw ApiError.conflict(
        "You can't change the sport while the team has active registrations.",
        ERROR_CODES.TEAM_HAS_ACTIVE_REGISTRATIONS,
      );
    }
    $set.sport = sport;
  }
  const updated = await Team.findByIdAndUpdate(
    id,
    {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
    },
    { returnDocument: 'after', runValidators: true },
  )
    .lean()
    .catch(duplicateName);
  return toTeamDTO(updated!);
}

export async function remove(id: string, actor: Actor) {
  await loadAsCaptain(id, actor);
  if (await Registration.exists({ teamId: id, status: { $in: ACTIVE } })) {
    throw ApiError.conflict(
      'This team is registered for a tournament. Withdraw those registrations before deleting the team.',
      ERROR_CODES.TEAM_HAS_ACTIVE_REGISTRATIONS,
    );
  }
  await Promise.all([Team.deleteOne({ _id: id }), Registration.deleteMany({ teamId: id })]);
}

export async function addPlayer(id: string, actor: Actor, input: PlayerInput) {
  const team = await loadAsCaptain(id, actor);
  assertOwnImages({ image: input.image });
  assertNoDuplicatePlayers([...team.players, input]);
  // Atomic capacity guard: only push while the (max-1)th slot is still empty.
  const updated = await Team.findOneAndUpdate(
    { _id: id, [`players.${LIMITS.maxPlayersPerTeam - 1}`]: { $exists: false } },
    { $push: { players: { ...input, image: input.image || undefined } } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!updated)
    throw ApiError.conflict(
      `A team can have at most ${LIMITS.maxPlayersPerTeam} players.`,
      ERROR_CODES.PLAYER_LIMIT_REACHED,
    );
  return toTeamDTO(updated);
}

export async function updatePlayer(id: string, playerId: string, actor: Actor, input: PlayerInput) {
  const team = await loadAsCaptain(id, actor);
  if (!team.players.some((p) => p._id.toString() === playerId))
    throw ApiError.notFound('Player not found.');
  assertOwnImages({ image: input.image });
  assertNoDuplicatePlayers([...team.players.filter((p) => p._id.toString() !== playerId), input]);
  const updated = await Team.findOneAndUpdate(
    { _id: id, 'players._id': playerId },
    {
      $set: {
        'players.$.name': input.name,
        'players.$.phone': input.phone,
        'players.$.role': input.role,
        'players.$.image': input.image || undefined,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  return toTeamDTO(updated!);
}

export async function removePlayer(id: string, playerId: string, actor: Actor) {
  const team = await loadAsCaptain(id, actor);
  if (
    !Types.ObjectId.isValid(playerId) ||
    !team.players.some((p) => p._id.toString() === playerId)
  ) {
    throw ApiError.notFound('Player not found.');
  }
  const updated = await Team.findByIdAndUpdate(
    id,
    { $pull: { players: { _id: playerId } } },
    { returnDocument: 'after' },
  ).lean();
  return toTeamDTO(updated!);
}
