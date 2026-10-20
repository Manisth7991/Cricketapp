import { Types, type PipelineStage } from 'mongoose';
import type { z } from 'zod';
import {
  distanceKm,
  ERROR_CODES,
  OWNER_FULL_EDIT_STATUSES,
  PUBLIC_TOURNAMENT_STATUSES,
  PUBLISHED_EDITABLE_FIELDS,
  scheduleIssues,
  tournamentSchema,
  type TournamentQuery,
  type TournamentStatus,
  type tournamentContactSchema,
  type tournamentDraftSchema,
  type tournamentUpdateSchema,
} from '@playlocal/shared';
import { Registration, Tournament, User } from '../models';
import { verifyContactTicket } from '../utils/token';
import { ApiError } from '../utils/ApiError';
import { endOfDay, startOfDay, toIsoDate, todayIso } from '../utils/dates';
import { escapeRegex, getPaging } from '../utils/pagination';
import { pageMeta } from '../utils/respond';
import { normalizePlace } from '../utils/text';
import { toTournamentDTO } from './serializers';
import { resolveActiveSport } from './sportService';
import { assertOwnImages } from './storageService';
import { geocode } from './geoService';
import { notify } from './notificationService';

type DraftInput = z.output<typeof tournamentDraftSchema>;
type ContactInput = z.output<typeof tournamentContactSchema>;
type UpdateInput = z.output<typeof tournamentUpdateSchema>;
interface Actor {
  id: string;
  role: 'user' | 'admin';
}

/** Fields never needed by list cards — excluded to keep list payloads small. */
const LIST_PROJECTION = {
  description: 0,
  rules: 0,
  prizeDetails: 0,
  rejectionReason: 0,
  suspensionReason: 0,
  reviewedBy: 0,
  verifiedBy: 0,
  contact: 0,
} as const;

const DEFAULT_RADIUS_KM = 150;

/* ------------------------------------------------------------- discovery */

function buildPublicFilter(q: TournamentQuery): Record<string, unknown> {
  const now = new Date();
  const todayStart = startOfDay(todayIso(now));
  const and: Record<string, unknown>[] = [];

  switch (q.status) {
    case 'open':
      and.push(
        { status: 'published', registrationDeadline: { $gte: now } },
        { $or: [{ allowWaitlist: true }, { $expr: { $lt: ['$registeredCount', '$maxTeams'] } }] },
      );
      break;
    case 'upcoming':
      and.push({ status: 'published', startDate: { $gt: now } });
      break;
    case 'closed':
      and.push({
        status: 'published',
        registrationDeadline: { $lt: now },
        endDate: { $gte: todayStart },
      });
      break;
    case 'completed':
      and.push({
        $or: [{ status: 'completed' }, { status: 'published', endDate: { $lt: todayStart } }],
      });
      break;
    default:
      // Discovery default: everything that is live and not yet over.
      and.push({ status: 'published', endDate: { $gte: todayStart } });
  }

  if (q.sport) and.push({ sport: q.sport.toLowerCase() });
  if (q.state) and.push({ 'venue.state': q.state });
  if (q.city) and.push({ 'venue.city': normalizePlace(q.city) });
  if (q.startDate) and.push({ startDate: { $gte: startOfDay(q.startDate) } });
  if (q.endDate) and.push({ startDate: { $lte: endOfDay(q.endDate) } });
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    and.push({ $or: [{ name: rx }, { 'venue.city': rx }, { 'venue.name': rx }] });
  }
  return { $and: and };
}

