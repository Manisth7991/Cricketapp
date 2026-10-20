import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { INDIAN_STATES, teamSchema } from '@playlocal/shared';
import { useTeam, useTeamMutations } from '@/hooks/useTeams';
import { useSports } from '@/hooks/useSports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useUserLocation } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, InlineAlert, LoadingState, errorMessage } from '@/components/ui/States';
import { safeNext } from '@/components/layout/Guards';
import { applyServerErrors } from '@/utils/forms';

export default function TeamFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit team' : 'Create team');
  const [params] = useSearchParams();
  const next = params.get('next');
  const navigate = useNavigate();
  const toast = useToast();
  const { sports } = useSports();
  const { location } = useUserLocation();
  const teamQuery = useTeam(id);
  const { create, update } = useTeamMutations(id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      sport: params.get('sport') ?? '',
      description: '',
      logo: '',
      location: { city: location.city ?? '', state: location.state ?? '' },
    },
  });

  useEffect(() => {
    const t = teamQuery.data;
    if (t)
      reset({
        name: t.name,
        sport: t.sport,
        description: t.description ?? '',
        logo: t.logo ?? '',
        location: { city: t.location?.city ?? '', state: t.location?.state ?? '' },
      });
  }, [teamQuery.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) {
        const { players: _p, ...rest } = values;
        await update.mutateAsync(rest);
        toast.success('Team updated');
        navigate(`/teams/${id}`, { replace: true });
      } else {
        const team = await create.mutateAsync(values);
        toast.success('Team created — now add your players');
        const nextParam = next ? `&next=${encodeURIComponent(safeNext(next))}` : '';
        navigate(`/teams/${team.id}?new=1${nextParam}`, { replace: true });
      }
    } catch (e) {
      if (!applyServerErrors(e, setError)) setError('root', { message: errorMessage(e) });
    }
  });

  if (editing && teamQuery.isLoading) return <LoadingState />;
  if (editing && teamQuery.isError)
    return <ErrorState error={teamQuery.error} onRetry={() => void teamQuery.refetch()} />;

  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <PageHeader
        title={editing ? 'Edit team' : 'Create a team'}
        subtitle={editing ? undefined : 'You will be the captain. You can add players next.'}
        back
      />
      <form onSubmit={onSubmit} noValidate className="card flex flex-col gap-5 p-5 sm:p-6">
        {errors.root && <InlineAlert>{errors.root.message}</InlineAlert>}
        <Controller
          control={control}
          name="logo"
          render={({ field }) => (
            <ImageUpload
              kind="logo"
              label="Team logo"
              shape="square"
              value={field.value}
              onChange={field.onChange}
              hint="Optional · square image works best"
            />
          )}
        />
        <Field label="Team name" error={errors.name?.message} required>
          <Input placeholder="e.g. Palsana Panthers" autoComplete="off" {...register('name')} />
        </Field>
        <Field label="Sport" error={errors.sport?.message} required>
          <Select {...register('sport')}>
            <option value="">Select sport</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.icon} {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State" error={errors.location?.state?.message}>
            <Select {...register('location.state')}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Village / City" error={errors.location?.city?.message}>
            <Input placeholder="e.g. Palsana" {...register('location.city')} />
          </Field>
        </div>
        <Field
          label="About the team"
          error={errors.description?.message}
          hint="Optional · max 500 characters"
        >
          <Textarea
            rows={3}
            maxLength={500}
            placeholder="Club, school, village or company team…"
            {...register('description')}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={editing && !isDirty}>
            {editing ? 'Save changes' : 'Create team'}
          </Button>
        </div>
      </form>
    </div>
  );
}
