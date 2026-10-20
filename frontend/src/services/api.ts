import type {
  ApiErrorBody,
  ApiSuccess,
  ErrorCode,
  FieldError,
  PaginationMeta,
} from '@playlocal/shared';
import { config } from '@/lib/config';

/**
 * Centralised HTTP client — every API call in the app goes through here.
 * Built on native fetch (no axios) to keep the initial bundle small.
 */

/** Normalised error thrown by every service call. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly fieldErrors: FieldError[];

  constructor(
    status: number,
    code: ApiClientError['code'],
    message: string,
    fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface RequestOptions {
  params?: object;
  signal?: AbortSignal;
  timeout?: number;
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(fn: UnauthorizedListener) {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
}

const DEFAULT_TIMEOUT = 20_000;
const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

export function buildUrl(path: string, params?: object): string {
  const url = `${config.apiUrl}${path}`;
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

/** Convert a non-2xx response body into an ApiClientError and notify session listeners. */
export function toApiError(
  status: number,
  body: Partial<ApiErrorBody> | null,
  path: string,
): ApiClientError {
  if (status === 401 && !path.startsWith('/auth/')) unauthorizedListeners.forEach((fn) => fn());
  return new ApiClientError(
    status,
    body?.code ?? 'INTERNAL_ERROR',
    body?.message ?? 'Something went wrong. Please try again.',
    body?.errors ?? [],
  );
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<ApiSuccess<T, PaginationMeta>> {
  // Plain AbortController + timer (AbortSignal.any/timeout are missing on older Android browsers).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? DEFAULT_TIMEOUT);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  const signal = controller.signal;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    // Caller-initiated aborts propagate untouched (TanStack Query cancels stale requests).
    if (opts.signal?.aborted) throw err;
    throw new ApiClientError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  const json = (await res.json().catch(() => null)) as
    (ApiSuccess<T, PaginationMeta> & Partial<ApiErrorBody>) | null;
  if (!res.ok) throw toApiError(res.status, json, path);
  if (!json)
    throw new ApiClientError(res.status, 'INTERNAL_ERROR', 'Unexpected response from the server.');
  return json;
}

/* Thin typed helpers — services only ever see `data` (and `meta` for lists). */

export async function get<T>(path: string, opts?: RequestOptions): Promise<T> {
  return (await request<T>('GET', path, undefined, opts)).data;
}

export async function getPage<T>(
  path: string,
  opts?: RequestOptions,
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const res = await request<T[]>('GET', path, undefined, opts);
  return { items: res.data, meta: res.meta! };
}

export async function post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return (await request<T>('POST', path, body ?? {}, opts)).data;
}

export async function patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  return (await request<T>('PATCH', path, body ?? {}, opts)).data;
}

export async function del<T>(path: string, opts?: RequestOptions): Promise<T> {
  return (await request<T>('DELETE', path, undefined, opts)).data;
}

/** Drop empty values so query strings stay clean and cache keys stable. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}

export { NETWORK_MESSAGE };