export async function listPublic(q: TournamentQuery) {
  const { page, limit, skip } = getPaging(q);
  const filter = buildPublicFilter(q);
  const origin =
    q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;

  if (q.sort === 'nearest' && origin) {
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [origin.lng, origin.lat] },
          distanceField: 'distanceM',
          maxDistance: (q.radiusKm ?? DEFAULT_RADIUS_KM) * 1000,
          spherical: true,
          query: filter,
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }, { $project: LIST_PROJECTION }],
          total: [{ $count: 'n' }],
        },
      },
    ];
    const [res] = await Tournament.aggregate<{ items: unknown[]; total: { n: number }[] }>(
      pipeline,
    );
    const total = res?.total[0]?.n ?? 0;
    return {
      items: (res?.items ?? []).map((t) => toTournamentDTO(t)),
      meta: pageMeta(page, limit, total),
    };
  }

  const sort: Record<string, 1 | -1> =
    q.sort === 'newest'
      ? { createdAt: -1 }
      : q.sort === 'prize'
        ? { prizeMoney: -1, startDate: 1 }
        : q.status === 'completed'
          ? { startDate: -1 }
          : { startDate: 1, _id: 1 };

  const [items, total] = await Promise.all([
    Tournament.find(filter, LIST_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
    Tournament.countDocuments(filter),
  ]);

  return {
    items: items.map((t) => {
      const c = t.venue?.location?.coordinates;
      const d =
        origin && c
          ? Math.round(distanceKm(origin, { lng: c[0]!, lat: c[1]! }) * 10) / 10
          : undefined;
      return toTournamentDTO(t, { distanceKm: d });
    }),
    meta: pageMeta(page, limit, total),
  };
}

/* ---------------------------------------------------------------- access */

function isOwner(t: { organizerId: unknown }, actor?: Actor): boolean {
  if (!actor) return false;
  const org = t.organizerId as { _id?: Types.ObjectId } | Types.ObjectId;
  const id = (
    org && typeof org === 'object' && '_id' in org && org._id ? org._id : org
  ) as Types.ObjectId;
  return id?.toString() === actor.id;
}

async function loadOwned(id: string, actor: Actor) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Tournament not found.');
  const t = await Tournament.findById(id).lean();
  if (!t) throw ApiError.notFound('Tournament not found.');
  if (!isOwner(t, actor) && actor.role !== 'admin')
    throw ApiError.forbidden('You can only manage tournaments you created.');
  return t;
}

/** Logged-in users may contact the organiser; with `registered` visibility only teams that joined. */
async function canContactOrganiser(t: Record<string, any>, actor?: Actor): Promise<boolean> {
  if (!actor || !t.contact?.whatsapp) return false;
  if (t.contact.visibility !== 'registered') return true;
  return Boolean(
    await Registration.exists({
      tournamentId: t._id,
      captainId: actor.id,
      status: { $in: ['pending', 'confirmed', 'waitlisted'] },
    }),
  );
}

/** Public tournaments are visible to all; anything else only to its owner or an admin (404 otherwise). */
export async function getVisible(id: string, actor?: Actor) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Tournament not found.');
  const t = await Tournament.findById(id).populate('organizerId', 'name').lean();
  if (!t) throw ApiError.notFound('Tournament not found.');
  const privileged = isOwner(t, actor) || actor?.role === 'admin';
  if (!privileged && !(PUBLIC_TOURNAMENT_STATUSES as readonly string[]).includes(t.status)) {
    throw ApiError.notFound('Tournament not found.');
  }
  return toTournamentDTO(t, {
    includePrivate: privileged,
    includeContact: privileged || (await canContactOrganiser(t, actor)),
  });
}

/* ----------------------------------------------------------------- writes */

