import { z } from 'zod';
import {
  CONTACT_VISIBILITY,
  LIMITS,
  REPORT_REASONS,
  REPORT_STATUSES,
  USER_STATUSES,
} from './constants';

/* ------------------------------------------------------------------ helpers */

/** Normalises Indian phone numbers to 10 digits; other numbers to bare digits. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`).optional();

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((v) => /^\d{10,15}$/.test(v), 'Enter a valid phone number');

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? normalizePhone(v) : undefined))
  .refine((v) => v === undefined || /^\d{10,15}$/.test(v), 'Enter a valid phone number');

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.email().safeParse(v).success, 'Enter a valid email address');

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Invalid image URL')
  .optional();

export const isoDate = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .min(1, `${label} is required`)
    .regex(ISO_DATE, `${label} must be a valid date`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} must be a valid date`);

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/* --------------------------------------------------------------------- auth */

export const locationSchema = z.object({
  city: text(2, 80, 'City'),
  state: text(2, 80, 'State'),
  country: z.string().trim().max(80).optional(),
});

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Indian mobile numbers only (10 digits starting 6-9) — OTP SMS is limited to India to block SMS-pumping fraud. */
export const indianMobileSchema = z
  .string({ error: 'Mobile number is required' })
  .trim()
  .transform(normalizePhone)
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number');

export const OTP_LENGTH = 6;

export const otpRequestSchema = z.object({ phone: indianMobileSchema });

