import { Schema, model, type InferSchemaType } from 'mongoose';
import { TOURNAMENT_STATUSES } from '@playlocal/shared';

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false },
);

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    sport: { type: String, required: true, lowercase: true, trim: true },
    banner: { type: String },
    description: { type: String, trim: true, maxlength: 3000 },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    venue: {
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      location: { type: pointSchema, default: undefined },
    },
    startDate: { type: Date },
    endDate: { type: Date },
    registrationDeadline: { type: Date },
    maxTeams: { type: Number, min: 2 },
    allowWaitlist: { type: Boolean, default: true },
    entryFee: { type: Number, default: 0, min: 0 },
    prizeMoney: { type: Number, default: 0, min: 0 },
    prizeDetails: { type: String, trim: true },
    rules: { type: [String], default: [] },
    status: { type: String, enum: TOURNAMENT_STATUSES, default: 'draft', required: true },

    // Denormalised counters — maintained atomically by the registration service.
    registeredCount: { type: Number, default: 0, min: 0 },
    waitlistCount: { type: Number, default: 0, min: 0 },

    // Verification audit trail
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
    suspensionReason: { type: String, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

// Public discovery: status + date is the main access path.
tournamentSchema.index({ status: 1, startDate: 1 });
tournamentSchema.index({ status: 1, sport: 1, startDate: 1 });
tournamentSchema.index({ status: 1, 'venue.state': 1, 'venue.city': 1, startDate: 1 });
tournamentSchema.index({ status: 1, prizeMoney: -1 });
tournamentSchema.index({ status: 1, createdAt: -1 });
tournamentSchema.index({ organizerId: 1, updatedAt: -1 });
tournamentSchema.index({ status: 1, submittedAt: 1 }); // admin verification queue
tournamentSchema.index({ 'venue.location': '2dsphere' }, { sparse: true });

export type TournamentDoc = InferSchemaType<typeof tournamentSchema>;
export const Tournament = model('Tournament', tournamentSchema);
