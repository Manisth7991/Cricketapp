import { Schema, model, type InferSchemaType } from 'mongoose';

const playerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, trim: true },
    role: { type: String, trim: true, maxlength: 40 },
    image: { type: String },
  },
  { timestamps: false },
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    sport: { type: String, required: true, lowercase: true, trim: true },
    logo: { type: String },
    captainId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, trim: true, maxlength: 500 },
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
    },
    players: { type: [playerSchema], default: [] },
  },
  { timestamps: true },
);

teamSchema.index({ captainId: 1, updatedAt: -1 });
// A captain can't own two teams with the same name for the same sport.
teamSchema.index(
  { captainId: 1, sport: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
teamSchema.index({ createdAt: -1 });

export type TeamDoc = InferSchemaType<typeof teamSchema>;
export const Team = model('Team', teamSchema);
