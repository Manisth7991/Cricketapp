import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router';
import { CheckCircle2, Flag } from 'lucide-react';
import { REPORT_REASONS, REPORT_REASON_LABELS, reportSchema } from '@playlocal/shared';
import { useTournament } from '@/hooks/useTournaments';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tournamentService } from '@/services/tournamentService';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineAlert, LoadingState, errorMessage } from '@/components/ui/States';
import { applyServerErrors } from '@/utils/forms';
import { cn } from '@/utils/cn';

export default function ReportTournamentPage() {
  const { id } = useParams();
  useDocumentTitle('Report tournament');
  const { data: t, isLoading, isError, error, refetch } = useTournament(id);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: undefined, description: '' },
  });
  const selected = watch('reason');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await tournamentService.report(id!, values);
      setDone(true);
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  if (isLoading) return <LoadingState />;
  if (isError || !t) return <ErrorState error={error} onRetry={() => void refetch()} />;

  if (done) {
    return (
      <div className="container-page max-w-lg py-12 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary-50 text-primary-600">
          <CheckCircle2 className="size-8" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Thanks for letting us know</h1>
        <p className="mt-2 text-ink-soft">
          Our team will review {t.name}. You'll get a notification once it's handled.
        </p>
        <ButtonLink to={`/tournaments/${t.id}`} variant="outline" className="mt-6">
          Back to tournament
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="container-page max-w-xl py-6 sm:py-8">
      <PageHeader
        title="Report tournament"
        subtitle={
          <Link to={`/tournaments/${t.id}`} className="hover:underline">
            {t.name}
          </Link>
        }
        back={`/tournaments/${t.id}`}
      />
      <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5 p-5 sm:p-6">
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <fieldset>
          <legend className="text-sm font-medium">
            What's wrong? <span className="text-red-600">*</span>
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 ring-inset',
                  selected === r
                    ? 'bg-primary-50 font-semibold ring-primary-400'
                    : 'ring-line hover:bg-slate-50',
                )}
              >
                <input
                  type="radio"
                  value={r}
                  className="accent-primary-600"
                  {...register('reason')}
                />
                {REPORT_REASON_LABELS[r]}
              </label>
            ))}
          </div>
          {errors.reason && (
            <p className="mt-1.5 text-xs font-medium text-red-600">Select a reason</p>
          )}
        </fieldset>
        <Field
          label="Details"
          error={errors.description?.message}
          hint="Tell us what you noticed — e.g. asked for payment upfront, wrong venue, fake prize."
          required
        >
          <Textarea rows={5} maxLength={1000} {...register('description')} />
        </Field>
        <Button
          type="submit"
          variant="danger"
          loading={isSubmitting}
          leftIcon={<Flag className="size-4" />}
        >
          Submit report
        </Button>
      </form>
    </div>
  );
}
