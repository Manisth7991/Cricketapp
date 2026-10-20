import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiClientError } from '@/services/api';

/** Map server-side field errors onto react-hook-form fields. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiClientError) || !error.fieldErrors.length) return false;
  for (const fe of error.fieldErrors) {
    if (fe.path) setError(fe.path as Path<T>, { type: 'server', message: fe.message });
  }
  return true;
}
