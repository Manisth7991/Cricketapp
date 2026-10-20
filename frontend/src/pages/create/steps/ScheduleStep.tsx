import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tournamentScheduleSchema } from '@playlocal/shared';
import { useTournamentMutations } from '@/hooks/useMyTournaments';
import { Checkbox, Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { InlineAlert, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';
import { toDateInput, todayIso } from '@/utils/format';
import { LockedNote, StepCard, StepFooter, isLocked, type StepProps } from './shared';

const toNumber = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v);

export function ScheduleStep({ tournament: t, onSaved, onBack }: StepProps) {
  const { update } = useTournamentMutations();
  const published = t?.status === 'published';
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(tournamentScheduleSchema),
    defaultValues: {
      startDate: t?.startDate ?? '',
      endDate: t?.endDate ?? '',
      registrationDeadline: toDateInput(t?.registrationDeadline),
      maxTeams: t?.maxTeams,
      allowWaitlist: t?.allowWaitlist ?? true,
    },
  });
  const start = watch('startDate');
  const today = todayIso();

  const onSubmit = handleSubmit(async (values) => {
    try {
      const body = published
        ? { maxTeams: values.maxTeams, allowWaitlist: values.allowWaitlist }
        : values;
      onSaved(await update.mutateAsync({ id: t!.id, body }));
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepCard
        title="Schedule & capacity"
        description="Registration closes at the end of the deadline day."
      >
        {published && <LockedNote />}
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" error={errors.startDate?.message} required>
            <Input
              type="date"
              min={today}
              disabled={isLocked(t, 'startDate')}
              {...register('startDate')}
            />
          </Field>
          <Field label="End date" error={errors.endDate?.message} required>
            <Input
              type="date"
              min={start || today}
              disabled={isLocked(t, 'endDate')}
              {...register('endDate')}
            />
          </Field>
        </div>
        <Field
          label="Registration deadline"
          error={errors.registrationDeadline?.message}
          hint="Must be on or before the start date"
          required
        >
          <Input
            type="date"
            min={today}
            max={start || undefined}
            disabled={isLocked(t, 'registrationDeadline')}
            {...register('registrationDeadline')}
          />
        </Field>
        <Field
          label="Maximum teams"
          error={errors.maxTeams?.message}
          hint={
            t?.registeredCount
              ? `${t.registeredCount} teams already registered — cannot go lower`
              : 'Between 2 and 256'
          }
          required
        >
          <Input
            type="number"
            inputMode="numeric"
            min={Math.max(2, t?.registeredCount ?? 0)}
            max={256}
            placeholder="e.g. 16"
            {...register('maxTeams', { setValueAs: toNumber })}
          />
        </Field>
        <Checkbox
          label="Allow a waitlist when all spots are filled"
          {...register('allowWaitlist')}
        />
      </StepCard>
      <StepFooter onBack={onBack} submitting={isSubmitting} />
    </form>
  );
}
