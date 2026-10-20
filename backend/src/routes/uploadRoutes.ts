import { Router } from 'express';
import multer from 'multer';
import { LIMITS } from '@playlocal/shared';
import { requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import * as c from '../controllers/uploadController';

// Memory storage: files are validated (magic bytes) then streamed to storage — never written raw to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.imageMaxBytes, files: 1, fields: 2 },
});

export const uploadRouter = Router();
uploadRouter.post('/image', requireAuth, uploadLimiter, upload.single('file'), c.uploadImage);
