import type { Request, Response } from 'express';
import { ERROR_CODES } from '@playlocal/shared';
import { ApiError } from '../utils/ApiError';
import { created } from '../utils/respond';
import { storeImage, UPLOAD_KINDS, type UploadKind } from '../services/storageService';

export async function uploadImage(req: Request, res: Response) {
  const kind = String(req.query.kind ?? '') as UploadKind;
  if (!UPLOAD_KINDS.includes(kind)) throw ApiError.badRequest('Invalid upload kind.');
  if (!req.file) throw ApiError.badRequest('No image provided.', ERROR_CODES.INVALID_FILE);
  const url = await storeImage(req.file.buffer, kind);
  created(res, { url }, 'Image uploaded');
}
