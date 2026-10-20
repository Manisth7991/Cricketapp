import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const int = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int().nonnegative());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: int(5000),
    CLIENT_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim().replace(/\/$/, ''))
          .filter(Boolean),
      ),
    TRUST_PROXY: int(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    MONGO_AUTO_INDEX: z
      .string()
      .optional()
      .transform((v) => v !== 'false' && v !== '0'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_ROUNDS: int(12).pipe(z.number().min(4).max(15)),
    COOKIE_NAME: z.string().default('pl_session'),
    COOKIE_SECURE: bool,
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((v) => v || undefined),

    STORAGE_DRIVER: z.enum(['cloudinary', 'local']).default('cloudinary'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default('playlocal'),
    PUBLIC_API_URL: z.string().default('http://localhost:5000'),
    UPLOAD_DIR: z.string().default('uploads'),
    // Serve the built frontend from this API (single-server deploys). Leave empty when the
    // frontend is hosted separately (Vercel/Netlify/S3+CDN).
    CLIENT_DIST_DIR: z
      .string()
      .optional()
      .transform((v) => v || undefined),

    // ---- Phone OTP login ----
    // console = print OTP in the server log (development only); msg91 / twilio = real SMS
    SMS_PROVIDER: z.enum(['console', 'msg91', 'twilio']).default('console'),
    OTP_TTL_SECONDS: int(300),
    OTP_RESEND_COOLDOWN_SECONDS: int(30),
    OTP_MAX_ATTEMPTS: int(5),
    OTP_MAX_SENDS_PER_HOUR: int(5),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM: z.string().optional(),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
    RATE_LIMIT_OTP_MAX: int(10),

    APP_UTC_OFFSET: z
      .string()
      .regex(/^[+-]\d{2}:\d{2}$/, 'APP_UTC_OFFSET must look like +05:30')
      .default('+05:30'),

    GEOCODING_ENABLED: bool,
    GEOCODER_URL: z.string().default('https://nominatim.openstreetmap.org'),
    GEOCODER_USER_AGENT: z.string().default('PlayLocal/0.1'),

    RATE_LIMIT_WINDOW_MINUTES: int(15),
    RATE_LIMIT_AUTH_MAX: int(20),
    RATE_LIMIT_REPORT_MAX: int(10),
    RATE_LIMIT_UPLOAD_MAX: int(30),
    RATE_LIMIT_GLOBAL_MAX: int(1000),

    ADMIN_NAME: z.string().default('PlayLocal Admin'),
    ADMIN_EMAIL: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'cloudinary') {
      for (const key of [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=cloudinary`,
          });
      }
    }
    if (env.SMS_PROVIDER === 'console' && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'SMS_PROVIDER=console is not allowed in production — configure msg91 or twilio',
      });
    }
    if (env.SMS_PROVIDER === 'msg91') {
      for (const key of ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when SMS_PROVIDER=msg91`,
          });
      }
    }
    if (env.SMS_PROVIDER === 'twilio') {
      for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'] as const) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when SMS_PROVIDER=twilio`,
          });
      }
      if (!env.TWILIO_FROM && !env.TWILIO_MESSAGING_SERVICE_SID) {
        ctx.addIssue({
          code: 'custom',
          path: ['TWILIO_FROM'],
          message: 'Set TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID when SMS_PROVIDER=twilio',
        });
      }
    }
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SAMESITE=none requires COOKIE_SECURE=true',
      });
    }
    if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'STORAGE_DRIVER=local is not allowed in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(
      `\n❌ Invalid environment configuration:\n${details}\n\nSee backend/.env.example\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