/** Translate validated input into a Mongo $set (dates → instants, place casing, GeoJSON). */
function toUpdateDoc(input: Partial<UpdateInput>): Record<string, unknown> {
  const $set: Record<string, unknown> = {};
  const copy = [
    'name',
    'banner',
    'description',
    'maxTeams',
    'allowWaitlist',
    'entryFee',
    'prizeMoney',
    'prizeDetails',
    'rules',
  ] as const;
  for (const k of copy) if (input[k] !== undefined) $set[k] = input[k];
  if (input.startDate !== undefined) $set.startDate = startOfDay(input.startDate);
  if (input.endDate !== undefined) $set.endDate = endOfDay(input.endDate);
  if (input.registrationDeadline !== undefined)
    $set.registrationDeadline = endOfDay(input.registrationDeadline);
  if (input.contact) {
    $set['contact.whatsapp'] = input.contact.whatsapp;
    $set['contact.visibility'] = input.contact.visibility;
  }
  if (input.venue) {
    const v = input.venue;
    if (v.name !== undefined) $set['venue.name'] = v.name;
    if (v.address !== undefined) $set['venue.address'] = v.address;
    if (v.city !== undefined) $set['venue.city'] = normalizePlace(v.city);
    if (v.state !== undefined) $set['venue.state'] = v.state;
    if (v.coordinates)
      $set['venue.location'] = {
        type: 'Point',
        coordinates: [v.coordinates.lng, v.coordinates.lat],
      };
  }
  return $set;
}

/**
 * A WhatsApp number other than the organiser's own verified login number (or the one already
 * stored on this tournament) must come with a ticket from POST /auth/otp/verify-contact, so nobody
 * can list a stranger's number. Admins are trusted.
 */
async function assertContactVerified(
  actor: Actor,
  contact: ContactInput | undefined,
  current?: { whatsapp?: string | null } | null,
) {
  if (!contact || actor.role === 'admin') return;
  if (current?.whatsapp && current.whatsapp === contact.whatsapp) return;
  const me = await User.findById(actor.id).select('phone').lean();
  if (me?.phone === contact.whatsapp) return;
  if (contact.ticket && verifyContactTicket(contact.ticket, actor.id) === contact.whatsapp) return;
  throw ApiError.badRequest(
    'Verify this WhatsApp number with the OTP first.',
    ERROR_CODES.CONTACT_NOT_VERIFIED,
    [{ path: 'contact.whatsapp', message: 'Verify this number with the OTP first' }],
  );
}

function assertDatesNotPast(input: { startDate?: string; registrationDeadline?: string }) {
  const today = todayIso();
  const errors = [];
  if (input.startDate && input.startDate < today)
    errors.push({ path: 'startDate', message: 'Start date cannot be in the past' });
  if (input.registrationDeadline && input.registrationDeadline < today)
    errors.push({
      path: 'registrationDeadline',
      message: 'Registration deadline cannot be in the past',
    });
  if (errors.length)
    throw ApiError.badRequest(errors[0]!.message, ERROR_CODES.VALIDATION_ERROR, errors);
}

export async function createDraft(actor: Actor, input: DraftInput) {
  assertOwnImages({ banner: input.banner });
  const sport = await resolveActiveSport(input.sport);
  assertDatesNotPast(input);
  await assertContactVerified(actor, input.contact);
  const t = await Tournament.create({
    ...toUpdateDoc(input),
    sport,
    organizerId: actor.id,
    status: 'draft',
  });
  return toTournamentDTO(t.toObject(), { includePrivate: true });
}

/** Re-express a stored tournament as API input so the shared zod schema can validate completeness. */
function toInputShape(t: Record<string, any>) {
  const c = t.venue?.location?.coordinates;
  return {
    name: t.name,
    sport: t.sport,
    banner: t.banner,
    description: t.description ?? '',
    venue: {
      name: t.venue?.name,
      address: t.venue?.address,
      city: t.venue?.city,
      state: t.venue?.state,
      coordinates: c ? { lng: c[0], lat: c[1] } : undefined,
    },
    startDate: toIsoDate(t.startDate),
    endDate: toIsoDate(t.endDate),
    registrationDeadline: toIsoDate(t.registrationDeadline),
    maxTeams: t.maxTeams,
    allowWaitlist: t.allowWaitlist,
    entryFee: t.entryFee,
    prizeMoney: t.prizeMoney,
    prizeDetails: t.prizeDetails,
    rules: t.rules,
    contact: t.contact?.whatsapp
      ? { whatsapp: t.contact.whatsapp, visibility: t.contact.visibility ?? 'members' }
      : undefined,
  };
}

