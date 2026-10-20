/** All runtime configuration comes from Vite env vars (see frontend/.env.example). */
const env = import.meta.env;

const firebase = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};
const firebaseEnabled = Object.values(firebase).every(Boolean);

export const config = {
  apiUrl: (env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api',
  appName: (env.VITE_APP_NAME as string | undefined) || 'PlayLocal',
  timeZone: (env.VITE_APP_TIMEZONE as string | undefined) || 'Asia/Kolkata',
  currency: (env.VITE_CURRENCY as string | undefined) || 'INR',
  locale: (env.VITE_LOCALE as string | undefined) || 'en-IN',
  notificationPollMs: Number(env.VITE_NOTIFICATION_POLL_MS) || 60_000,
  /**
   * Firebase Phone Auth web config (public, safe to ship). When all four keys are set the browser
   * sends the SMS via Firebase; otherwise the API's own OTP engine is used (dev console / MSG91).
   * Must match SMS_PROVIDER=firebase on the backend.
   */
  firebase: firebaseEnabled ? (firebase as Record<keyof typeof firebase, string>) : null,
} as const;
