import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { OTP_LENGTH } from '@playlocal/shared';
import { phoneAuth } from '@/services/phoneAuth';
import { ApiClientError } from '@/services/api';
import { useCountdown } from '@/hooks/useCountdown';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { formatIndianPhone } from '@/utils/whatsapp';

/**
 * Inline OTP check for a WhatsApp number that is not the organiser's login number.
 * Same OTP engine as login; on success the parent stores the returned ticket in the form.
 */
export function ContactVerify({
  phone,
  onVerified,
}: {
  phone: string;
  onVerified: (ticket: string) => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useCountdown();

  function fail(e: unknown) {
    if (e instanceof ApiClientError && e.code === 'OTP_COOLDOWN') {
      const wait = Number(e.fieldErrors.find((f) => f.path === 'retryAfter')?.message);
      if (wait) setResendIn(wait);
      setSent(true); // a code was sent recently — let them type it
    }
    if (
      e instanceof ApiClientError &&
      (e.code === 'OTP_EXPIRED' || e.code === 'OTP_TOO_MANY_ATTEMPTS')
    )
      setCode('');
    setError(errorMessage(e));
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await phoneAuth.send(phone);
      setDevCode(res.devCode ?? null);
      setResendIn(res.resendIn);
      setCode('');
      setSent(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ticket } = await phoneAuth.verifyContact(phone, value);
      onVerified(ticket);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">{formatIndianPhone(phone)}</span> is not your login
          number. Verify it once by OTP so nobody can list a number that isn't theirs.
        </span>
      </p>
      {error && <InlineAlert>{error}</InlineAlert>}
      {!sent ? (
        <Button size="sm" variant="secondary" onClick={send} loading={busy} className="self-start">
          Send OTP to this number
        </Button>
      ) : (
        <>
          {devCode && (
            <InlineAlert tone="blue" title="Development mode">
              No SMS is sent. Your code is{' '}
              <span className="font-mono font-bold tracking-widest">{devCode}</span>
            </InlineAlert>
          )}
          <label htmlFor="contact-otp" className="sr-only">
            {OTP_LENGTH}-digit code
          </label>
          <OtpInput
            id="contact-otp"
            value={code}
            onChange={setCode}
            onComplete={(v) => void verify(v)}
            disabled={busy}
            invalid={Boolean(error)}
          />
          <p className="text-xs text-ink-soft">
            {resendIn > 0 ? (
              <>
                Didn't get it? Resend in{' '}
                <span className="font-semibold text-ink tabular">
                  0:{String(resendIn).padStart(2, '0')}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy}
                className="font-semibold text-primary-700 hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}
