import type { Auth, ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { config } from '@/lib/config';
import { ApiClientError } from './api';
import { authService, type OtpVerifyResult } from './authService';

export interface SendResult {
  resendIn: number;
  /** Only with the API's console provider in development. */
  devCode?: string;
}

/**
 * One interface for "prove you own this phone number", with two implementations:
 *  - `otp`: our API sends the SMS (dev console / MSG91 / Twilio) and checks the code.
 *  - `firebase`: Firebase Phone Auth sends and checks the SMS in the browser; the API then
 *    verifies the resulting ID token. No DLT registration, free at small scale.
 * Chosen by the VITE_FIREBASE_* keys; the backend must match (SMS_PROVIDER).
 */
export interface PhoneAuth {
  mode: 'otp' | 'firebase';
  send(phone: string): Promise<SendResult>;
  /** Login / sign-up: existing number → logged in; new number → signup ticket. */
  verifyLogin(phone: string, code: string): Promise<OtpVerifyResult>;
  /** Organiser proving a different WhatsApp number → contact ticket. */
  verifyContact(phone: string, code: string): Promise<{ ticket: string }>;
}

const apiOtp: PhoneAuth = {
  mode: 'otp',
  send: (phone) => authService.requestOtp({ phone }),
  verifyLogin: (phone, code) => authService.verifyOtp({ phone, code }),
  verifyContact: (phone, code) => authService.verifyContactOtp({ phone, code }),
};

const FIREBASE_ERRORS: Record<string, [ApiClientError['code'], string]> = {
  'auth/invalid-phone-number': ['VALIDATION_ERROR', 'Enter a valid 10-digit Indian mobile number'],
  'auth/invalid-verification-code': ['OTP_INVALID', 'Incorrect code. Check the SMS and try again.'],
  'auth/code-expired': ['OTP_EXPIRED', 'This code has expired. Request a new one.'],
  'auth/too-many-requests': [
    'OTP_SEND_LIMIT',
    'Too many attempts from this device. Try again later.',
  ],
  'auth/quota-exceeded': [
    'OTP_SEND_FAILED',
    "We couldn't send the SMS right now. Please try again later.",
  ],
  'auth/captcha-check-failed': [
    'OTP_SEND_FAILED',
    'Security check failed. Reload the page and try again.',
  ],
  'auth/network-request-failed': [
    'NETWORK_ERROR',
    'Network error. Check your connection and try again.',
  ],
  // Setup mistakes — say exactly what to fix instead of a generic message.
  'auth/operation-not-allowed': [
    'OTP_SEND_FAILED',
    'Phone sign-in is not enabled for this Firebase project. Enable and save it under Authentication → Sign-in method → Phone.',
  ],
  'auth/billing-not-enabled': [
    'OTP_SEND_FAILED',
    'Firebase needs a billing account (Blaze plan) on this project before it can send SMS. Test numbers still work.',
  ],
  'auth/unauthorized-domain': [
    'OTP_SEND_FAILED',
    'This website is not in the Firebase authorized domains list (Authentication → Settings → Authorized domains).',
  ],
  'auth/invalid-app-credential': [
    'OTP_SEND_FAILED',
    'The security check could not be completed. Reload the page and try again.',
  ],
};

function firebasePhoneAuth(): PhoneAuth {
  // The SDK is loaded on first use so it never lands in the initial bundle.
  let authPromise: Promise<Auth> | undefined;
  let verifier: RecaptchaVerifier | undefined;
  const pending = new Map<string, ConfirmationResult>();

  const getAuthInstance = () =>
    (authPromise ??= (async () => {
      const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      const app = getApps()[0] ?? initializeApp(config.firebase!);
      const auth = getAuth(app);
      auth.languageCode = 'en';
      return auth;
    })());

  /**
   * reCAPTCHA tokens are single-use and expire quickly, so every send gets a brand-new invisible
   * widget on a fresh container element. Reusing one across attempts yields `invalid-app-credential`.
   */
  async function freshVerifier(auth: Auth) {
    const { RecaptchaVerifier } = await import('firebase/auth');
    verifier?.clear();
    document.getElementById('firebase-recaptcha')?.remove();
    const el = document.createElement('div');
    el.id = 'firebase-recaptcha';
    document.body.appendChild(el);
    verifier = new RecaptchaVerifier(auth, el, { size: 'invisible' });
    return verifier;
  }

  function toClientError(e: unknown): ApiClientError {
    if (e instanceof ApiClientError) return e;
    const code = (e as { code?: string } | null)?.code ?? '';
    // Firebase's own message + server payload — the on-screen text is user-friendly, this is for debugging.
    // eslint-disable-next-line no-console
    console.error(
      '[phoneAuth] Firebase error',
      code,
      (e as Error)?.message,
      (e as { customData?: unknown })?.customData,
    );
    const [c, m] = FIREBASE_ERRORS[code] ?? [
      'OTP_SEND_FAILED',
      `Couldn't verify your number right now. Please try again.${code ? ` (${code})` : ''}`,
    ];
    return new ApiClientError(400, c, m);
  }

  async function confirm(phone: string, code: string): Promise<string> {
    const conf = pending.get(phone);
    if (!conf)
      throw new ApiClientError(400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    try {
      const cred = await conf.confirm(code);
      pending.delete(phone);
      return await cred.user.getIdToken();
    } catch (e) {
      throw toClientError(e);
    }
  }

  /** We only use Firebase to prove the number; our own cookie is the session. */
  async function signOutQuietly() {
    try {
      await (await getAuthInstance()).signOut();
    } catch {
      /* ignore */
    }
  }

  return {
    mode: 'firebase',
    async send(phone) {
      const auth = await getAuthInstance();
      try {
        const { signInWithPhoneNumber } = await import('firebase/auth');
        const result = await signInWithPhoneNumber(auth, `+91${phone}`, await freshVerifier(auth));
        pending.set(phone, result);
        return { resendIn: 30 };
      } catch (e) {
        throw toClientError(e);
      } finally {
        // Never reuse a widget: the next send (or resend) builds a new one.
        verifier?.clear();
        verifier = undefined;
      }
    },
    async verifyLogin(phone, code) {
      const idToken = await confirm(phone, code);
      const result = await authService.firebaseVerify({ idToken });
      void signOutQuietly();
      return result;
    },
    async verifyContact(phone, code) {
      const idToken = await confirm(phone, code);
      const result = await authService.firebaseVerifyContact({ idToken });
      void signOutQuietly();
      return result;
    },
  };
}

export const phoneAuth: PhoneAuth = config.firebase ? firebasePhoneAuth() : apiOtp;
