import { Types } from 'mongoose';
import {
  ERROR_CODES,
  TOURNAMENT_STATUSES,
  type AdminStatsDTO,
  type TournamentStatus,
  type UserStatus,
} from '@playlocal/shared';
import { Registration, Report, Team, Tournament, User } from '../models';
import { ApiError } from '../utils/ApiError';
import { escapeRegex, getPaging } from '../utils/pagination';
import { pageMeta } from '../utils/respond';
import { toReportDTO, toTeamDTO, toTournamentDTO, toUserDTO } from './serializers';
import { notify } from './notificationService';

interface Actor {
  id: string;
  role: 'user' | 'admin';
}
interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

const WEEK = 7 * 86_400_000;

/* ------------------------------------------------------------ dashboard */

export async function stats(): Promise<AdminStatsDTO> {
  const since = new Date(Date.now() - WEEK);
  const [
    usersTotal,
    usersBlocked,
    usersNew,
    byStatus,
    regTotal,
    regWeek,
    teams,
    reportsOpen,
    reportsReview,
    bySport,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ status: 'blocked' }),
    User.countDocuments({ role: 'user', createdAt: { $gte: since } }),
    Tournament.aggregate<{ _id: TournamentStatus; n: number }>([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Registration.countDocuments(),
    Registration.countDocuments({ createdAt: { $gte: since } }),
    Team.estimatedDocumentCount(),
    Report.countDocuments({ status: 'open' }),
    Report.countDocuments({ status: 'under_review' }),
    Tournament.aggregate<{ _id: string; n: number }>([
      { $match: { status: { $in: ['published', 'completed'] } } },
      { $group: { _id: '$sport', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]),
  ]);
  const tournaments = Object.fromEntries(TOURNAMENT_STATUSES.map((s) => [s, 0])) as Record<
    TournamentStatus,
    number
  >;
  for (const s of byStatus) tournaments[s._id] = s.n;
  return {
    users: { total: usersTotal, blocked: usersBlocked, newLast7Days: usersNew },
    tournaments: { ...tournaments, total: byStatus.reduce((a, s) => a + s.n, 0) },
    registrations: { total: regTotal, last7Days: regWeek },
    teams: { total: teams },
    reports: { open: reportsOpen, underReview: reportsReview },
    tournamentsBySport: bySport.map((s) => ({ sport: s._id, count: s.n })),
  };
}

/* ---------------------------------------------------------- tournaments */

export async function listTournaments(q: ListQuery) {
  const { page, limit, skip } = getPaging(q);
  const status = q.status ?? 'pending_verification';
  const filter: Record<string, unknown> = {};
  if (status !== 'all') filter.status = status;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { 'venue.city': rx }];
  }
  // Verification queue is FIFO (oldest submission first); other views newest first.
  const sort: Record<string, 1 | -1> =
    status === 'pending_verification' ? { submittedAt: 1 } : { updatedAt: -1 };
  const [items, total] = await Promise.all([
    Tournament.find(filter, { description: 0, rules: 0 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('organizerId', 'name')
      .lean(),
    Tournament.countDocuments(filter),
  ]);
  return {
    items: items.map((t) => toTournamentDTO(t, { includePrivate: true })),
    meta: pageMeta(page, limit, total),
  };
}

export async function getTournament(id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Tournament not found.');
  const t = await Tournament.findById(id)
    .populate('organizerId', 'name email phone status createdAt')
    .lean();
  if (!t) throw ApiError.notFound('Tournament not found.');
  const org = t.organizerId as unknown as {
    _id: Types.ObjectId;
    name: string;
    email?: string;
    phone?: string;
    status: string;
    createdAt: Date;
  };
  const [openReports, organiserTournaments] = await Promise.all([
    Report.countDocuments({ tournamentId: id, status: { $in: ['open', 'under_review'] } }),
    Tournament.countDocuments({ organizerId: org._id }),
  ]);
  return {
    ...toTournamentDTO(t, { includePrivate: true }),
    organizerContact: {
      email: org.email,
      phone: org.phone,
      status: org.status,
      memberSince: org.createdAt,
      tournamentCount: organiserTournaments,
    },
    openReports,
  };
}

/** Moves a tournament between states only if it is still in the expected state (race-safe). */
async function transition(
  id: string,
  from: TournamentStatus[],
  set: Record<string, unknown>,
  unset: Record<string, ''> = {},
) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Tournament not found.');
  const updated = await Tournament.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: 'after' },
  )
    .populate('organizerId', 'name')
    .lean();
  if (!updated) {
    const exists = await Tournament.exists({ _id: id });
    if (!exists) throw ApiError.notFound('Tournament not found.');
    throw ApiError.conflict(
      `Only ${from.map((s) => s.replace('_', ' ')).join(' or ')} tournaments can be changed this way.`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }
  return updated;
}

const ownerId = (t: { organizerId: unknown }) => (t.organizerId as { _id: Types.ObjectId })._id;

export async function approve(id: string, admin: Actor) {
  const now = new Date();
  // Approval auto-publishes (product decision): the Verified badge appears immediately.
  const t = await transition(
    id,
    ['pending_verification'],
    {
      status: 'published',
      verifiedAt: now,
      verifiedBy: admin.id,
      reviewedBy: admin.id,
      reviewedAt: now,
    },
    { rejectionReason: '' },
  );
  await notify({
    userId: ownerId(t),
    type: 'tournament_approved',
    title: 'Tournament approved ✅',
    message: `${t.name} is now live with a Verified badge. Teams can start registering.`,
    link: `/my-tournaments/${t._id}`,
    relatedId: t._id,
  });
  return toTournamentDTO(t, { includePrivate: true });
}

