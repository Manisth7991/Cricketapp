import type { Types } from 'mongoose';
import {
  getAvailability,
  isVerifiedStatus,
  type NotificationDTO,
  type RegistrationDTO,
  type ReportDTO,
  type SportDTO,
  type TeamDTO,
  type TournamentDTO,
  type TournamentStatus,
  type UserDTO,
} from '@playlocal/shared';
import { toIsoDate } from '../utils/dates';

/* Serializers accept lean() documents (plain objects) — never hydrated docs — for speed. */

type Id = Types.ObjectId | string;
const sid = (v: Id | undefined | null) => (v ? v.toString() : '');
const iso = (d: Date | undefined | null) => (d ? new Date(d).toISOString() : undefined);
const nameRef = (v: unknown): { id: string; name: string } | undefined => {
  if (v && typeof v === 'object' && 'name' in v && '_id' in v) {
    const o = v as { _id: Id; name: string };
    return { id: sid(o._id), name: o.name };
  }
  return undefined;
};

export function toUserDTO(u: any): UserDTO {
  return {
    id: sid(u._id),
    name: u.name,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    role: u.role,
    status: u.status,
    profileImage: u.profileImage ?? undefined,
    location: u.location
      ? { city: u.location.city, state: u.location.state, country: u.location.country }
      : undefined,
    createdAt: iso(u.createdAt)!,
  };
}

export function toSportDTO(s: any): SportDTO {
  return {
    id: sid(s._id),
    name: s.name,
    slug: s.slug,
    icon: s.icon ?? undefined,
    active: s.active,
    order: s.order,
  };
}

export function toTeamDTO(t: any): TeamDTO {
  const players = (t.players ?? []).map((p: any) => ({
    id: sid(p._id),
    name: p.name,
    phone: p.phone ?? undefined,
    role: p.role ?? undefined,
    image: p.image ?? undefined,
  }));
  const captain = nameRef(t.captainId);
  return {
    id: sid(t._id),
    name: t.name,
    sport: t.sport,
    logo: t.logo ?? undefined,
    description: t.description ?? undefined,
    captainId: captain ? captain.id : sid(t.captainId),
    captain,
    location: t.location ?? undefined,
    players,
    playerCount: t.playerCount ?? players.length,
    createdAt: iso(t.createdAt)!,
    updatedAt: iso(t.updatedAt)!,
  };
}

export function toTournamentDTO(
  t: any,
  opts: { distanceKm?: number; includePrivate?: boolean; includeContact?: boolean } = {},
): TournamentDTO {
  const status = t.status as TournamentStatus;
  const organizer = nameRef(t.organizerId);
  const coords = t.venue?.location?.coordinates as [number, number] | undefined;
  const dto: TournamentDTO = {
    id: sid(t._id),
    name: t.name,
    sport: t.sport,
    banner: t.banner ?? undefined,
    description: t.description ?? undefined,
    organizer,
    organizerId: organizer ? organizer.id : sid(t.organizerId),
    venue: {
      name: t.venue?.name ?? undefined,
      address: t.venue?.address ?? undefined,
      city: t.venue?.city ?? undefined,
      state: t.venue?.state ?? undefined,
      coordinates: coords ? { lng: coords[0], lat: coords[1] } : undefined,
    },
    startDate: toIsoDate(t.startDate),
    endDate: toIsoDate(t.endDate),
    registrationDeadline: iso(t.registrationDeadline),
    maxTeams: t.maxTeams ?? undefined,
    allowWaitlist: t.allowWaitlist ?? true,
    entryFee: t.entryFee ?? 0,
    prizeMoney: t.prizeMoney ?? 0,
    prizeDetails: t.prizeDetails ?? undefined,
    rules: t.rules ?? [],
    status,
    verified: isVerifiedStatus(status) && Boolean(t.verifiedAt),
    registeredCount: t.registeredCount ?? 0,
    waitlistCount: t.waitlistCount ?? 0,
    availability: getAvailability(t),
    distanceKm:
      opts.distanceKm ??
      (typeof t.distanceM === 'number' ? Math.round(t.distanceM / 100) / 10 : undefined),
    submittedAt: iso(t.submittedAt),
    verifiedAt: iso(t.verifiedAt),
    createdAt: iso(t.createdAt)!,
    updatedAt: iso(t.updatedAt)!,
  };
  // The number itself only goes to viewers allowed to contact the organiser (service decides).
  if (t.contact?.whatsapp) {
    dto.contact = {
      visibility: t.contact.visibility ?? 'members',
      ...(opts.includeContact || opts.includePrivate ? { whatsapp: t.contact.whatsapp } : {}),
    };
  }
  // Moderation reasons are only for the owner/admin.
  if (opts.includePrivate) {
    dto.rejectionReason = t.rejectionReason ?? undefined;
    dto.suspensionReason = t.suspensionReason ?? undefined;
  }
  return dto;
}

