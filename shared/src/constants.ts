export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'blocked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Tournament lifecycle:
 * draft → pending_verification → (approved →) published → completed | cancelled
 *                              ↘ rejected (owner may edit and resubmit)
 * published ↔ suspended (admin only)
 *
 * Admin approval auto-publishes, so `approved` is only a transitional value kept
 * for spec compatibility; it is never left persisted by the API.
 */
export const TOURNAMENT_STATUSES = [
  'draft',
  'pending_verification',
  'approved',
  'rejected',
  'published',
  'suspended',
  'completed',
  'cancelled',
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

/** Statuses visible in public discovery. */
export const PUBLIC_TOURNAMENT_STATUSES = [
  'published',
  'completed',
] as const satisfies readonly TournamentStatus[];

/** Statuses in which the owner may edit every field. */
export const OWNER_FULL_EDIT_STATUSES = [
  'draft',
  'pending_verification',
  'rejected',
] as const satisfies readonly TournamentStatus[];

/** Fields the owner may still change once a tournament is published. */
export const PUBLISHED_EDITABLE_FIELDS = [
  'description',
  'rules',
  'banner',
  'maxTeams',
  'allowWaitlist',
] as const;

export const REGISTRATION_STATUSES = [
  'pending',
  'confirmed',
  'waitlisted',
  'withdrawn',
  'cancelled',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Registrations that occupy a team slot (count towards maxTeams). */
export const ACTIVE_REGISTRATION_STATUSES = [
  'pending',
  'confirmed',
] as const satisfies readonly RegistrationStatus[];

export const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_REASONS = [
  'fake_tournament',
  'incorrect_information',
  'scam_or_fraud',
  'inappropriate_content',
  'duplicate',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fake_tournament: 'Fake tournament',
  incorrect_information: 'Incorrect information',
  scam_or_fraud: 'Scam or fraud',
  inappropriate_content: 'Inappropriate content',
  duplicate: 'Duplicate listing',
  other: 'Other',
};

export const NOTIFICATION_TYPES = [
  'tournament_approved',
  'tournament_rejected',
  'tournament_suspended',
  'tournament_reinstated',
  'tournament_cancelled',
  'registration_received',
  'registration_confirmed',
  'registration_declined',
  'registration_waitlisted',
  'registration_promoted',
  'registration_withdrawn',
  'report_updated',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const LIMITS = {
  maxPlayersPerTeam: 30,
  maxTeamsPerUser: 20,
  maxRulesPerTournament: 30,
  maxTournamentTeams: 256,
  imageMaxBytes: 2 * 1024 * 1024,
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  pageSizeDefault: 12,
  pageSizeMax: 50,
} as const;
