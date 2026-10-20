import type {
  NotificationType,
  RegistrationStatus,
  ReportReason,
  ReportStatus,
  TournamentStatus,
  UserRole,
  UserStatus,
} from './constants';
import type { ErrorCode } from './errors';

/* ------------------------------------------------------------ API envelope */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T, M = Record<string, unknown>> {
  success: true;
  message?: string;
  data: T;
  meta?: M;
}

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: ErrorCode;
  errors: FieldError[];
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/* --------------------------------------------------------------------- DTOs */

export interface Location {
  city?: string;
  state?: string;
  country?: string;
}

export interface UserDTO {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  profileImage?: string;
  location?: Location;
  createdAt: string;
}

export interface SportDTO {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  active: boolean;
  order: number;
}

export interface PlayerDTO {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  image?: string;
}

export interface TeamDTO {
  id: string;
  name: string;
  sport: string;
  logo?: string;
  description?: string;
  captainId: string;
  captain?: { id: string; name: string };
  location?: { city?: string; state?: string };
  players: PlayerDTO[];
  playerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VenueDTO {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  coordinates?: { lat: number; lng: number };
}

/** Derived, display-oriented registration availability. */
export type RegistrationAvailability = 'open' | 'waitlist' | 'full' | 'closed' | 'unavailable';

export interface TournamentDTO {
  id: string;
  name: string;
  sport: string;
  banner?: string;
  description?: string;
  organizer?: { id: string; name: string };
  organizerId: string;
  venue: VenueDTO;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  maxTeams?: number;
  allowWaitlist: boolean;
  entryFee: number;
  prizeMoney: number;
  prizeDetails?: string;
  rules: string[];
  status: TournamentStatus;
  verified: boolean;
  registeredCount: number;
  waitlistCount: number;
  availability: RegistrationAvailability;
  /** Present when the request included coordinates and the venue has them. */
  distanceKm?: number;
  rejectionReason?: string;
  suspensionReason?: string;
  submittedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TournamentSummaryDTO = Omit<TournamentDTO, 'description' | 'rules' | 'prizeDetails'>;

export interface RegistrationDTO {
  id: string;
  status: RegistrationStatus;
  tournamentId: string;
  teamId: string;
  captainId: string;
  note?: string;
  decisionReason?: string;
  waitlistPosition?: number;
  tournament?: Pick<
    TournamentDTO,
    | 'id'
    | 'name'
    | 'sport'
    | 'banner'
    | 'startDate'
    | 'endDate'
    | 'venue'
    | 'status'
    | 'verified'
    | 'registrationDeadline'
  >;
  team?: Pick<TeamDTO, 'id' | 'name' | 'logo' | 'sport' | 'playerCount'> & {
    players?: PlayerDTO[];
  };
  captain?: { id: string; name: string; phone?: string; email?: string };
  registeredAt: string;
  updatedAt: string;
}

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface ReportDTO {
  id: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  resolutionNote?: string;
  reporter?: { id: string; name: string };
  tournament?: { id: string; name: string; status: TournamentStatus };
  createdAt: string;
  updatedAt: string;
}

export interface AdminStatsDTO {
  users: { total: number; blocked: number; newLast7Days: number };
  tournaments: Record<TournamentStatus, number> & { total: number };
  registrations: { total: number; last7Days: number };
  teams: { total: number };
  reports: { open: number; underReview: number };
  tournamentsBySport: { sport: string; count: number }[];
}