export async function update(id: string, actor: Actor, input: UpdateInput) {
  const t = await loadOwned(id, actor);
  const status = t.status as TournamentStatus;
  const isAdmin = actor.role === 'admin';
  const provided = Object.keys(input).filter(
    (k) => (input as Record<string, unknown>)[k] !== undefined,
  );

  if (!isAdmin) {
    if (status === 'published') {
      const disallowed = provided.filter(
        (k) => !(PUBLISHED_EDITABLE_FIELDS as readonly string[]).includes(k),
      );
      if (disallowed.length) {
        throw ApiError.forbidden(
          `Once published, only description, rules, banner, team capacity and contact can be changed. Contact support to change: ${disallowed.join(', ')}.`,
          ERROR_CODES.TOURNAMENT_NOT_EDITABLE,
        );
      }
    } else if (!(OWNER_FULL_EDIT_STATUSES as readonly string[]).includes(status)) {
      throw ApiError.forbidden(
        `A ${status.replace('_', ' ')} tournament can no longer be edited.`,
        ERROR_CODES.TOURNAMENT_NOT_EDITABLE,
      );
    }
  }

  if (input.maxTeams !== undefined && input.maxTeams < (t.registeredCount ?? 0)) {
    throw ApiError.badRequest(
      `Maximum teams cannot be lower than the ${t.registeredCount} teams already registered.`,
      ERROR_CODES.VALIDATION_ERROR,
      [{ path: 'maxTeams', message: `At least ${t.registeredCount}` }],
    );
  }

  assertOwnImages({ banner: input.banner });
  await assertContactVerified(actor, input.contact, t.contact);
  if (input.sport !== undefined) input.sport = await resolveActiveSport(input.sport);

  // Validate date rules against the merged (stored + incoming) values.
  const current = toInputShape(t);
  const merged = {
    startDate: input.startDate ?? current.startDate,
    endDate: input.endDate ?? current.endDate,
    registrationDeadline: input.registrationDeadline ?? current.registrationDeadline,
  };
  const issues = scheduleIssues(merged);
  if (issues.length)
    throw ApiError.badRequest(issues[0]!.message, ERROR_CODES.VALIDATION_ERROR, issues);
  if (!isAdmin)
    assertDatesNotPast({
      startDate: input.startDate,
      registrationDeadline: input.registrationDeadline,
    });

  const $set = toUpdateDoc(input);
  if (input.sport !== undefined) $set.sport = input.sport;
  // Venue changed without explicit coordinates → drop stale coordinates (re-geocoded on submit).
  const dropCoords = Boolean(
    input.venue &&
    !input.venue.coordinates &&
    (input.venue.address || input.venue.city || input.venue.state),
  );

  const updated = await Tournament.findByIdAndUpdate(
    id,
    { $set, ...(dropCoords ? { $unset: { 'venue.location': '' } } : {}) },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('organizerId', 'name')
    .lean();
  return toTournamentDTO(updated!, { includePrivate: true });
}

export async function submitForVerification(id: string, actor: Actor) {
  const t = await loadOwned(id, actor);
  if (!isOwner(t, actor))
    throw ApiError.forbidden('Only the organiser can submit this tournament.');
  if (t.status !== 'draft' && t.status !== 'rejected') {
    throw ApiError.conflict(
      t.status === 'pending_verification'
        ? 'This tournament is awaiting verification.'
        : 'This tournament has already been submitted.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }

  const parsed = tournamentSchema.safeParse(toInputShape(t));
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw ApiError.badRequest(
      'Please complete all required details before submitting.',
      ERROR_CODES.TOURNAMENT_INCOMPLETE,
      errors,
    );
  }
  assertDatesNotPast(parsed.data);

  const $set: Record<string, unknown> = { status: 'pending_verification', submittedAt: new Date() };
  if (!t.venue?.location) {
    const coords = await geocode([
      t.venue?.name,
      t.venue?.address,
      t.venue?.city,
      t.venue?.state,
      'India',
    ]);
    if (coords) $set['venue.location'] = { type: 'Point', coordinates: [coords.lng, coords.lat] };
  }

  // Conditional update guards against double-submit races.
  const updated = await Tournament.findOneAndUpdate(
    { _id: id, status: { $in: ['draft', 'rejected'] } },
    { $set, $unset: { rejectionReason: '' } },
    { returnDocument: 'after' },
  )
    .populate('organizerId', 'name')
    .lean();
  if (!updated)
    throw ApiError.conflict(
      'This tournament has already been submitted.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  return toTournamentDTO(updated, { includePrivate: true });
}

export async function cancel(id: string, actor: Actor, reason?: string) {
  const t = await loadOwned(id, actor);
  if (!['pending_verification', 'published', 'suspended'].includes(t.status)) {
    throw ApiError.conflict(
      `A ${t.status.replace('_', ' ')} tournament cannot be cancelled.`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }
  const updated = await Tournament.findByIdAndUpdate(
    id,
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' },
  )
    .populate('organizerId', 'name')
    .lean();

  // Release every active/waitlisted registration and tell the captains.
  const regs = await Registration.find({
    tournamentId: id,
    status: { $in: ['pending', 'confirmed', 'waitlisted'] },
  })
    .select('captainId')
    .lean();
  if (regs.length) {
    await Registration.updateMany(
      { _id: { $in: regs.map((r) => r._id) } },
      { $set: { status: 'cancelled', decisionReason: 'Tournament cancelled' } },
    );
    await Tournament.updateOne({ _id: id }, { $set: { registeredCount: 0, waitlistCount: 0 } });
    await notify(
      regs.map((r) => ({
        userId: r.captainId,
        type: 'tournament_cancelled' as const,
        title: 'Tournament cancelled',
        message: `${t.name} has been cancelled by the organiser.${reason ? ` Reason: ${reason}` : ''}`,
        link: `/tournaments/${id}`,
        relatedId: t._id,
      })),
    );
  }
  return toTournamentDTO(
    { ...updated!, registeredCount: 0, waitlistCount: 0 },
    { includePrivate: true },
  );
}

export async function complete(id: string, actor: Actor) {
  const t = await loadOwned(id, actor);
  if (t.status !== 'published')
    throw ApiError.conflict(
      'Only a published tournament can be marked completed.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  if (t.startDate && t.startDate.getTime() > Date.now()) {
    throw ApiError.conflict(
      'A tournament can only be completed after it has started.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }
  const updated = await Tournament.findByIdAndUpdate(
    id,
    { $set: { status: 'completed' } },
    { returnDocument: 'after' },
  )
    .populate('organizerId', 'name')
    .lean();
  return toTournamentDTO(updated!, { includePrivate: true });
}

export async function removeDraft(id: string, actor: Actor) {
  const t = await loadOwned(id, actor);
  if (t.status !== 'draft' && t.status !== 'rejected') {
    throw ApiError.conflict(
      'Only drafts and rejected tournaments can be deleted. Cancel it instead.',
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }
  await Tournament.deleteOne({ _id: id });
}

export async function listMine(
  actor: Actor,
  q: { status?: string; page?: number; limit?: number },
) {
  const { page, limit, skip } = getPaging(q);
  const filter: Record<string, unknown> = { organizerId: actor.id };
  if (q.status && q.status !== 'all') filter.status = q.status;
  const [items, total, counts] = await Promise.all([
    Tournament.find(filter, LIST_PROJECTION).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Tournament.countDocuments(filter),
    Tournament.aggregate<{ _id: TournamentStatus; n: number }>([
      { $match: { organizerId: new Types.ObjectId(actor.id) } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ]);
  return {
    items: items.map((t) => toTournamentDTO(t, { includePrivate: true })),
    meta: {
      ...pageMeta(page, limit, total),
      counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
    },
  };
}
