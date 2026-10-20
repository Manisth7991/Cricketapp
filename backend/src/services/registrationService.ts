import { Types } from 'mongoose';
import { ERROR_CODES, type RegistrationStatus } from '@playlocal/shared';
import { Registration, Team, Tournament } from '../models';
import { ApiError } from '../utils/ApiError';
import { getPaging } from '../utils/pagination';
import { pageMeta } from '../utils/respond';
import { toRegistrationDTO } from './serializers';
import { notify } from './notificationService';

interface Actor {
  id: string;
  role: 'user' | 'admin';
}

const ACTIVE: RegistrationStatus[] = ['pending', 'confirmed', 'waitlisted'];
const SLOT_HOLDING: RegistrationStatus[] = ['pending', 'confirmed'];
const TOURNAMENT_FIELDS =
  'name sport banner startDate endDate venue status verifiedAt registrationDeadline organizerId';

/* ------------------------------------------------------------ counters */

/**
 * Atomically claim a team slot. The filter re-checks every rule at write time,
 * so two teams racing for the last slot can never both succeed.
 */
async function claimSlot(
  tournamentId: Types.ObjectId | string,
  opts: { ignoreDeadline?: boolean } = {},
) {
  const filter: Record<string, unknown> = {
    _id: tournamentId,
    status: 'published',
    $expr: { $lt: ['$registeredCount', '$maxTeams'] },
  };
  if (!opts.ignoreDeadline) filter.registrationDeadline = { $gte: new Date() };
  return Tournament.findOneAndUpdate(
    filter,
    { $inc: { registeredCount: 1 } },
    { returnDocument: 'after' },
  ).lean();
}

function releaseSlot(tournamentId: Types.ObjectId | string) {
  return Tournament.updateOne(
    { _id: tournamentId, registeredCount: { $gt: 0 } },
    { $inc: { registeredCount: -1 } },
  );
}

function adjustWaitlist(tournamentId: Types.ObjectId | string, delta: 1 | -1) {
  const filter =
    delta < 0 ? { _id: tournamentId, waitlistCount: { $gt: 0 } } : { _id: tournamentId };
  return Tournament.updateOne(filter, { $inc: { waitlistCount: delta } });
}

/** Fill freed slots from the waitlist, oldest first (FIFO). Safe to call concurrently. */
export async function promoteFromWaitlist(tournamentId: Types.ObjectId | string) {
  for (;;) {
    const hasWaiting = await Registration.exists({ tournamentId, status: 'waitlisted' });
    if (!hasWaiting) return;
    const t = await claimSlot(tournamentId, { ignoreDeadline: true });
    if (!t) return; // no free slot (or tournament no longer published)
    const promoted = await Registration.findOneAndUpdate(
      { tournamentId, status: 'waitlisted' },
      { $set: { status: 'pending' }, $unset: { waitlistedAt: '' } },
      { sort: { waitlistedAt: 1 }, returnDocument: 'after' },
    ).lean();
    if (!promoted) {
      await releaseSlot(tournamentId); // someone else took the last waitlisted team
      return;
    }
    await adjustWaitlist(tournamentId, -1);
    await notify([
      {
        userId: promoted.captainId,
        type: 'registration_promoted',
        title: 'You’re off the waitlist!',
        message: `A spot opened up in ${t.name}. Your registration is now awaiting the organiser's confirmation.`,
        link: `/activity/registrations`,
        relatedId: promoted._id,
      },
      {
        userId: t.organizerId,
        type: 'registration_received',
        title: 'Team moved up from waitlist',
        message: `A waitlisted team moved into ${t.name} and needs your confirmation.`,
        link: `/my-tournaments/${t._id}`,
        relatedId: promoted._id,
      },
    ]);
  }
}

/* ----------------------------------------------------------- register */