export async function reject(id: string, admin: Actor, reason: string) {
  const t = await transition(id, ['pending_verification'], {
    status: 'rejected',
    rejectionReason: reason,
    reviewedBy: admin.id,
    reviewedAt: new Date(),
  });
  await notify({
    userId: ownerId(t),
    type: 'tournament_rejected',
    title: 'Tournament needs changes',
    message: `${t.name} was not approved: ${reason}`,
    link: `/my-tournaments/${t._id}`,
    relatedId: t._id,
  });
  return toTournamentDTO(t, { includePrivate: true });
}

export async function suspend(id: string, admin: Actor, reason: string) {
  const t = await transition(id, ['published'], {
    status: 'suspended',
    suspensionReason: reason,
    reviewedBy: admin.id,
    reviewedAt: new Date(),
  });
  await notify({
    userId: ownerId(t),
    type: 'tournament_suspended',
    title: 'Tournament suspended',
    message: `${t.name} has been suspended and hidden from discovery: ${reason}`,
    link: `/my-tournaments/${t._id}`,
    relatedId: t._id,
  });
  return toTournamentDTO(t, { includePrivate: true });
}

export async function reinstate(id: string, admin: Actor) {
  const t = await transition(
    id,
    ['suspended'],
    { status: 'published', reviewedBy: admin.id, reviewedAt: new Date() },
    { suspensionReason: '' },
  );
  await notify({
    userId: ownerId(t),
    type: 'tournament_reinstated',
    title: 'Tournament reinstated',
    message: `${t.name} is visible again.`,
    link: `/my-tournaments/${t._id}`,
    relatedId: t._id,
  });
  return toTournamentDTO(t, { includePrivate: true });
}

/* ---------------------------------------------------------------- users */

export async function listUsers(q: ListQuery) {
  const { page, limit, skip } = getPaging(q);
  const filter: Record<string, unknown> = {};
  if (q.status === 'active' || q.status === 'blocked') filter.status = q.status;
  if (q.status === 'admin') filter.role = 'admin';
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  // Two grouped counts for the whole page instead of 2×N queries.
  const [teamCounts, tournamentCounts] = await Promise.all([
    Team.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { captainId: { $in: ids } } },
      { $group: { _id: '$captainId', n: { $sum: 1 } } },
    ]),
    Tournament.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { organizerId: { $in: ids } } },
      { $group: { _id: '$organizerId', n: { $sum: 1 } } },
    ]),
  ]);
  const tc = new Map(teamCounts.map((c) => [c._id.toString(), c.n]));
  const oc = new Map(tournamentCounts.map((c) => [c._id.toString(), c.n]));
  return {
    items: users.map((u) => ({
      ...toUserDTO(u),
      teamCount: tc.get(u._id.toString()) ?? 0,
      tournamentCount: oc.get(u._id.toString()) ?? 0,
    })),
    meta: pageMeta(page, limit, total),
  };
}

export async function setUserStatus(id: string, admin: Actor, status: UserStatus) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('User not found.');
  if (id === admin.id) throw ApiError.badRequest("You can't change your own account status.");
  const target = await User.findById(id).select('role').lean();
  if (!target) throw ApiError.notFound('User not found.');
  if (target.role === 'admin') throw ApiError.forbidden("Admin accounts can't be blocked here.");
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { status } },
    { returnDocument: 'after' },
  ).lean();
  return toUserDTO(user!);
}

/* ---------------------------------------------------------------- teams */

export async function listTeams(q: ListQuery) {
  const { page, limit, skip } = getPaging(q);
  const filter: Record<string, unknown> = {};
  if (q.status) filter.sport = q.status; // `status` doubles as sport filter for teams
  if (q.search) filter.name = new RegExp(escapeRegex(q.search), 'i');
  const [items, total] = await Promise.all([
    Team.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('captainId', 'name')
      .lean(),
    Team.countDocuments(filter),
  ]);
  return { items: items.map(toTeamDTO), meta: pageMeta(page, limit, total) };
}

/* -------------------------------------------------------------- reports */

export async function listReports(q: ListQuery) {
  const { page, limit, skip } = getPaging(q);
  const filter: Record<string, unknown> = {};
  const status = q.status ?? 'open';
  if (status !== 'all') filter.status = status;
  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reporterId', 'name')
      .populate('tournamentId', 'name status')
      .lean(),
    Report.countDocuments(filter),
  ]);
  return { items: items.map(toReportDTO), meta: pageMeta(page, limit, total) };
}

export async function updateReport(
  id: string,
  admin: Actor,
  input: { status: 'open' | 'under_review' | 'resolved' | 'dismissed'; resolutionNote?: string },
) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Report not found.');
  const report = await Report.findByIdAndUpdate(
    id,
    { $set: { status: input.status, resolutionNote: input.resolutionNote, handledBy: admin.id } },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('reporterId', 'name')
    .populate('tournamentId', 'name status')
    .lean();
  if (!report) throw ApiError.notFound('Report not found.');
  if (input.status === 'resolved' || input.status === 'dismissed') {
    const reporter = report.reporterId as unknown as { _id: Types.ObjectId };
    const t = report.tournamentId as unknown as { name?: string } | null;
    await notify({
      userId: reporter._id,
      type: 'report_updated',
      title:
        input.status === 'resolved'
          ? 'Thanks — we acted on your report'
          : 'Your report was reviewed',
      message: `Your report about ${t?.name ?? 'a tournament'} was ${input.status}.${input.resolutionNote ? ` ${input.resolutionNote}` : ''}`,
      relatedId: report._id,
    });
  }
  return toReportDTO(report);
}
