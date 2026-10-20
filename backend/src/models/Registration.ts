import { Schema, model, type InferSchemaType } from 'mongoose';
import { REGISTRATION_STATUSES } from '@playlocal/shared';

const registrationSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    captainId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: REGISTRATION_STATUSES, default: 'pending', required: true },
    note: { type: String, trim: true, maxlength: 300 },
    decisionReason: { type: String, trim: true, maxlength: 300 },
    registeredAt: { type: Date, default: () => new Date() },
    // Used to order the waitlist (FIFO by the time a team entered it).
    waitlistedAt: { type: Date },
  },
  { timestamps: true },
);

// One registration document per team per tournament (re-registration reuses it).
registrationSchema.index({ tournamentId: 1, teamId: 1 }, { unique: true });
registrationSchema.index({ tournamentId: 1, status: 1, waitlistedAt: 1 });
registrationSchema.index({ captainId: 1, updatedAt: -1 });
registrationSchema.index({ teamId: 1, status: 1 });
registrationSchema.index({ createdAt: -1 });

export type RegistrationDoc = InferSchemaType<typeof registrationSchema>;
export const Registration = model('Registration', registrationSchema);
