import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import path from 'node:path';
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { apiRouter } from './routes';
import { errorHandler, notFound } from './middleware/error';
import { requireCsrfHeader } from './middleware/csrf';
import { globalLimiter } from './middleware/rateLimit';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('etag', 'strong');

  const apiOrigin = new URL(env.PUBLIC_API_URL).origin;
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Only matters when this server also serves the SPA (CLIENT_DIST_DIR).
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', apiOrigin],
          'connect-src': ["'self'", 'https://api.cloudinary.com'],
          'upgrade-insecure-requests': isProd ? [] : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and configured origins only.
        if (!origin || env.CLIENT_ORIGINS.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  if (env.STORAGE_DRIVER === 'local') {
    app.use(
      '/uploads',
      express.static(path.resolve(env.UPLOAD_DIR), {
        maxAge: '30d',
        immutable: true,
        fallthrough: false,
      }),
    );
  }

  app.use('/api', globalLimiter, requireCsrfHeader, apiRouter);

  if (env.CLIENT_DIST_DIR) {
    const dist = path.resolve(env.CLIENT_DIST_DIR);
    // Vite emits content-hashed files → safe to cache for a year.
    app.use(
      '/assets',
      express.static(path.join(dist, 'assets'), {
        maxAge: '1y',
        immutable: true,
        fallthrough: false,
      }),
    );
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    // SPA fallback: any other GET that isn't an API call returns index.html (never cached).
    app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