export function toRegistrationDTO(
  r: any,
  extra: { waitlistPosition?: number; includeContact?: boolean } = {},
): RegistrationDTO {
  const t =
    r.tournamentId && typeof r.tournamentId === 'object' && 'name' in r.tournamentId
      ? r.tournamentId
      : null;
  const team = r.teamId && typeof r.teamId === 'object' && 'name' in r.teamId ? r.teamId : null;
  const cap =
    r.captainId && typeof r.captainId === 'object' && 'name' in r.captainId ? r.captainId : null;
  return {
    id: sid(r._id),
    status: r.status,
    tournamentId: t ? sid(t._id) : sid(r.tournamentId),
    teamId: team ? sid(team._id) : sid(r.teamId),
    captainId: cap ? sid(cap._id) : sid(r.captainId),
    note: r.note ?? undefined,
    decisionReason: r.decisionReason ?? undefined,
    waitlistPosition: extra.waitlistPosition,
    tournament: t
      ? (() => {
          const full = toTournamentDTO(t);
          return {
            id: full.id,
            name: full.name,
            sport: full.sport,
            banner: full.banner,
            startDate: full.startDate,
            endDate: full.endDate,
            venue: full.venue,
            status: full.status,
            verified: full.verified,
            registrationDeadline: full.registrationDeadline,
          };
        })()
      : undefined,
    team: team
      ? {
          id: sid(team._id),
          name: team.name,
          logo: team.logo ?? undefined,
          sport: team.sport,
          playerCount: team.players?.length ?? 0,
          players: extra.includeContact ? toTeamDTO(team).players : undefined,
        }
      : undefined,
    captain: cap
      ? {
          id: sid(cap._id),
          name: cap.name,
          phone: extra.includeContact ? (cap.phone ?? undefined) : undefined,
          email: extra.includeContact ? (cap.email ?? undefined) : undefined,
        }
      : undefined,
    registeredAt: iso(r.registeredAt ?? r.createdAt)!,
    updatedAt: iso(r.updatedAt)!,
  };
}

export function toNotificationDTO(n: any): NotificationDTO {
  return {
    id: sid(n._id),
    title: n.title,
    message: n.message,
    type: n.type,
    relatedId: n.relatedId ? sid(n.relatedId) : undefined,
    link: n.link ?? undefined,
    read: n.read,
    createdAt: iso(n.createdAt)!,
  };
}

export function toReportDTO(r: any): ReportDTO {
  const t =
    r.tournamentId && typeof r.tournamentId === 'object' && 'name' in r.tournamentId
      ? r.tournamentId
      : null;
  return {
    id: sid(r._id),
    reason: r.reason,
    description: r.description,
    status: r.status,
    resolutionNote: r.resolutionNote ?? undefined,
    reporter: nameRef(r.reporterId),
    tournament: t ? { id: sid(t._id), name: t.name, status: t.status } : undefined,
    createdAt: iso(r.createdAt)!,
    updatedAt: iso(r.updatedAt)!,
  };
}
