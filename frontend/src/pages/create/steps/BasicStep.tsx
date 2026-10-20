import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tournamentBasicSchema } from '@playlocal/shared';
import { useSports } from '@/hooks/useSports';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { Field } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';
import { LockedNote, StepCard, StepFooter, isLocked, type StepProps } from './shared';

export function BasicStep({ tournament: t, onSaved }: StepProps) {
  const { sports } = useSports();
  const { createDraft, update } = useTournamentMutations();
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(tournamentBasicSchema),
    defaultValues: {
      name: t?.name ?? '',
      sport: t?.sport ?? '',
      banner: t?.banner ?? '',
      description: t?.description ?? '',
    },
  });
  const descLen = watch('description')?.length ?? 0;
  const locked = (f: string) => isLocked(t, f);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!t) return onSaved(await createDraft.mutateAsync(values));
      const body =
        t.status === 'published'
          ? { banner: values.banner, description: values.description }
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
      </StepCard>
      <StepFooter
        submitting={isSubmitting}
        label={t ? 'Save & continue' : 'Create draft & continue'}
      />
    </form>
  );
}
