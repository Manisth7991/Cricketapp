import { LIMITS } from '@playlocal/shared';

export function getPaging(q: { page?: number; limit?: number }) {
  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? LIMITS.pageSizeDefault, LIMITS.pageSizeMax);
  return { page, limit, skip: (page - 1) * limit };
}

/** Escape user text for safe use inside a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
