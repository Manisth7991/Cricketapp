import type { Response } from 'express';
import type { PaginationMeta } from '@playlocal/shared';

export function ok<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: Record<string, unknown>,
  status = 200,
) {
  return res
    .status(status)
    .json({ success: true, ...(message ? { message } : {}), data, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T, message?: string) {
  return ok(res, data, message, undefined, 201);
}

export function paginated<T>(res: Response, items: T[], meta: PaginationMeta) {
  return ok(res, items, undefined, meta as unknown as Record<string, unknown>);
}

export function pageMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
