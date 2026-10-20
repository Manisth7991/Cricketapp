import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { USER_ROLES, USER_STATUSES } from '@playlocal/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Users sign in with a verified phone (OTP); admins use email + password.
    // Partial unique indexes so absent values don't collide.
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    phoneVerifiedAt: { type: Date },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user', required: true },
    profileImage: { type: String },
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: 'India' },
    },
    status: { type: String, enum: USER_STATUSES, default: 'active', required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
);
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export type UserHydrated = HydratedDocument<UserDoc>;
export const User = model('User', userSchema);