export const otpVerifySchema = z.object({
  phone: indianMobileSchema,
  code: z
    .string({ error: 'Enter the OTP' })
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit OTP`),
});

/** Firebase Phone Auth: the client's ID token after `confirmationResult.confirm(code)`. */
export const firebaseTokenSchema = z.object({
  idToken: z.string().trim().min(20, 'Verification token missing').max(4096),
});

/** Second step for new numbers: the verified-phone ticket + profile basics. */
export const otpCompleteSchema = z.object({
  ticket: z.string().min(20, 'Session expired — please verify your number again').max(2000),
  name: text(2, 60, 'Name'),
  email: optionalEmail,
});

export const updateProfileSchema = z.object({
  name: text(2, 60, 'Name').optional(),
  email: optionalEmail,
  profileImage: imageUrl,
  location: locationSchema.optional(),
});

/* -------------------------------------------------------------------- teams */

export const playerSchema = z.object({
  name: text(2, 60, 'Player name'),
  phone: optionalPhone,
  role: optionalText(40, 'Role'),
  image: imageUrl,
});

export const teamSchema = z.object({
  name: text(2, 60, 'Team name'),
  sport: text(1, 40, 'Sport'),
  description: optionalText(500, 'Description'),
  logo: imageUrl,
  location: z
    .object({
      city: z.string().trim().max(80).optional(),
      state: z.string().trim().max(80).optional(),
    })
    .optional(),
  players: z.array(playerSchema).max(LIMITS.maxPlayersPerTeam).optional(),
});

export const updateTeamSchema = teamSchema.omit({ players: true }).partial();

/* -------------------------------------------------------------- tournaments */

/** Organiser contact shown to players as a WhatsApp button (never as plain text). */
export const tournamentContactSchema = z.object(
  {
    whatsapp: indianMobileSchema,
    visibility: z.enum(CONTACT_VISIBILITY).default('members'),
    /** Required when the number differs from the organiser's login number (POST /auth/otp/verify-contact). Never stored. */
    ticket: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => v || undefined),
  },
  { error: 'Add a WhatsApp number so players can reach you' },
);

export const tournamentBasicSchema = z.object({
  name: text(3, 100, 'Tournament name'),
  sport: text(1, 40, 'Sport'),
  banner: imageUrl,
  description: text(20, 3000, 'Description'),
  contact: tournamentContactSchema,
});

export const venueSchema = z.object({
  name: text(2, 120, 'Venue name'),
  address: text(5, 300, 'Address'),
  city: text(2, 80, 'Village/City'),
  state: text(2, 80, 'State'),
  coordinates: coordinatesSchema.optional(),
});

export const tournamentLocationSchema = z.object({ venue: venueSchema });

const scheduleShape = z.object({
  startDate: isoDate('Start date'),
  endDate: isoDate('End date'),
  registrationDeadline: isoDate('Registration deadline'),
  maxTeams: z
    .number({ error: 'Maximum teams is required' })
    .int()
    .min(2, 'At least 2 teams')
    .max(LIMITS.maxTournamentTeams, `At most ${LIMITS.maxTournamentTeams} teams`),
  allowWaitlist: z.boolean().optional(),
});

type ScheduleLike = { startDate?: string; endDate?: string; registrationDeadline?: string };

/** Cross-field date rules. ISO yyyy-mm-dd strings compare correctly as strings. */
export function scheduleIssues(v: ScheduleLike): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (v.startDate && v.endDate && v.endDate < v.startDate)
    issues.push({ path: 'endDate', message: 'End date cannot be before start date' });
  if (v.startDate && v.registrationDeadline && v.registrationDeadline > v.startDate)
    issues.push({
      path: 'registrationDeadline',
      message: 'Registration deadline must be on or before the start date',
    });
  return issues;
}

const withScheduleRules = <T extends z.ZodType<ScheduleLike>>(schema: T) =>
  schema.superRefine((v, ctx) => {
    for (const i of scheduleIssues(v))
      ctx.addIssue({ code: 'custom', path: [i.path], message: i.message });
  });

export const tournamentScheduleSchema = withScheduleRules(scheduleShape);

const rulesShape = z.object({
  entryFee: z.number().int().min(0, 'Cannot be negative').max(10_000_000).optional(),
  prizeMoney: z.number().int().min(0, 'Cannot be negative').max(100_000_000).optional(),
  prizeDetails: optionalText(500, 'Prize details'),
  rules: z
    .array(z.string().trim().min(1).max(300, 'Each rule must be at most 300 characters'))
    .max(LIMITS.maxRulesPerTournament, `At most ${LIMITS.maxRulesPerTournament} rules`)
    .optional(),
});
export const tournamentRulesSchema = rulesShape;

const fullShape = tournamentBasicSchema
  .extend(tournamentLocationSchema.shape)
  .extend(scheduleShape.shape)
  .extend(rulesShape.shape);

/** Complete tournament — required for submission to verification. */
export const tournamentSchema = withScheduleRules(fullShape);

/** Drafts: only name + sport required; everything else may be filled later. */
export const tournamentDraftSchema = withScheduleRules(
  fullShape.partial().extend({
    name: tournamentBasicSchema.shape.name,
    sport: tournamentBasicSchema.shape.sport,
    description: z.string().trim().max(3000).optional(),
    venue: venueSchema.partial().optional(),
  }),
);

export const tournamentUpdateSchema = withScheduleRules(
  fullShape.partial().extend({
    description: z.string().trim().max(3000).optional(),
    venue: venueSchema.partial().optional(),
  }),
);

export const TOURNAMENT_SORTS = ['date', 'newest', 'nearest', 'prize'] as const;
export const TOURNAMENT_AVAILABILITY = ['open', 'upcoming', 'closed', 'completed'] as const;
export type TournamentAvailability = (typeof TOURNAMENT_AVAILABILITY)[number];

const numericQuery = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : Number(v)),
  z.number().optional(),
);

export const tournamentQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  sport: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  startDate: isoDate('From date').optional(),
  endDate: isoDate('To date').optional(),
  status: z.enum(TOURNAMENT_AVAILABILITY).optional(),
  sort: z.enum(TOURNAMENT_SORTS).optional(),
  lat: numericQuery.pipe(z.number().min(-90).max(90).optional()),
  lng: numericQuery.pipe(z.number().min(-180).max(180).optional()),
  radiusKm: numericQuery.pipe(z.number().min(1).max(500).optional()),
  page: numericQuery.pipe(z.number().int().min(1).optional()),
  limit: numericQuery.pipe(z.number().int().min(1).max(LIMITS.pageSizeMax).optional()),
});
export type TournamentQuery = z.infer<typeof tournamentQuerySchema>;

export const paginationQuerySchema = z.object({
  page: numericQuery.pipe(z.number().int().min(1).optional()),
  limit: numericQuery.pipe(z.number().int().min(1).max(LIMITS.pageSizeMax).optional()),
  search: z.string().trim().max(80).optional(),
  status: z.string().trim().max(40).optional(),
});

/* ------------------------------------------------------------ registrations */

export const registrationSchema = z.object({
  teamId: objectIdSchema,
  note: optionalText(300, 'Note'),
});

export const registrationDecisionSchema = z.object({
  reason: optionalText(300, 'Reason'),
});

/* ------------------------------------------------------------------ reports */

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: 'Select a reason' }),
  description: text(10, 1000, 'Description'),
});

/* -------------------------------------------------------------------- admin */

export const reasonSchema = z.object({ reason: text(5, 500, 'Reason') });

export const adminReportUpdateSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  resolutionNote: optionalText(500, 'Resolution note'),
});

export const adminUserStatusSchema = z.object({ status: z.enum(USER_STATUSES) });

export const sportSchema = z.object({
  name: text(2, 40, 'Sport name'),
  icon: optionalText(8, 'Icon'),
  active: z.boolean().optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

export const updateSportSchema = sportSchema.partial();

/* ------------------------------------------------------------------- types */
// NOTE: schemas intentionally carry no `.default()` — in Zod 4 defaults also fire inside
// `.partial()`, which would silently overwrite fields on PATCH. Defaults live in the models.

export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
export type OtpCompleteInput = z.input<typeof otpCompleteSchema>;
export type FirebaseTokenInput = z.input<typeof firebaseTokenSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type PlayerInput = z.input<typeof playerSchema>;
export type TeamInput = z.input<typeof teamSchema>;
export type TournamentContactInput = z.input<typeof tournamentContactSchema>;
export type TournamentInput = z.input<typeof tournamentSchema>;
export type TournamentDraftInput = z.input<typeof tournamentDraftSchema>;
export type RegistrationInput = z.input<typeof registrationSchema>;
export type ReportInput = z.input<typeof reportSchema>;
export type SportInput = z.input<typeof sportSchema>;
