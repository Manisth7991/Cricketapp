import { Schema, model, type InferSchemaType } from 'mongoose';

const sportSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    icon: { type: String, trim: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 100 },
  },
  { timestamps: true },
);

sportSchema.index({ slug: 1 }, { unique: true });
sportSchema.index({ active: 1, order: 1 });

export type SportDoc = InferSchemaType<typeof sportSchema>;
export const Sport = model('Sport', sportSchema);
