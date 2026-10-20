import {
  slugify,
  type SportDTO,
  type sportSchema,
  type updateSportSchema,
} from '@playlocal/shared';
import type { z } from 'zod';
import { Sport } from '../models';
import { ApiError } from '../utils/ApiError';
import { toSportDTO } from './serializers';

// Sports are read on almost every request path but change rarely → small in-process cache.
let cache: { at: number; data: SportDTO[] } | null = null;
const TTL = 5 * 60_000;

export function invalidateSports() {
  cache = null;
}

export async function listActive(): Promise<SportDTO[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const data = (await Sport.find({ active: true }).sort({ order: 1, name: 1 }).lean()).map(
    toSportDTO,
  );
  cache = { at: Date.now(), data };
  return data;
}

export async function listAll(): Promise<SportDTO[]> {
  return (await Sport.find().sort({ order: 1, name: 1 }).lean()).map(toSportDTO);
}

/** Accepts a slug or a display name; returns the canonical slug of an *active* sport. */
export async function resolveActiveSport(input: string): Promise<string> {
  const slug = slugify(input);
  const sport = (await listActive()).find((s) => s.slug === slug);
  if (!sport)
    throw ApiError.badRequest('Select a valid sport.', 'VALIDATION_ERROR', [
      { path: 'sport', message: 'Select a valid sport' },
    ]);
  return sport.slug;
}

export async function create(input: z.output<typeof sportSchema>) {
  const slug = slugify(input.name);
  if (await Sport.exists({ slug }))
    throw ApiError.conflict('A sport with this name already exists.');
  const sport = await Sport.create({ ...input, slug });
  invalidateSports();
  return toSportDTO(sport.toObject());
}

export async function update(id: string, input: z.output<typeof updateSportSchema>) {
  // Slug is immutable: existing tournaments/teams reference it.
  const sport = await Sport.findByIdAndUpdate(
    id,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!sport) throw ApiError.notFound('Sport not found.');
  invalidateSports();
  return toSportDTO(sport);
}
