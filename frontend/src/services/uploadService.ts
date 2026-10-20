import { LIMITS, type ApiErrorBody } from '@playlocal/shared';
import { ApiClientError, NETWORK_MESSAGE, buildUrl, toApiError } from './api';

export type UploadKind = 'banner' | 'logo' | 'avatar' | 'player';

/** Client-side pre-check (server validates again — this just gives instant feedback). */
export function validateImage(file: File): string | null {
  if (!(LIMITS.imageMimeTypes as readonly string[]).includes(file.type))
    return 'Use a JPG, PNG or WebP image.';
  if (file.size > LIMITS.imageMaxBytes)
    return `Image must be under ${LIMITS.imageMaxBytes / 1024 / 1024} MB.`;
  return null;
}

export const uploadService = {
  /** XHR (not fetch) so we can report upload progress. */
  image(file: File, kind: UploadKind, onProgress?: (pct: number) => void): Promise<string> {
    const problem = validateImage(file);
    if (problem) return Promise.reject(new ApiClientError(400, 'INVALID_FILE', problem));

    return new Promise((resolve, reject) => {
      const path = '/uploads/image';
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUrl(path, { kind }));
      xhr.withCredentials = true;
      xhr.timeout = 60_000;
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.onprogress = (e) =>
        e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onerror = xhr.ontimeout = () =>
        reject(new ApiClientError(0, 'NETWORK_ERROR', NETWORK_MESSAGE));
      xhr.onload = () => {
        let body: ({ data?: { url: string } } & Partial<ApiErrorBody>) | null = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON error page */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body?.data?.url) resolve(body.data.url);
        else reject(toApiError(xhr.status, body, path));
      };
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },
};
