import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { ERROR_CODES, LIMITS } from '@playlocal/shared';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

export const UPLOAD_KINDS = ['banner', 'logo', 'avatar', 'player'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

if (env.STORAGE_DRIVER === 'cloudinary') {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Detect the real image type from magic bytes — never trust the client's mimetype/extension. */
export function sniffImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'png';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'webp';
  return null;
}

// Max stored dimensions per kind (Cloudinary resizes on ingest; delivery transforms do the rest).
const MAX_DIM: Record<UploadKind, number> = { banner: 1920, logo: 512, avatar: 512, player: 512 };

export async function storeImage(buf: Buffer, kind: UploadKind): Promise<string> {
  if (buf.length > LIMITS.imageMaxBytes)
    throw new ApiError(413, ERROR_CODES.FILE_TOO_LARGE, 'Image is too large.');
  const type = sniffImageType(buf);
  if (!type)
    throw ApiError.badRequest(
      'Only JPG, PNG or WebP images are allowed.',
      ERROR_CODES.INVALID_FILE,
    );

  if (env.STORAGE_DRIVER === 'local') {
    const name = `${randomBytes(12).toString('hex')}.${type}`;
    const dir = path.resolve(env.UPLOAD_DIR, kind);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);
    return `${env.PUBLIC_API_URL.replace(/\/$/, '')}/uploads/${kind}/${name}`;
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${kind}`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: MAX_DIM[kind], height: MAX_DIM[kind], crop: 'limit' }],
        overwrite: false,
      },
      (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
    );
    stream.end(buf);
  }).catch((err: { message?: string; http_code?: number }) => {
    // Log the provider's reason (e.g. missing key permissions); users get a generic message.
    logger.error(
      { provider: 'cloudinary', httpCode: err?.http_code, reason: err?.message },
      'Image upload failed',
    );
    throw new ApiError(502, ERROR_CODES.INTERNAL_ERROR, 'Image upload failed. Please try again.');
  });
  return result.secure_url;
}

/**
 * Images must come from our own storage (prevents hot-linking arbitrary/tracking URLs).
 * Empty string = "remove image".
 */
export function isOwnImageUrl(url: string): boolean {
  if (url === '') return true;
  if (env.STORAGE_DRIVER === 'cloudinary') {
    return url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`);
  }
  return url.startsWith(`${env.PUBLIC_API_URL.replace(/\/$/, '')}/uploads/`);
}

export function assertOwnImages(fields: Record<string, string | undefined>) {
  for (const [field, url] of Object.entries(fields)) {
    if (url !== undefined && !isOwnImageUrl(url)) {
      throw ApiError.badRequest(
        'Please upload the image using the uploader.',
        ERROR_CODES.INVALID_FILE,
        [{ path: field, message: 'Invalid image' }],
      );
    }
  }
}