export async function register(
  tournamentId: string,
  actor: Actor,
  input: { teamId: string; note?: string },
) {
  if (!Types.ObjectId.isValid(tournamentId)) throw ApiError.notFound('Tournament not found.');
  const t = await Tournament.findById(tournamentId).lean();
  if (!t) throw ApiError.notFound('Tournament not found.');

  if (t.status !== 'published') {
    throw ApiError.conflict(
      t.status === 'pending_verification'
        ? 'This tournament is awaiting verification.'
        : 'Registration is not open for this tournament.',
      ERROR_CODES.TOURNAMENT_NOT_PUBLISHED,
    );
  }
  if (t.organizerId.toString() === actor.id) {
    throw ApiError.forbidden(
      "You can't register a team in your own tournament.",
      ERROR_CODES.OWN_TOURNAMENT,
    );
  }
  if (!t.registrationDeadline || t.registrationDeadline.getTime() < Date.now()) {
    throw ApiError.conflict('Registration is closed.', ERROR_CODES.REGISTRATION_CLOSED);
  }

  const team = await Team.findById(input.teamId).select('captainId sport name players').lean();
  if (!team || team.captainId.toString() !== actor.id) {
    throw ApiError.forbidden('You can only register teams you captain.');
  }
  if (team.sport !== t.sport) {
    throw ApiError.badRequest(
      `This is a ${t.sport} tournament — choose a ${t.sport} team.`,
      ERROR_CODES.TEAM_NOT_ELIGIBLE,
      [{ path: 'teamId', message: 'Team sport does not match' }],
    );
  }
  if (!team.players.length) {
    throw ApiError.badRequest(
      'Add at least one player to your team before registering.',
      ERROR_CODES.TEAM_NOT_ELIGIBLE,
      [{ path: 'teamId', message: 'Team has no players' }],
    );
  }

  const existing = await Registration.findOne({ tournamentId, teamId: team._id }).lean();
  if (existing && ACTIVE.includes(existing.status)) {
    throw ApiError.conflict('Your team is already registered.', ERROR_CODES.ALREADY_REGISTERED);
  }

  // Claim a slot, or fall back to the waitlist.
  let status: RegistrationStatus;
  const claimed = await claimSlot(tournamentId);
  if (claimed) {
    status = 'pending';
  } else {
    const fresh = await Tournament.findById(tournamentId)
      .select('registrationDeadline status allowWaitlist')
      .lean();
    if (!fresh || fresh.status !== 'published')
      throw ApiError.conflict(
        'Registration is not open for this tournament.',
        ERROR_CODES.TOURNAMENT_NOT_PUBLISHED,
      );
    if (!fresh.registrationDeadline || fresh.registrationDeadline.getTime() < Date.now()) {
      throw ApiError.conflict('Registration is closed.', ERROR_CODES.REGISTRATION_CLOSED);
    }
    if (!fresh.allowWaitlist)
      throw ApiError.conflict('Registration is full.', ERROR_CODES.REGISTRATION_FULL);
    status = 'waitlisted';
    await adjustWaitlist(tournamentId, 1);
  }

  const rollback = () =>
    status === 'waitlisted' ? adjustWaitlist(tournamentId, -1) : releaseSlot(tournamentId);
  const fields = {
    status,
    captainId: actor.id,
    note: input.note,
    registeredAt: new Date(),
    ...(status === 'waitlisted' ? { waitlistedAt: new Date() } : {}),
  };

  let regId: Types.ObjectId;
  try {
    if (existing) {
      // Re-registering after a withdrawal/cancellation reuses the same document.
      const reused = await Registration.findOneAndUpdate(
        { _id: existing._id, status: { $in: ['withdrawn', 'cancelled'] } },
        {
          $set: fields,
          $unset: { decisionReason: '', ...(status !== 'waitlisted' ? { waitlistedAt: '' } : {}) },
        },
        { returnDocument: 'after' },
      ).lean();
      if (!reused) throw Object.assign(new Error('race'), { code: 11000 });
      regId = reused._id;
    } else {
      regId = (await Registration.create({ tournamentId, teamId: team._id, ...fields }))._id;
    }
  } catch (err) {
    await rollback();
    if ((err as { code?: number }).code === 11000)
      throw ApiError.conflict('Your team is already registered.', ERROR_CODES.ALREADY_REGISTERED);
    throw err;
  }

  await notify({
    userId: t.organizerId,
    type: 'registration_received',
    title: status === 'waitlisted' ? 'New waitlist entry' : 'New team registration',
    message: `${team.name} ${status === 'waitlisted' ? 'joined the waitlist for' : 'registered for'} ${t.name}.`,
    link: `/my-tournaments/${t._id}`,
    relatedId: regId,
  });

  return getForCaptain(regId.toString(), actor);
}

