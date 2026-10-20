import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck } from 'lucide-react';
import {
  CONTACT_VISIBILITY,
  CONTACT_VISIBILITY_LABELS,
  normalizePhone,
  tournamentBasicSchema,
} from '@playlocal/shared';
import { useAuth } from '@/context/AuthContext';
import { useSports } from '@/hooks/useSports';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { Field } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon';
import { applyServerErrors } from '@/utils/forms';
import { LockedNote, StepCard, StepFooter, isLocked, type StepProps } from './shared';
import { ContactVerify } from './ContactVerify';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const VISIBILITY_HINTS = {
  members: 'Best for questions before registering',
  registered: 'Fewer messages; only joined teams',
} as const;

export function BasicStep({ tournament: t, onSaved }: StepProps) {
  const { user } = useAuth();
  const { sports } = useSports();
  const { createDraft, update } = useTournamentMutations();
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(tournamentBasicSchema),
    defaultValues: {
      name: t?.name ?? '',
      sport: t?.sport ?? '',
      banner: t?.banner ?? '',
      description: t?.description ?? '',
      contact: {
        // Pre-filled with the organiser's verified login number.
        whatsapp: t?.contact?.whatsapp ?? user?.phone ?? '',
        visibility: t?.contact?.visibility ?? 'members',
        ticket: '',
      },
    },
  });
  const descLen = watch('description')?.length ?? 0;
  const locked = (f: string) => isLocked(t, f);

  // A number other than the organiser's login number (or the one already saved) needs a one-time OTP.
  const whatsapp = normalizePhone(watch('contact.whatsapp') ?? '');
  const ticket = watch('contact.ticket');
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const isOwnNumber = whatsapp === user?.phone;
  const isSaved = whatsapp === t?.contact?.whatsapp;
  const isVerified = Boolean(ticket) && verifiedPhone === whatsapp;
  const needsVerification = INDIAN_MOBILE.test(whatsapp) && !isOwnNumber && !isSaved && !isVerified;
  useEffect(() => {
    // Ticket is bound to the number it was issued for — drop it if the number changes.
    if (ticket && verifiedPhone !== whatsapp) setValue('contact.ticket', '');
  }, [whatsapp, ticket, verifiedPhone, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (needsVerification) {
      return setError('contact.whatsapp', { message: 'Verify this number with the OTP first' });
    }
    try {
      if (!t) return onSaved(await createDraft.mutateAsync(values));
      const body =
        t.status === 'published'
          ? { banner: values.banner, description: values.description, contact: values.contact }
          : values;
      onSaved(await update.mutateAsync({ id: t.id, body }));
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepCard title="Basic information" description="Tell teams what your tournament is about.">
        {t?.status === 'published' && <LockedNote />}
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <Field label="Tournament name" error={errors.name?.message} required>
          <Input
            placeholder="e.g. Sikar Premier League 2026"
            maxLength={100}
            disabled={locked('name')}
            {...register('name')}
          />
        </Field>
        <Field label="Sport" error={errors.sport?.message} required>
          <Select disabled={locked('sport')} {...register('sport')}>
            <option value="">Select sport</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.icon} {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Controller
          control={control}
          name="banner"
          render={({ field }) => (
            <ImageUpload
              kind="banner"
              label="Banner image"
              value={field.value}
              onChange={field.onChange}
              hint="Optional · 16:9 landscape image looks best"
            />
          )}
        />
        <Field
          label="Description"
          error={errors.description?.message}
          hint={`${descLen}/3000 · Format, who can participate, highlights`}
          required
        >
          <Textarea
            rows={6}
            maxLength={3000}
            placeholder="Describe the format, eligibility, match timings, facilities…"
            {...register('description')}
          />
        </Field>

        <fieldset className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
          <legend className="sr-only">Contact for players</legend>
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <WhatsAppIcon className="size-5 text-[#128C7E]" /> Contact for players
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Players get a "Chat on WhatsApp" button on your tournament page. Your number is never
              printed on the page.
            </p>
          </div>
          <Field
            label="WhatsApp number"
            error={errors.contact?.whatsapp?.message}
            hint={
              isOwnNumber ? (
                'Your login number — already verified.'
              ) : isSaved || isVerified ? (
                <span className="inline-flex items-center gap-1 text-accent-700">
                  <BadgeCheck className="size-3.5" aria-hidden /> Verified
                </span>
              ) : (
                'Pre-filled with your login number — a different number needs a one-time OTP.'
              )
            }
            required
          >
            <div className="flex">
              <span className="inline-flex h-11 items-center rounded-l-xl bg-slate-100 px-3 text-sm font-semibold text-ink-soft ring-1 ring-line ring-inset">
                +91
              </span>
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={14}
                aria-label="WhatsApp number"
                className="-ml-px rounded-l-none tracking-wide"
                {...register('contact.whatsapp')}
              />
            </div>
          </Field>
          <input type="hidden" {...register('contact.ticket')} />
          {needsVerification && (
            <ContactVerify
              key={whatsapp}
              phone={whatsapp}
              onVerified={(tk) => {
                setVerifiedPhone(whatsapp);
                setValue('contact.ticket', tk, { shouldDirty: true });
              }}
            />
          )}
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Who can message you</p>
            <div
              role="radiogroup"
              aria-label="Who can message you"
              className="grid gap-2 sm:grid-cols-2"
            >
              {CONTACT_VISIBILITY.map((v) => (
                <label
                  key={v}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-line has-checked:ring-2 has-checked:ring-primary-600"
                >
                  <input
                    type="radio"
                    value={v}
                    className="size-4 accent-primary-600"
                    {...register('contact.visibility')}
                  />
                  <span>
                    <span className="block font-medium">{CONTACT_VISIBILITY_LABELS[v]}</span>
                    <span className="block text-xs text-ink-soft">{VISIBILITY_HINTS[v]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      </StepCard>
      <StepFooter
        submitting={isSubmitting}
        label={t ? 'Save & continue' : 'Create draft & continue'}
      />
    </form>
  );
}
