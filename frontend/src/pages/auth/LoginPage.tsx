import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, MessageSquareText, Smartphone } from 'lucide-react';
import { indianMobileSchema, OTP_LENGTH, type UserDTO } from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import { ApiClientError } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { OtpInput } from '@/components/ui/OtpInput';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { safeNext } from '@/components/layout/Guards';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

type Step = 'phone' | 'otp' | 'profile';

const formatPhone = (p: string) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`;

/** Admins land on the console unless they were heading somewhere specific (?next=). */
const destinationFor = (user: UserDTO, next: string) =>
  user.role === 'admin' && next === '/' ? '/admin' : next;

/** Live countdown for "Resend code in 0:24". */
function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

/**
 * One flow for both login and sign-up: mobile number → OTP → (new users only) name.
 * Mounted at /login and /signup.
 */
export default function LoginPage({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  useDocumentTitle(mode === 'signup' ? 'Create account' : 'Log in');
  const { verifyOtp, completeSignup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useCountdown();
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
  }, [step]);

  function handleError(e: unknown) {
    if (e instanceof ApiClientError && e.code === 'OTP_COOLDOWN') {
      const wait = Number(e.fieldErrors.find((f) => f.path === 'retryAfter')?.message);
      if (wait) setResendIn(wait);
    }
    if (
      e instanceof ApiClientError &&
      (e.code === 'OTP_EXPIRED' || e.code === 'OTP_TOO_MANY_ATTEMPTS')
    )
      setCode('');
    setError(errorMessage(e));
  }

  async function sendCode(target: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await authService.requestOtp({ phone: target });
      setPhone(target);
      setDevCode(res.devCode ?? null);
      setResendIn(res.resendIn);
      setCode('');
      setStep('otp');
    } catch (e) {
      // Already sent recently → let them type the code they received.
      if (e instanceof ApiClientError && e.code === 'OTP_COOLDOWN' && step === 'phone') {
        setPhone(target);
        setStep('otp');
      }
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitPhone(e: FormEvent) {
    e.preventDefault();
    const parsed = indianMobileSchema.safeParse(phoneInput);
    if (!parsed.success)
      return setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid mobile number');
    setFieldError(null);
    await sendCode(parsed.data);
  }

  async function submitCode(value = code) {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp({ phone, code: value });
      if (result.status === 'logged_in') {
        navigate(destinationFor(result.user, next), { replace: true });
      } else {
        setTicket(result.ticket);
        setStep('profile');
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setFieldError('Please enter your name');
    setFieldError(null);
    setBusy(true);
    setError(null);
    try {
      const user = await completeSignup({
        ticket,
        name: name.trim(),
        email: email.trim() || undefined,
      });
      navigate(
        user.role === 'admin' ? '/admin' : `/location?next=${encodeURIComponent(next)}&welcome=1`,
        { replace: true },
      );
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'SIGNUP_TICKET_INVALID') {
        setStep('phone');
        setTicket('');
      }
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-[var(--animate-fade-in)]">
      {step === 'phone' && (
        <>
          <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-700">
            <Smartphone className="size-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === 'signup' ? 'Create your account' : 'Log in or sign up'}
          </h1>
          <p className="mt-2 text-ink-soft">
            Enter your mobile number. We'll send you a 6-digit code — no password needed.
          </p>
          <form onSubmit={submitPhone} noValidate className="mt-8 flex flex-col gap-5">
            {error && <InlineAlert>{error}</InlineAlert>}
            <Field label="Mobile number" error={fieldError ?? undefined} required>
              <div className="flex">
                <span className="inline-flex h-12 items-center rounded-l-xl bg-slate-100 px-3.5 text-[15px] font-semibold text-ink-soft ring-1 ring-line ring-inset">
                  +91
                </span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  maxLength={14}
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="-ml-px h-12 rounded-l-none text-lg tracking-wide"
                  aria-label="Mobile number"
                />
              </div>
            </Field>
            <Button type="submit" size="lg" fullWidth loading={busy}>
              Get OTP
            </Button>
            <p className="text-center text-xs text-ink-faint">
              Standard SMS rates may apply. PlayLocal never asks for payments.
            </p>
          </form>
        </>
      )}

      {step === 'otp' && (
        <>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setError(null);
            }}
            className="-ml-2 mb-6 inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink-soft hover:bg-white hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden /> Change number
          </button>
          <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-700">
            <MessageSquareText className="size-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Enter the code</h1>
          <p className="mt-2 text-ink-soft">
            Sent by SMS to <span className="font-semibold text-ink">{formatPhone(phone)}</span>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
            noValidate
            className="mt-8 flex flex-col gap-5"
          >
            {devCode && (
              <InlineAlert tone="blue" title="Development mode">
                No SMS is sent. Your code is{' '}
                <span className="font-mono font-bold tracking-widest">{devCode}</span>
              </InlineAlert>
            )}
            {error && <InlineAlert>{error}</InlineAlert>}
            <label htmlFor="otp" className="sr-only">
              {OTP_LENGTH}-digit code
            </label>
            <OtpInput
              id="otp"
              ref={otpRef}
              value={code}
              onChange={setCode}
              onComplete={(v) => void submitCode(v)}
              disabled={busy}
              invalid={Boolean(error)}
            />
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={busy}
              disabled={code.length !== OTP_LENGTH}
            >
              Verify
            </Button>
            <p className="text-center text-sm text-ink-soft">
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
                  onClick={() => void sendCode(phone)}
                  disabled={busy}
                  className="font-semibold text-primary-700 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </p>
          </form>
        </>
      )}

      {step === 'profile' && (
        <>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to PlayLocal! 🎉</h1>
          <p className="mt-2 text-ink-soft">
            Your number <span className="font-semibold text-ink">{formatPhone(phone)}</span> is
            verified. What should we call you?
          </p>
          <form onSubmit={submitProfile} noValidate className="mt-8 flex flex-col gap-5">
            {error && <InlineAlert>{error}</InlineAlert>}
            <Field label="Full name" error={fieldError ?? undefined} required>
              <Input
                autoComplete="name"
                placeholder="Rahul Sharma"
                autoFocus
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email" hint="Optional — for tournament updates">
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" size="lg" fullWidth loading={busy}>
              Create account
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