/* ------------------------------------------------------------ queries */

async function waitlistPosition(r: {
  tournamentId: unknown;
  waitlistedAt?: Date | null;
  status: string;
}) {
  if (r.status !== 'waitlisted' || !r.waitlistedAt) return undefined;
  // tournamentId may be populated (object) or a bare ObjectId.
  const ref = r.tournamentId as { _id?: Types.ObjectId } | Types.ObjectId;
  const tournamentId = (ref instanceof Types.ObjectId ? ref : ref?._id) as Types.ObjectId;
  return (
    1 +
    (await Registration.countDocuments({
      tournamentId,
      status: 'waitlisted',
      waitlistedAt: { $lt: r.waitlistedAt },
    }))
  );
}

async function getForCaptain(id: string, actor: Actor) {
  const r = await Registration.findOne({ _id: id, captainId: actor.id })
    .populate('tournamentId', TOURNAMENT_FIELDS)
    .populate('teamId', 'name logo sport players')
    .lean();
  if (!r) throw ApiError.notFound('Registration not found.');
  return toRegistrationDTO(r, { waitlistPosition: await waitlistPosition(r) });
}

export async function listMine(
  actor: Actor,
  q: { status?: string; page?: number; limit?: number },
) {
  const { page, limit, skip } = getPaging(q);
  const filter: Record<string, unknown> = { captainId: actor.id };
  if (q.status === 'active' || !q.status) filter.status = { $in: ACTIVE };
  else if (q.status !== 'all') filter.status = q.status;

  const [items, total] = await Promise.all([
    Registration.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('tournamentId', TOURNAMENT_FIELDS)
      .populate('teamId', 'name logo sport players')
      .lean(),
    Registration.countDocuments(filter),
  ]);
  const positions = await Promise.all(items.map(waitlistPosition));
  return {
    items: items.map((r, i) => toRegistrationDTO(r, { waitlistPosition: positions[i] })),
    meta: pageMeta(page, limit, total),
  };
}

export async function listMineForTournament(tournamentId: string, actor: Actor) {
  if (!Types.ObjectId.isValid(tournamentId)) return [];
  const items = await Registration.find({ tournamentId, captainId: actor.id })
    .populate('teamId', 'name logo sport players')
    .lean();
  const positions = await Promise.all(items.map(waitlistPosition));
  return items.map((r, i) => toRegistrationDTO(r, { waitlistPosition: positions[i] }));
}

async function loadTournamentAsOrganiser(tournamentId: Types.ObjectId | string, actor: Actor) {
  const t = await Tournament.findById(tournamentId).select('organizerId name status').lean();
  if (!t) throw ApiError.notFound('Tournament not found.');
  if (t.organizerId.toString() !== actor.id && actor.role !== 'admin') {
    throw ApiError.forbidden('Only the organiser can manage registrations for this tournament.');
  }
  return t;
}

/** Organiser view: every registration with roster + captain contact details. */
export async function listForTournament(tournamentId: string, actor: Actor, status?: string) {
  if (!Types.ObjectId.isValid(tournamentId)) throw ApiError.notFound('Tournament not found.');
  await loadTournamentAsOrganiser(tournamentId, actor);
  const filter: Record<string, unknown> = { tournamentId };
  if (status && status !== 'all') filter.status = status;
  const items = await Registration.find(filter)
    .sort({ registeredAt: 1 })
    .populate('teamId', 'name logo sport players')
    .populate('captainId', 'name phone email')
    .lean();
  // Waitlist positions in one pass (already sorted by time).
  const waitlisted = items
    .filter((r) => r.status === 'waitlisted')
    .sort((a, b) => (a.waitlistedAt?.getTime() ?? 0) - (b.waitlistedAt?.getTime() ?? 0));
  return items.map((r) =>
    toRegistrationDTO(r, {
      includeContact: true,
      waitlistPosition: r.status === 'waitlisted' ? waitlisted.indexOf(r) + 1 : undefined,
    }),
  );
}

