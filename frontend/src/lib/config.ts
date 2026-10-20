/** All runtime configuration comes from Vite env vars (see frontend/.env.example). */
const env = import.meta.env;

export const config = {
  apiUrl: (env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api',
  appName: (env.VITE_APP_NAME as string | undefined) || 'PlayLocal',
  timeZone: (env.VITE_APP_TIMEZONE as string | undefined) || 'Asia/Kolkata',
  currency: (env.VITE_CURRENCY as string | undefined) || 'INR',
  locale: (env.VITE_LOCALE as string | undefined) || 'en-IN',
  notificationPollMs: Number(env.VITE_NOTIFICATION_POLL_MS) || 60_000,
} as const;
