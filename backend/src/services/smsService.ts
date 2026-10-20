import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * SMS delivery for OTPs, selected by SMS_PROVIDER. Every provider receives a 10-digit Indian
 * mobile number (already validated) and the plain OTP; nothing else about the user is sent.
 */
interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

const TIMEOUT_MS = 10_000;
const ttlMinutes = () => Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60));
const otpText = (code: string) =>
  `${code} is your PlayLocal verification code. It expires in ${ttlMinutes()} minutes. Do not share it with anyone.`;

/** Development only (refused in production by env validation): prints the OTP to the server log. */
const consoleProvider: SmsProvider = {
  async sendOtp(phone, code) {
    logger.warn(`📱 [DEV SMS] OTP for ${phone}: ${code}`);
  },
};

/**
 * MSG91 OTP API (India). Requires a DLT-approved template containing the ##OTP## variable.
 * Docs: https://docs.msg91.com/otp/sendotp
 */
const msg91Provider: SmsProvider = {
  async sendOtp(phone, code) {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', env.MSG91_TEMPLATE_ID!);
    url.searchParams.set('mobile', `91${phone}`);
    url.searchParams.set('otp', code);
    url.searchParams.set('otp_expiry', String(ttlMinutes()));
    const res = await fetch(url, {
      method: 'POST',
      headers: { authkey: env.MSG91_AUTH_KEY!, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || body.type === 'error')
      throw new Error(`MSG91 ${res.status}: ${body.message ?? 'send failed'}`);
  },
};

/** Twilio Messages API. Docs: https://www.twilio.com/docs/messaging/api/message-resource */
const twilioProvider: SmsProvider = {
  async sendOtp(phone, code) {
    const form = new URLSearchParams({ To: `+91${phone}`, Body: otpText(code) });
    if (env.TWILIO_MESSAGING_SERVICE_SID)
      form.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
    else form.set('From', env.TWILIO_FROM!);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`Twilio ${res.status}: ${body.message ?? 'send failed'}`);
    }
  },
};

/** With Firebase the browser sends the SMS; the server-side OTP engine is switched off. */
const firebaseProvider: SmsProvider = {
  async sendOtp() {
    throw new Error('SMS_PROVIDER=firebase: codes are sent by Firebase from the client');
  },
};

const providers: Record<typeof env.SMS_PROVIDER, SmsProvider> = {
  console: consoleProvider,
  msg91: msg91Provider,
  twilio: twilioProvider,
  firebase: firebaseProvider,
};

export function sendOtpSms(phone: string, code: string): Promise<void> {
  return providers[env.SMS_PROVIDER].sendOtp(phone, code);
}

export { otpText };
