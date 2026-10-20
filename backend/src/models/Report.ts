import { Schema, model, type InferSchemaType } from 'mongoose';
import { REPORT_REASONS, REPORT_STATUSES } from '@playlocal/shared';

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, trim: true, maxlength: 1000, required: true },
    status: { type: String, enum: REPORT_STATUSES, default: 'open', required: true },
    resolutionNote: { type: String, trim: true, maxlength: 500 },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ tournamentId: 1 });
// At most one unresolved report per user per tournament.
reportSchema.index(
  { reporterId: 1, tournamentId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'under_review'] } } },
);

export type ReportDoc = InferSchemaType<typeof reportSchema>;
export const Report = model('Report', reportSchema);
