import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One active OTP per phone. Only an HMAC of the code is stored, never the code itself.
 * Documents expire automatically (TTL index) shortly after the OTP becomes invalid.
 */
const otpChallengeSchema = new Schema(
  {
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    // Rolling send counter for the hourly cap (anti SMS-pumping).
    windowStartedAt: { type: Date, required: true },
    sendsInWindow: { type: Number, default: 1 },
    // max(expiresAt, windowStartedAt + 1h): the doc lives until both the OTP and the hourly cap are done.
    purgeAt: { type: Date, required: true },
  },
  { timestamps: false },
);

otpChallengeSchema.index({ phone: 1 }, { unique: true });
otpChallengeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export type OtpChallengeDoc = InferSchemaType<typeof otpChallengeSchema>;
export const OtpChallenge = model('OtpChallenge', otpChallengeSchema);
