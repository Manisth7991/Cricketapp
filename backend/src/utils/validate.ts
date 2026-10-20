import type { z } from 'zod';
import { ERROR_CODES } from '@playlocal/shared';
import { ApiError } from './ApiError';

/** Parse untrusted input with a zod schema or throw a 400 with field-level errors. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const errors = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  throw ApiError.badRequest(
    errors[0]?.message ?? 'Invalid input',
    ERROR_CODES.VALIDATION_ERROR,
    errors,
  );
}