/* ------------------------------------------------------ state changes */

export async function withdraw(id: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Registration not found.');
  const reg = await Registration.findOne({ _id: id, captainId: actor.id }).lean();
  if (!reg) throw ApiError.notFound('Registration not found.');
  if (!ACTIVE.includes(reg.status))
    throw ApiError.conflict(
      'This registration is no longer active.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );

  const t = await Tournament.findById(reg.tournamentId)
    .select('registrationDeadline organizerId name')
    .lean();
  if (t?.registrationDeadline && t.registrationDeadline.getTime() < Date.now()) {
    throw ApiError.conflict(
      'Withdrawals close at the registration deadline. Please contact the organiser.',
      ERROR_CODES.REGISTRATION_CLOSED,
    );
  }

  // Conditional transition — a double-click can only withdraw (and release a slot) once.
  const prev = await Registration.findOneAndUpdate(
    { _id: id, status: { $in: ACTIVE } },
    { $set: { status: 'withdrawn' }, $unset: { waitlistedAt: '' } },
    { returnDocument: 'before' },
  ).lean();
  if (!prev)
    throw ApiError.conflict(
      'This registration is no longer active.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );

  if (SLOT_HOLDING.includes(prev.status)) {
    await releaseSlot(prev.tournamentId);
    await promoteFromWaitlist(prev.tournamentId);
  } else {
    await adjustWaitlist(prev.tournamentId, -1);
  }
  if (t) {
    await notify({
      userId: t.organizerId,
      type: 'registration_withdrawn',
      title: 'A team withdrew',
      message: `A team withdrew from ${t.name}.`,
      link: `/my-tournaments/${t._id}`,
      relatedId: prev._id,
    });
  }
  return getForCaptain(id, actor);
}

export async function confirm(id: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Registration not found.');
  const reg = await Registration.findById(id).lean();
  if (!reg) throw ApiError.notFound('Registration not found.');
  const t = await loadTournamentAsOrganiser(reg.tournamentId, actor);
  const updated = await Registration.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'confirmed' }, $unset: { decisionReason: '' } },
    { returnDocument: 'after' },
  )
    .populate('teamId', 'name logo sport players')
    .populate('captainId', 'name phone email')
    .lean();
  if (!updated)
    throw ApiError.conflict(
      'Only pending registrations can be confirmed.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  await notify({
    userId: reg.captainId,
    type: 'registration_confirmed',
    title: 'Registration confirmed 🎉',
    message: `Your team is confirmed for ${t.name}.`,
    link: `/tournaments/${t._id}`,
    relatedId: reg._id,
  });
  return toRegistrationDTO(updated, { includeContact: true });
}

export async function decline(id: string, actor: Actor, reason?: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Registration not found.');
  const reg = await Registration.findById(id).lean();
  if (!reg) throw ApiError.notFound('Registration not found.');
  const t = await loadTournamentAsOrganiser(reg.tournamentId, actor);
  const prev = await Registration.findOneAndUpdate(
    { _id: id, status: { $in: ACTIVE } },
    {
      $set: { status: 'cancelled', decisionReason: reason || 'Declined by organiser' },
      $unset: { waitlistedAt: '' },
    },
    { returnDocument: 'before' },
  ).lean();
  if (!prev)
    throw ApiError.conflict(
      'This registration is no longer active.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );

  if (SLOT_HOLDING.includes(prev.status)) {
    await releaseSlot(prev.tournamentId);
    await promoteFromWaitlist(prev.tournamentId);
  } else {
    await adjustWaitlist(prev.tournamentId, -1);
  }
  await notify({
    userId: reg.captainId,
    type: 'registration_declined',
    title: 'Registration declined',
    message: `Your registration for ${t.name} was declined.${reason ? ` Reason: ${reason}` : ''}`,
    link: `/activity/registrations`,
    relatedId: reg._id,
  });
  const updated = await Registration.findById(id)
    .populate('teamId', 'name logo sport players')
    .populate('captainId', 'name phone email')
    .lean();
  return toRegistrationDTO(updated, { includeContact: true });
}
